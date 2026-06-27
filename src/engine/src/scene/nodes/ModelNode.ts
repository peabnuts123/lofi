import { Vector3 } from "@lofi/core/math/vector";
import { Matrix3, Matrix4, type IReadonlyColor4, type IReadonlyVector2, type IReadonlyVector3 } from "@lofi/core/math";
import { Computed } from "@lofi/core/util/observable";
import { Optional, type Mutable } from "@lofi/core/util/types";
import { DrawableSceneNode, SceneNode, type IScene } from "@lofi/engine/scene";
import type { DrawTask, IEngine } from "@lofi/engine/Engine";
import type { Edge, EdgeIndices, IReadonlyTriangleIndices, Model, Triangle } from "@lofi/engine/models";
import { AxisAlignedBoundingBox, type IReadonlyAxisAlignedBoundingBox } from "@lofi/engine/collision";
import { Animation } from "@lofi/engine/animation";
import type { Material } from "@lofi/engine/materials";
import { type IWireframeDrawable, type WireframeFaces } from "@lofi/engine/util/DrawDebug";
import { ModelMaterialOverrides, type MaterialOverrideType } from "@lofi/engine/models/ModelMaterialOverrides";

export class ModelNode extends DrawableSceneNode implements IWireframeDrawable {
  private _model: Model;
  private _animationSource: Model;

  private currentAnimationTime: number = 0;
  private currentAnimation: Animation | undefined;
  private currentAnimationSpeed: number = 1;

  public renderLayer: number = 0;
  private materialOverrides: ModelMaterialOverrides;
  private _geometry: ModelNodeGeometry;

  public constructor(scene: IScene, name: string, model: Model, parent?: SceneNode) {
    super(scene, name, parent);
    this._model = model.createInstance();
    this._animationSource = model;
    this.materialOverrides = new ModelMaterialOverrides(model.materialOverrides);
    this._geometry = new ModelNodeGeometry({
      model: this._model,
      worldMatrixComputed: this.worldMatrixComputed,
    });
  }

  public setMaterialOverride(materialName: string, material: Material, type: MaterialOverrideType = 'override'): void {
    this.materialOverrides.setOverride(materialName, material, type);
  }

  public removeMaterialOverride(materialName: string): void {
    this.materialOverrides.removeOverride(materialName);
  }

  public playAnimation(animationName: string, speed: number = 1): void {
    const animation = this.animationSource.animations.find((animation) => animation.name === animationName);
    if (!animation) {
      throw new Error(`Cannot play animation. No animation exists with name '${animationName}'`);
    }
    if (this.currentAnimation !== animation) {
      this.currentAnimation = animation;
      this.currentAnimationTime = 0;
    }
    this.currentAnimationSpeed = speed;
  }

  public stopAnimation(): void {
    this.currentAnimation = undefined;
    this.currentAnimationTime = 0;
    this.currentAnimationSpeed = 1;
  }

  public draw(engine: IEngine, drawQueue: DrawTask[]): void {
    const viewMatrix = engine.activeScene?.activeCamera?.viewMatrix;

    // No scene or no camera = no draw tasks
    if (viewMatrix !== undefined) {
      this.model.draw(engine, drawQueue, viewMatrix, this.worldMatrix, this.materialOverrides, this.renderLayer);
    }
  }

  public override onUpdate(dt: number, _time: number): void {
    if (this.currentAnimation) {
      for (const channel of this.currentAnimation.channels) {
        channel.update(this.currentAnimationTime, this.model);
      }
      this.currentAnimationTime += dt * this.currentAnimationSpeed;
      // @TODO looping controls
      if (this.currentAnimationTime > this.currentAnimation.length) {
        this.currentAnimationTime %= this.currentAnimation.length;
      }
    }
  }

  public getWireframeFaces(): WireframeFaces {
    return this.geometry.allTriangles;
  }


  public get animationSource(): Model { return this._animationSource; }
  public set animationSource(value: Model) {
    this.stopAnimation();
    this._animationSource = value;
  }
  public get model(): Model { return this._model; }
  public set model(value: Model) {
    this._model = value.createInstance();
    this.materialOverrides.parent = this._model.materialOverrides;
    this._geometry = new ModelNodeGeometry({
      model: this._model,
      worldMatrixComputed: this.worldMatrixComputed,
    });
  }

  // Geometry
  public get geometry(): ModelNodeGeometry { return this._geometry; }
}

interface ModelNodeGeometryArgs {
  model: Model;
  worldMatrixComputed: Computed<Matrix4>;
}
export class ModelNodeGeometry {
  private readonly _allVertexPositions: Computed<readonly IReadonlyVector3[]>;
  private readonly _allVertexNormals: Computed<readonly IReadonlyVector3[]>;
  private readonly _allTriangleIndices: Computed<readonly IReadonlyTriangleIndices[]>;
  private readonly _allTriangles: Computed<readonly Triangle[]>;
  private readonly _allTriangleNormals: Computed<readonly IReadonlyVector3[]>;
  private readonly _allEdgeIndices: Computed<readonly EdgeIndices[]>;
  private readonly _allEdges: Computed<readonly Edge[]>;
  private readonly _allVertexColors: Computed<readonly (IReadonlyColor4 | undefined)[]>;
  private readonly _allVertexTextureCoordinates: Computed<readonly (IReadonlyVector2 | undefined)[]>;
  private readonly _aabb: Computed<Optional<IReadonlyAxisAlignedBoundingBox>>;
  private readonly _approximateAabb: Computed<Optional<IReadonlyAxisAlignedBoundingBox>>;

  public constructor({ model, worldMatrixComputed }: ModelNodeGeometryArgs) {
    /* Vertex positions */
    this._allVertexPositions = new Computed<readonly IReadonlyVector3[]>([], {
      dependencies: [
        worldMatrixComputed,
        model.geometry.allVertexPositions,
      ],
      recompute: (_self) => {
        const self = _self as Vector3[]; // @NOTE type laundering for mutability

        let vertexCount = 0;
        for (const vertexPosition of model.geometry.allVertexPositions.value) {
          let current: Vector3;
          if (self[vertexCount] !== undefined) {
            // Re-use existing instances
            current = self[vertexCount].setValue(vertexPosition);
          } else {
            // Build up array for the first time
            current = self[vertexCount] = vertexPosition.clone();
          }

          // Transform vertex position by ModelNode's world matrix
          current.multiplySelf(worldMatrixComputed.value);
          vertexCount++;
        }
      },
    });

    /* Vertex normals */
    const worldMatrixTransposedInverseComputed = new Computed<Matrix3>(new Matrix3(), {
      dependencies: [
        worldMatrixComputed,
      ],
      recompute: (self) => {
        self.normalSelf(worldMatrixComputed.value);
      },
    });
    this._allVertexNormals = new Computed<readonly IReadonlyVector3[]>([], {
      dependencies: [
        worldMatrixTransposedInverseComputed,
        model.geometry.allVertexNormals,
      ],
      recompute: (_self) => {
        const self = _self as Vector3[]; // @NOTE type laundering for mutability

        let vertexCount = 0;
        const worldMatrixTransposedInverse = worldMatrixTransposedInverseComputed.value;
        for (const vertexNormal of model.geometry.allVertexNormals.value) {
          let current: Vector3;
          if (self[vertexCount] !== undefined) {
            // Re-use existing instances
            current = self[vertexCount].setValue(vertexNormal);
          } else {
            // Build up array for the first time
            current = self[vertexCount] = vertexNormal.clone();
          }

          // Transform vertex normal by transposed inverse of ModelNode's world matrix
          current.multiplySelf(worldMatrixTransposedInverse).normalizeSelf();
          vertexCount++;
        }
      },
    });

    /* Triangles */
    // @NOTE Just an alias, since no further computation required
    this._allTriangleIndices = model.geometry.allTriangleIndices;
    this._allTriangles = new Computed<readonly Triangle[]>([], {
      dependencies: [
        // @NOTE We don't need to observe `allVertexPositions` since the references cannot change.
        // A triangle's vertices only need to recompute when the indices change.
        this._allTriangleIndices,
      ],
      recompute: (_self) => {
        const self = _self as Mutable<Triangle>[]; // @NOTE type laundering for mutability

        let triangleCount = 0;
        const allVertexPositions = this._allVertexPositions.value;
        for (const triangleIndices of this._allTriangleIndices.value) {
          const aTriangle = allVertexPositions[triangleIndices.aIndex];
          const bTriangle = allVertexPositions[triangleIndices.bIndex];
          const cTriangle = allVertexPositions[triangleIndices.cIndex];
          if (self[triangleCount] !== undefined) {
            // Re-use existing instances
            self[triangleCount][0] = aTriangle;
            self[triangleCount][1] = bTriangle;
            self[triangleCount][2] = cTriangle;
          } else {
            // Build up array for the first time
            self[triangleCount] = [
              aTriangle,
              bTriangle,
              cTriangle,
            ];
          }
          triangleCount++;
        }
      },
    });
    this._allTriangleNormals = new Computed<readonly IReadonlyVector3[]>([], {
      dependencies: [
        worldMatrixTransposedInverseComputed,
        model.geometry.allTriangleNormals,
      ],
      recompute: (_self) => {
        const self = _self as Vector3[]; // @NOTE type laundering for mutability

        let vertexCount = 0;
        const worldMatrixTransposedInverse = worldMatrixTransposedInverseComputed.value;
        for (const triangleNormal of model.geometry.allTriangleNormals.value) {
          let current: Vector3;
          if (self[vertexCount] !== undefined) {
            // Re-use existing instances
            current = self[vertexCount].setValue(triangleNormal);
          } else {
            // Build up array for the first time
            current = self[vertexCount] = triangleNormal.clone();
          }

          // Transform vertex normal by transposed inverse of ModelNode's world matrix
          current.multiplySelf(worldMatrixTransposedInverse).normalizeSelf();
          vertexCount++;
        }
      },
    });

    /* Edges */
    // @NOTE Just an alias, since no further computation required
    this._allEdgeIndices = model.geometry.allEdgeIndices;
    this._allEdges = new Computed<readonly Edge[]>([], {
      dependencies: [
        // @NOTE We don't need to observe `allVertexPositions` since the references cannot change.
        // An edge's vertices only need to recompute when the indices change.
        this._allEdgeIndices,
      ],
      recompute: (_self) => {
        const self = _self as Mutable<Edge>[]; // @NOTE type laundering for mutability

        let edgeCount = 0;
        const allVertexPositions = this._allVertexPositions.value;
        for (const edgeIndices of this._allEdgeIndices.value) {
          const aVertex = allVertexPositions[edgeIndices[0]];
          const bVertex = allVertexPositions[edgeIndices[1]];
          if (self[edgeCount] !== undefined) {
            // Re-use existing instances
            self[edgeCount][0] = aVertex;
            self[edgeCount][1] = bVertex;
          } else {
            // Build up array for the first time
            self[edgeCount] = [
              aVertex,
              bVertex,
            ];
          }
          edgeCount++;
        }

        // Number of unique edges can change, so ensure array is always correct size
        self.length = edgeCount;
      },
    });

    /* Colors */
    // @NOTE Just an alias, since no further computation required
    this._allVertexColors = model.geometry.allVertexColors;

    /* Texture coordinates */
    // @NOTE Just an alias, since no further computation required
    this._allVertexTextureCoordinates = model.geometry.allVertexTextureCoordinates;

    /* AABB */
    this._aabb = new Computed<Optional<IReadonlyAxisAlignedBoundingBox>>(Optional(), {
      dependencies: [
        worldMatrixComputed,
        model.geometry.aabb,
      ],
      recompute: (_self) => {
        const self = _self as Optional<AxisAlignedBoundingBox>; // @NOTE type laundering for mutability
        const modelAabb = model.geometry.aabb.value;
        if (modelAabb.value === undefined) {
          // Entire model has no geometry 🤯
          self.value = undefined;
        } else {
          // Ensure value is initialised
          const aabb = self.value ??= AxisAlignedBoundingBox.zero();

          // Recompute AABB in world space
          aabb.setValue(modelAabb.value)
            .transformSelf(worldMatrixComputed.value);
        }
      },
    });
    this._approximateAabb = new Computed<Optional<IReadonlyAxisAlignedBoundingBox>>(Optional(), {
      dependencies: [
        worldMatrixComputed,
        model.geometry.approximateAabb,
      ],
      recompute: (_self) => {
        const self = _self as Optional<AxisAlignedBoundingBox>; // @NOTE type laundering for mutability
        const modelApproximateAabb = model.geometry.approximateAabb.value;
        if (modelApproximateAabb.value === undefined) {
          // Entire model has no geometry 🤯
          self.value = undefined;
        } else {
          // Ensure value is initialised
          const approximateAabb = self.value ??= AxisAlignedBoundingBox.zero();

          approximateAabb.setValue(modelApproximateAabb.value)
            // Recompute approximate AABB in world space
            .transformSelf(worldMatrixComputed.value);
        }
      },
    });
  }

  public get allVertexPositions(): readonly IReadonlyVector3[] { return this._allVertexPositions.value; }
  public get allVertexNormals(): readonly IReadonlyVector3[] { return this._allVertexNormals.value; }
  public get allTriangleIndices(): readonly IReadonlyTriangleIndices[] { return this._allTriangleIndices.value; }
  public get allTriangles(): readonly Triangle[] { return this._allTriangles.value; }
  public get allTriangleNormals(): readonly IReadonlyVector3[] { return this._allTriangleNormals.value; }
  public get allEdgeIndices(): readonly EdgeIndices[] { return this._allEdgeIndices.value; }
  public get allEdges(): readonly Edge[] { return this._allEdges.value; }
  public get allVertexColors(): readonly (IReadonlyColor4 | undefined)[] { return this._allVertexColors.value; }
  public get allVertexTextureCoordinates(): readonly (IReadonlyVector2 | undefined)[] { return this._allVertexTextureCoordinates.value; }
  public get aabb(): IReadonlyAxisAlignedBoundingBox | undefined { return this._aabb.value.value; }
  public get approximateAabb(): IReadonlyAxisAlignedBoundingBox | undefined { return this._approximateAabb.value.value; }
}

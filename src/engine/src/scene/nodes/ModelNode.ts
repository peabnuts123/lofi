import { Vector3 } from "@lofi/core/math/vector";
import type { Matrix4, Quaternion } from "@lofi/core/math";
import { Computed } from "@lofi/core/util/observable";
import { Optional } from "@lofi/core/util/types";
import { DrawableSceneNode, SceneNode, type IScene } from "@lofi/engine/scene";
import type { DrawTask, IEngine } from "@lofi/engine/Engine";
import type { Edge, EdgeIndices, Model, Triangle, TriangleIndices } from "@lofi/engine/models";
import { AxisAlignedBoundingBox } from "@lofi/engine/collision";
import { Animation } from "@lofi/engine/animation";
import type { Material } from "@lofi/engine/materials";
import { type IWireframeDrawable } from "@lofi/engine/util/DrawDebug";
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
      absoluteRotationQuaternion: this.absoluteRotation.q,
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

  public getWireframeFaces(): Vector3[][] {
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
      absoluteRotationQuaternion: this.absoluteRotation.q,
    });
  }

  // Geometry
  public get geometry(): ModelNodeGeometry { return this._geometry; }
}

interface ModelNodeGeometryArgs {
  model: Model;
  worldMatrixComputed: Computed<Matrix4>;
  absoluteRotationQuaternion: Quaternion;
}
export class ModelNodeGeometry {
  private readonly _allVertexPositions: Computed<Vector3[]>;
  // private readonly _allVertexNormals: Computed<Vector3[]>;
  private readonly _allTriangleIndices: Computed<TriangleIndices[]>;
  private readonly _allTriangles: Computed<Triangle[]>;
  private readonly _allTriangleNormals: Computed<Vector3[]>;
  private readonly _allEdgeIndices: Computed<EdgeIndices[]>;
  private readonly _allEdges: Computed<Edge[]>;
  private readonly _aabb: Computed<Optional<AxisAlignedBoundingBox>>;
  private readonly _approximateAabb: Computed<Optional<AxisAlignedBoundingBox>>;

  public constructor({ model, worldMatrixComputed, absoluteRotationQuaternion }: ModelNodeGeometryArgs) {
    /* Vertices */
    this._allVertexPositions = new Computed<Vector3[]>([], {
      dependencies: [
        worldMatrixComputed,
        model.geometry.allVertexPositions,
      ],
      recompute: (self) => {
        let vertexCount = 0;
        for (const vertexPosition of model.geometry.allVertexPositions.value) {
          let current: Vector3 = self[vertexCount];
          if (current === undefined) {
            current = self[vertexCount] = Vector3.zero();
          }

          // Transform vertex by ModelNode's world matrix
          current.setValue(vertexPosition).multiplySelf(worldMatrixComputed.value);
          vertexCount++;
        }
      },
    });

    /* Triangles */
    // @NOTE Just an alias, since no further computation required
    this._allTriangleIndices = model.geometry.allTriangleIndices;
    this._allTriangles = new Computed<Triangle[]>([], {
      dependencies: [
        this._allVertexPositions,
        this._allTriangleIndices,
      ],
      recompute: (self) => {
        let triangleCount = 0;
        const allVertexPositions = this._allVertexPositions.value;
        for (const triangleIndices of this._allTriangleIndices.value) {
          self[triangleCount++] = [
            allVertexPositions[triangleIndices[0]],
            allVertexPositions[triangleIndices[1]],
            allVertexPositions[triangleIndices[2]],
          ];
        }
      },
    });
    this._allTriangleNormals = new Computed<Vector3[]>([], {
      dependencies: [
        model.geometry.allTriangleNormals,
        absoluteRotationQuaternion,
      ],
      recompute: (self) => {
        let triangleCount = 0;
        for (const triangleNormal of model.geometry.allTriangleNormals.value) {
          let current: Vector3 = self[triangleCount];
          if (current === undefined) {
            current = self[triangleCount] = Vector3.zero();
          }

          // Rotate normal by ModelNode's absolute rotation
          current.setValue(triangleNormal).multiplySelf(absoluteRotationQuaternion);
          triangleCount++;
        }
      },
    });

    /* Edges */
    // @NOTE Just an alias, since no further computation required
    this._allEdgeIndices = model.geometry.allEdgeIndices;
    this._allEdges = new Computed<Edge[]>([], {
      dependencies: [
        this._allVertexPositions,
        this._allEdgeIndices,
      ],
      recompute: (self) => {
        let edgeCount = 0;
        const allVertexPositions = this._allVertexPositions.value;
        for (const edgeIndices of this._allEdgeIndices.value) {
          self[edgeCount++] = [
            allVertexPositions[edgeIndices[0]],
            allVertexPositions[edgeIndices[1]],
          ];
        }
      },
    });

    /* AABB */
    this._aabb = new Computed<Optional<AxisAlignedBoundingBox>>(Optional(), {
      dependencies: [
        worldMatrixComputed,
        model.geometry.aabb,
      ],
      recompute: (self) => {
        const modelAabb = model.geometry.aabb.value;
        if (modelAabb.value === undefined) {
          // Entire model has no geometry 🤯
          self.value = undefined;
        } else {
          // Ensure value is initialised
          const aabb = self.value ??= AxisAlignedBoundingBox.zero();

          aabb.setValue(modelAabb.value)
            // Recompute AABB in world space
            .transformSelf(worldMatrixComputed.value);
        }
      },
    });
    this._approximateAabb = new Computed<Optional<AxisAlignedBoundingBox>>(Optional(), {
      dependencies: [
        worldMatrixComputed,
        model.geometry.approximateAabb,
      ],
      recompute: (self) => {
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

  public get allVertexPositions(): Vector3[] { return this._allVertexPositions.value; }
  // public get allVertexNormals(): Vector3[] { return this._allVertexNormals.value; }
  public get allTriangleIndices(): TriangleIndices[] { return this._allTriangleIndices.value; }
  public get allTriangles(): Triangle[] { return this._allTriangles.value; }
  public get allTriangleNormals(): Vector3[] { return this._allTriangleNormals.value; }
  public get allEdgeIndices(): EdgeIndices[] { return this._allEdgeIndices.value; }
  public get allEdges(): Edge[] { return this._allEdges.value; }
  public get aabb(): AxisAlignedBoundingBox | undefined { return this._aabb.value.value; }
  public get approximateAabb(): AxisAlignedBoundingBox | undefined { return this._approximateAabb.value.value; }
}

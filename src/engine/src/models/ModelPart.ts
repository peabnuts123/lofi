import { Matrix4 } from "@lofi/core/math/Matrix4";
import { Vector3 } from "@lofi/core/math/vector";
import { Transform } from "@lofi/core/transform/Transform";
import type { Rotation } from "@lofi/core/transform/Rotation";
import { Computed } from "@lofi/core/util/observable";
import type { ModelPartDefinition, TransformDefinition } from "@lofi/engine/loaders/definitions/model";
import type { DrawTask, IEngine } from "@lofi/engine/Engine";
import { MaterialInstance } from "@lofi/engine/materials";
import { AxisAlignedBoundingBox } from "@lofi/engine/collision";

import { MeshSkin } from "./MeshSkin";
import type { ModelMaterialOverrides } from "./ModelMaterialOverrides";
import { MeshPrimitiveCache, type Edge, type EdgeIndices, type Triangle, type TriangleIndices } from "./MeshPrimitiveCache";
import type { ModelConfig } from "./Model";
import { Optional } from "@lofi/core/util/types";

export interface ModelPartConstructorArgs {
  name: string;
  transform: TransformDefinition;
  primitiveCaches: MeshPrimitiveCache[];
  parent?: ModelPart;
  skin: MeshSkin | undefined;
  modelConfig: ModelConfig;
}

/**
 * A node in the hierarchy of a model. Can represent a mesh (with or without a skin/skeleton)
 * or a non-visual "bone" used only in rendering calculations.
 */
export class ModelPart {
  public readonly name: string;
  private readonly _transform: Transform<ModelPart>;
  private readonly _skin: MeshSkin | undefined;
  private readonly primitiveCaches: MeshPrimitiveCache[]; // @TODO Does it need a better name?
  private readonly jointMatricesComputed: Computed<Matrix4[]> | undefined;
  private readonly modelConfig: ModelConfig;
  public readonly geometry: ModelPartGeometry;

  private readonly _worldMatrixTmp: Matrix4 = new Matrix4();
  private _jointMatricesBytesTmp: Float32Array | undefined;
  private _modelViewMatrixTmp: Matrix4 = new Matrix4();

  private constructor({ name, transform, primitiveCaches, parent, skin, modelConfig }: ModelPartConstructorArgs) {
    this.name = name;
    this.primitiveCaches = primitiveCaches;
    this._transform = new Transform<ModelPart>(this, parent?.transform);
    this._transform.position = transform.position;
    this._transform.rotation.q = transform.rotation;
    this._transform.scale = transform.scale;
    this._skin = skin;
    this.modelConfig = modelConfig;

    if (this.skin) {
      this.jointMatricesComputed = new Computed<Matrix4[]>(this.skin.skeleton.map(() => new Matrix4()), {
        dependencies: [
          this.localMatrixComputed,
          ...this.skin.skeleton.map((bone) => bone.localMatrixComputed),
        ],
        recompute: (self) => {
          const skin = this.skin!;
          for (let i = 0; i < skin.skeleton.length; i++) {
            self[i]
              .setValue(skin.skeleton[i].localMatrix)
              .multiplySelf(skin.inverseBindMatrices[i]);
          }
        },
      });
    }

    this.geometry = new ModelPartGeometry({
      primitiveCaches,
      localMatrixComputed: this.localMatrixComputed,
      skinJointMatricesComputed: this.jointMatricesComputed,
      modelConfig,
    });
  }

  public createInstance(parentInstance: ModelPart | undefined, skin: MeshSkin | undefined): ModelPart {
    const instance = new ModelPart({
      name: this.name,
      transform: {
        position: this.position,
        rotation: this.rotation.q,
        scale: this.scale,
      },
      parent: parentInstance,
      primitiveCaches: this.primitiveCaches,
      skin,
      modelConfig: this.modelConfig,
    });

    return instance;
  }

  public draw(
    engine: IEngine,
    drawQueue: DrawTask[],
    viewMatrix: Matrix4,
    worldMatrix: Matrix4,
    materialOverrides: ModelMaterialOverrides,
    renderLayer: number,
  ): void {
    // Don't bother doing math unless we need to draw something
    if (this.primitiveCaches.length === 0) return;

    this._worldMatrixTmp.setValue(worldMatrix);

    if (this.skin === undefined) {
      // @NOTE Transform geometry by this ModelPart's local transform ONLY
      // if it does not have a skin. Skinned geometry is transformed by
      // the weights of its joints so it does NOT want to be transformed
      // by this ModelPart's local transform.
      this._worldMatrixTmp.multiplySelf(this.localMatrix);
    } else {
      // Initialise / resize joint matrix buffer
      const JointMatricesTotalBytes = engine.config.models.maxBones * 16;
      if (this._jointMatricesBytesTmp === undefined || this._jointMatricesBytesTmp.length !== JointMatricesTotalBytes) {
        this._jointMatricesBytesTmp = new Float32Array(JointMatricesTotalBytes);
      }

      // Write joint matrices to matrix buffer
      const jointMatrices = this.jointMatricesComputed!.value;
      for (let i = 0; i < jointMatrices.length; i++) {
        jointMatrices[i].writeTo(this._jointMatricesBytesTmp, i * 16);
      }
    }

    const drawTaskUniforms: DrawTask['uniforms'] = {
      worldMatrix: this._worldMatrixTmp,
      skinWeights: this._jointMatricesBytesTmp,
    };

    this._modelViewMatrixTmp
      .setValue(viewMatrix)
      .multiplySelf(this._worldMatrixTmp);

    for (const primitiveCache of this.primitiveCaches) {
      let material = MaterialInstance.DefaultMaterial;
      if (primitiveCache.geometry.material) {
        material = materialOverrides.getResult(primitiveCache.geometry.material.name);
      }
      const primitiveInstance = primitiveCache.getOrCreate(material);
      primitiveInstance.draw(
        drawQueue,
        renderLayer,
        this._modelViewMatrixTmp,
        material,
        drawTaskUniforms,
      );
    }
  }

  public static fromDefinition(engine: IEngine, definition: ModelPartDefinition, parent: ModelPart | undefined, skin: MeshSkin | undefined, modelConfig: ModelConfig): ModelPart {
    const primitiveDefinitions = definition.mesh?.primitives ?? [];
    const meshPrimitives = primitiveDefinitions.map((definition) => new MeshPrimitiveCache(engine, definition));

    return new ModelPart({
      name: definition.name,
      parent,
      transform: definition.transform,
      primitiveCaches: meshPrimitives,
      skin,
      modelConfig,
    });
  }


  public get transform(): Transform<ModelPart> { return this._transform; }
  public get skin(): MeshSkin | undefined { return this._skin; }
  public get parent(): ModelPart | undefined { return this.transform.parent?.node; }
  public get children(): ModelPart[] { return this.transform.children.map((childTransform) => childTransform.node); }

  public get position(): Vector3 { return this.transform.position; }
  public set position(value: Vector3) { this.transform.position = value; }
  public get rotation(): Rotation { return this.transform.rotation; }
  public get scale(): Vector3 { return this.transform.scale; }
  public set scale(value: Vector3) { this.transform.scale = value; }

  public get absolutePosition(): Vector3 { return this.transform.absolutePosition; }
  public set absolutePosition(value: Vector3) { this.transform.absolutePosition = value; }
  public get absoluteRotation(): Rotation { return this.transform.absoluteRotation; }
  public get absoluteScale(): Vector3 { return this.transform.absoluteScale; }
  public set absoluteScale(value: Vector3) { this.transform.absoluteScale = value; }

  public get localMatrix(): Matrix4 { return this.transform.worldMatrix; }
  public get localMatrixComputed(): Computed<Matrix4> { return this.transform.worldMatrixComputed; }
}

interface ModelPartGeometryArgs {
  primitiveCaches: MeshPrimitiveCache[];
  localMatrixComputed: Computed<Matrix4>;
  skinJointMatricesComputed: Computed<Matrix4[]> | undefined;
  modelConfig: ModelConfig;
}

export class ModelPartGeometry {
  public readonly allVertexPositions: Computed<Vector3[]>;
  // public readonly allVertexNormals: Computed<Vector3[]>;
  public readonly allTriangleIndices: Computed<TriangleIndices[]>;
  public readonly allTriangles: Computed<Triangle[]>;
  public readonly allTriangleNormals: Computed<Vector3[]>;
  public readonly allEdgeIndices: Computed<EdgeIndices[]>;
  public readonly allEdges: Computed<Edge[]>;
  public readonly aabb: Computed<Optional<AxisAlignedBoundingBox>>;
  public readonly approximateAabb: Computed<Optional<AxisAlignedBoundingBox>>;

  public constructor({ primitiveCaches, localMatrixComputed, skinJointMatricesComputed, modelConfig }: ModelPartGeometryArgs) {

    /* Vertices */
    const hasSkin = skinJointMatricesComputed !== undefined;
    const tmp_allVertexPositions_skinMatrices = [
      new Matrix4(),
      new Matrix4(),
    ] as const;
    this.allVertexPositions = new Computed<Vector3[]>([], {
      dependencies: [
        localMatrixComputed,
        ...(hasSkin ? [skinJointMatricesComputed] : []),
      ],
      recompute: (self) => {
        let vertexCount = 0;
        const localMatrix = localMatrixComputed.value;
        const jointMatrices = skinJointMatricesComputed?.value;

        for (const primitiveCache of primitiveCaches) {
          const vertexPositions = primitiveCache.geometry.vertexPositions;
          for (let i = 0; i < vertexPositions.length; i++) {
            // Get vertex position
            let currentVertex: Vector3;
            if (self[vertexCount]) {
              // Re-use existing instances
              currentVertex = self[vertexCount].setValue(vertexPositions[i]);
            } else {
              // Build up array for the first time
              currentVertex = self[vertexCount] = vertexPositions[i].clone();
            }

            if (hasSkin && jointMatrices) {
              // Move vertex based on skin weights
              const jointIndices = primitiveCache.geometry.jointIndices![i];
              const jointWeights = primitiveCache.geometry.jointWeights![i];

              /*
                Compute linear sum:
                  weight_0 * jointMatrix[index_0]
                + weight_1 * jointMatrix[index_1]
                + weight_2 * jointMatrix[index_2]
                + weight_3 * jointMatrix[index_3]

                Result stored in `tmpMatrixA`
              */
              const tmpMatrixA = tmp_allVertexPositions_skinMatrices[0];
              const tmpMatrixB = tmp_allVertexPositions_skinMatrices[1];
              if (jointWeights[0] === 1) {
                tmpMatrixA.setValue(jointMatrices[jointIndices[0]]);
              } else if (jointWeights[0] > 0) {
                tmpMatrixA.setValue(jointMatrices[jointIndices[0]]).multiplySelf(jointWeights[0]);
              } else {
                tmpMatrixA.identitySelf();
              }
              for (let i = 1; i <= 3; i++) {
                const jointWeight = jointWeights[i];
                if (jointWeight > 0) {
                  tmpMatrixB.setValue(jointMatrices[jointIndices[i]]).multiplySelf(jointWeight);
                  tmpMatrixA.addSelf(tmpMatrixB);
                }
              }

              currentVertex.multiplySelf(tmpMatrixA);
            } else {
              // @NOTE Transform geometry by this ModelPart's local transform ONLY
              // if it does not have a skin. Skinned geometry is transformed by
              // the weights of its joints so it does NOT want to be transformed
              // by this ModelPart's local transform.
              currentVertex.multiplySelf(localMatrix);
            }

            vertexCount++;
          }
        }
      },
    });

    /* Triangles */
    this.allTriangleIndices = new Computed<TriangleIndices[]>([], {
      dependencies: [],
      recompute: (self) => {
        /**
         * We need to keep track of an offset for vertex indices,
         * since we are merging multiple primitives into one.
         */
        let vertexIndexOffset = 0;
        let vertexCount = 0;
        for (const primitiveCache of primitiveCaches) {
          for (const triangleIndices of primitiveCache.geometry.triangleIndices) {
            self[vertexCount++] = [
              triangleIndices[0] + vertexIndexOffset,
              triangleIndices[1] + vertexIndexOffset,
              triangleIndices[2] + vertexIndexOffset,
            ];
          }
          vertexIndexOffset += primitiveCache.geometry.vertexPositions.length;
        }
      },
    });
    this.allTriangles = new Computed<Triangle[]>([], {
      dependencies: [
        this.allVertexPositions,
        this.allTriangleIndices,
      ],
      recompute: (self) => {
        let triangleCount = 0;
        const allVertexPositions = this.allVertexPositions.value;
        for (const triangleIndices of this.allTriangleIndices.value) {
          self[triangleCount++] = [
            allVertexPositions[triangleIndices[0]],
            allVertexPositions[triangleIndices[1]],
            allVertexPositions[triangleIndices[2]],
          ];
        }
      },
    });
    const tmp_allTriangleNormals_edge1 = Vector3.zero();
    const tmp_allTriangleNormals_edge2 = Vector3.zero();
    this.allTriangleNormals = new Computed<Vector3[]>([], {
      dependencies: [
        this.allTriangles,
      ],
      recompute: (self) => {
        this.allTriangles.value.forEach((triangle, i) => {
          // Get or create reference to Vector3
          let triangleNormal = self[i];
          if (triangleNormal === undefined) {
            triangleNormal = self[i] = Vector3.zero();
          }

          // Compute triangle edges (using tmp shared instances to avoid allocating)
          const edge1 = tmp_allTriangleNormals_edge1.setValue(triangle[1]).subtractSelf(triangle[0]);
          const edge2 = tmp_allTriangleNormals_edge2.setValue(triangle[2]).subtractSelf(triangle[0]);

          // Compute normal as edge1 x edge2
          return triangleNormal.setValue(edge1).crossSelf(edge2).normalizeSelf();
        });
      },
    });

    /* Edges */
    this.allEdgeIndices = new Computed<EdgeIndices[]>([], {
      dependencies: [],
      recompute: (self) => {
        /**
         * We need to keep track of an offset for vertex indices,
         * since we are merging multiple primitives into one.
         */
        let vertexIndexOffset = 0;
        let vertexCount = 0;
        for (const primitiveCache of primitiveCaches) {
          for (const edgeIndices of primitiveCache.geometry.edgeIndices) {
            self[vertexCount++] = [
              edgeIndices[0] + vertexIndexOffset,
              edgeIndices[1] + vertexIndexOffset,
            ];
          }
          vertexIndexOffset += primitiveCache.geometry.vertexPositions.length;
        }
      },
    });
    this.allEdges = new Computed<Edge[]>([], {
      dependencies: [
        this.allVertexPositions,
        this.allEdgeIndices,
      ],
      recompute: (self) => {
        let edgeCount = 0;
        const allVertexPositions = this.allVertexPositions.value;
        for (const edgeIndices of this.allEdgeIndices.value) {
          self[edgeCount++] = [
            allVertexPositions[edgeIndices[0]],
            allVertexPositions[edgeIndices[1]],
          ];
        }
      },
    });

    /* AABB */
    this.aabb = new Computed<Optional<AxisAlignedBoundingBox>>(Optional(), {
      dependencies: [
        this.allVertexPositions,
      ],
      recompute: (self) => {
        if (primitiveCaches.length === 0) {
          // No geometry
          self.value = undefined;
          return;
        } else {
          // Ensure value is initialised
          const aabb = self.value ??= AxisAlignedBoundingBox.zero();

          // Recompute AABB based on vertex positions
          aabb.fromVerticesSelf(this.allVertexPositions.value);
        }
      },
    });
    const tmp_approximateAabb_vertex = Vector3.zero();
    this.approximateAabb = new Computed<Optional<AxisAlignedBoundingBox>>(Optional(), {
      dependencies: [
        localMatrixComputed,
      ],
      recompute: (self) => {
        if (primitiveCaches.length === 0) {
          // Model part has no geometry
          self.value = undefined;
          return;
        } else {
          // Ensure value is initialised
          const aabb = self.value ??= AxisAlignedBoundingBox.zero();

          // Initialise to extreme values
          aabb.setValue({
            xMin: Infinity,
            yMin: Infinity,
            zMin: Infinity,
            xMax: -Infinity,
            yMax: -Infinity,
            zMax: -Infinity,
          });

          const localMatrix = localMatrixComputed.value;

          // Iterate all vertices
          for (const primitiveCache of primitiveCaches) {
            const vertexPositions = primitiveCache.geometry.vertexPositions;
            for (let i = 0; i < vertexPositions.length; i++) {

              // Multiply by local transform
              const currentVertex = tmp_approximateAabb_vertex.setValue(vertexPositions[i]).multiplySelf(localMatrix);

              // Update AABB accordingly
              if (currentVertex.x < aabb.xMin) aabb.xMin = currentVertex.x;
              if (currentVertex.y < aabb.yMin) aabb.yMin = currentVertex.y;
              if (currentVertex.z < aabb.zMin) aabb.zMin = currentVertex.z;
              if (currentVertex.x > aabb.xMax) aabb.xMax = currentVertex.x;
              if (currentVertex.y > aabb.yMax) aabb.yMax = currentVertex.y;
              if (currentVertex.z > aabb.zMax) aabb.zMax = currentVertex.z;
            }
          }
        }
      },
    });
  }

}

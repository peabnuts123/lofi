import { Matrix3 } from "@lofi/core/math/Matrix3";
import { Matrix4 } from "@lofi/core/math/Matrix4";
import { Vector3, type IReadonlyVector3, type IReadonlyVector2 } from "@lofi/core/math/vector";
import type { IReadonlyColor4 } from "@lofi/core/math/Color4";
import { Transform } from "@lofi/core/transform/Transform";
import type { Rotation } from "@lofi/core/transform/Rotation";
import { Computed } from "@lofi/core/util/observable";
import type { ModelPartDefinition, TransformDefinition } from "@lofi/engine/loaders/definitions/model";
import type { DrawTask, IEngine } from "@lofi/engine/Engine";
import { MaterialInstance } from "@lofi/engine/materials";
import { AxisAlignedBoundingBox, type IReadonlyAxisAlignedBoundingBox } from "@lofi/engine/collision";

import { MeshSkin } from "./MeshSkin";
import type { ModelMaterialOverrides } from "./ModelMaterialOverrides";
import { MeshPrimitiveCache, TriangleIndices, type Edge, type EdgeIndices, type IReadonlyTriangleIndices, type JointWeightsKey, type Triangle } from "./MeshPrimitiveCache";
import { Optional, type Mutable } from "@lofi/core/util/types";

export interface ModelPartConstructorArgs {
  name: string;
  transform: TransformDefinition;
  primitiveCaches: MeshPrimitiveCache[];
  parent?: ModelPart;
  skin: MeshSkin | undefined;
}

/**
 * A node in the hierarchy of a model. Can represent a mesh (with or without a skin/skeleton)
 * or a non-visual "bone" used only in rendering calculations.
 */
export class ModelPart {
  public readonly name: string;
  private readonly _transform: Transform<ModelPart>;
  private readonly _skin: MeshSkin | undefined;
  public readonly primitiveCaches: MeshPrimitiveCache[]; // @TODO Does it need a better name?
  private readonly jointMatricesComputed: Computed<Matrix4[]> | undefined;
  public readonly geometry: ModelPartGeometry;

  private _jointMatricesBytesTmp: Float32Array | undefined;
  private _modelViewMatrixTmp: Matrix4 = new Matrix4();

  private constructor({ name, transform, primitiveCaches, parent, skin }: ModelPartConstructorArgs) {
    this.name = name;
    this.primitiveCaches = primitiveCaches;
    this._transform = new Transform<ModelPart>(this, parent?.transform);
    this._transform.position = transform.position;
    this._transform.rotation.q = transform.rotation;
    this._transform.scale = transform.scale;
    this._skin = skin;

    if (this.skin) {
      this.jointMatricesComputed = new Computed<Matrix4[]>(this.skin.skeleton.map(() => new Matrix4()), {
        dependencies: [
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
    });

    return instance;
  }

  private tmp_draw_worldMatrix = Matrix4.identity();
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

    // World matrix (may / may not be premultiplied)
    this.tmp_draw_worldMatrix
      .setValue(worldMatrix);

    if (this.skin !== undefined) {
      // Model has skin
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
    } else {
      // Model has no skin
      // @NOTE Premultiply world matrix by local matrix as it is needed
      // by both vertex position AND vertex normal
      this.tmp_draw_worldMatrix
        .multiplySelf(this.localMatrix);
    }

    const drawTaskUniforms: DrawTask['uniforms'] = {
      worldMatrix: this.tmp_draw_worldMatrix,
      skinWeights: this._jointMatricesBytesTmp,
    };

    this._modelViewMatrixTmp
      .setValue(viewMatrix)
      .multiplySelf(this.tmp_draw_worldMatrix);

    for (const primitiveCache of this.primitiveCaches) {
      let material = MaterialInstance.DefaultMaterial;
      if (primitiveCache.geometry.defaultMaterialDefinition) {
        material = materialOverrides.getResult(primitiveCache.geometry.defaultMaterialDefinition.name);
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

  public static fromDefinition(engine: IEngine, definition: ModelPartDefinition, parent: ModelPart | undefined, skin: MeshSkin | undefined): ModelPart {
    const primitiveDefinitions = definition.mesh?.primitives ?? [];
    const meshPrimitives = primitiveDefinitions.map((definition) => new MeshPrimitiveCache(engine, definition));

    return new ModelPart({
      name: definition.name,
      parent,
      transform: definition.transform,
      primitiveCaches: meshPrimitives,
      skin,
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
}

export class ModelPartGeometry {
  public readonly allVertexPositions: Computed<readonly IReadonlyVector3[]>;
  public readonly allVertexNormals: Computed<readonly IReadonlyVector3[]>;
  public readonly allTriangleIndices: Computed<readonly IReadonlyTriangleIndices[]>;
  public readonly allTriangles: Computed<readonly Triangle[]>;
  public readonly allTriangleNormals: Computed<readonly IReadonlyVector3[]>;
  public readonly allEdgeIndices: Computed<readonly EdgeIndices[]>;
  public readonly allEdges: Computed<readonly Edge[]>;
  public readonly allVertexColors: Computed<readonly (IReadonlyColor4 | undefined)[]>;
  public readonly allVertexTextureCoordinates: Computed<readonly (IReadonlyVector2 | undefined)[]>;
  public readonly aabb: Computed<Optional<IReadonlyAxisAlignedBoundingBox>>;
  public readonly approximateAabb: IReadonlyAxisAlignedBoundingBox | undefined;

  public constructor({ primitiveCaches, localMatrixComputed, skinJointMatricesComputed }: ModelPartGeometryArgs) {

    /* Skin matrices - shared by multiple properties */
    const tmp_skinMatrices = new Matrix4();
    const skinMatricesComputed = new Computed<Matrix4[]>([], {
      dependencies: [
        localMatrixComputed,
        ...primitiveCaches.map((primitiveCache) => primitiveCache.geometry.jointIndicesChanged),
        ...primitiveCaches.map((primitiveCache) => primitiveCache.geometry.jointWeightsChanged),
        // @NOTE `skinJointMatricesComputed` can be undefined if ModelPart does not have a skin
        ...(skinJointMatricesComputed !== undefined ? [skinJointMatricesComputed] : []),
      ],
      recompute: (self) => {
        let vertexCount = 0;
        const localMatrix = localMatrixComputed.value;
        const jointMatrices = skinJointMatricesComputed?.value;

        // Iterate every vertex (by index only)
        for (const primitiveCache of primitiveCaches) {
          // @NOTE Reference `vertexPositions` but ONLY its length which cannot change - no dependency needed
          const vertexPositionsCount = primitiveCache.geometry.vertexPositions.length;
          for (let i = 0; i < vertexPositionsCount; i++) {
            // Calculate matrix
            let currentMatrix: Matrix4;
            if (self[vertexCount] !== undefined) {
              // Re-use existing instances
              currentMatrix = self[vertexCount].identitySelf();
            } else {
              // Build up array for the first time
              currentMatrix = self[vertexCount] = Matrix4.identity();
            }

            const primitiveHasJointWeights = primitiveCache.geometry.jointIndices !== undefined && primitiveCache.geometry.jointWeights !== undefined;
            if (jointMatrices !== undefined && primitiveHasJointWeights) {
              const jointIndices = primitiveCache.geometry.jointIndices[i];
              const jointWeights = primitiveCache.geometry.jointWeights[i];

              const totalWeight = jointWeights[0] + jointWeights[1] + jointWeights[2] + jointWeights[3];

              if (totalWeight > 0) {
                // @TODO This needs to normalize the weights or some such to equal vertex shader exactly (which operates on homogeneous coordinates)

                /*
                  Compute linear sum:
                    weight_0 * jointMatrix[index_0]
                  + weight_1 * jointMatrix[index_1]
                  + weight_2 * jointMatrix[index_2]
                  + weight_3 * jointMatrix[index_3]

                  Result stored in `currentMatrix`
                */
                if (jointWeights[0] === 1) {
                  currentMatrix.setValue(jointMatrices[jointIndices[0]]);
                } else {
                  currentMatrix.setValue(jointMatrices[jointIndices[0]]).multiplySelf(jointWeights[0]);
                }
                for (let i = 1; i <= 3; i++) {
                  const jointWeight = jointWeights[i as JointWeightsKey];
                  if (jointWeight > 0) {
                    tmp_skinMatrices.setValue(jointMatrices[jointIndices[i as JointWeightsKey]]).multiplySelf(jointWeight);
                    currentMatrix.addSelf(tmp_skinMatrices);
                  }
                }
              }
            } else {
              // @NOTE Transform geometry by this ModelPart's local transform ONLY
              // if it does not have a skin. Skinned geometry is transformed by
              // the weights of its joints so it does NOT want to be transformed
              // by this ModelPart's local transform.
              currentMatrix.setValue(localMatrix);
            }

            vertexCount++;
          }
        }
      },
    });

    /* Vertex positions */
    this.allVertexPositions = new Computed<readonly IReadonlyVector3[]>([], {
      dependencies: [
        ...primitiveCaches.map((primitiveCache) => primitiveCache.geometry.vertexPositionsChanged),
        skinMatricesComputed,
      ],
      recompute: (_self) => {
        const self = _self as Vector3[]; // @NOTE type laundering for mutability

        let vertexCount = 0;
        const skinMatrices = skinMatricesComputed.value;

        for (const primitiveCache of primitiveCaches) {
          const vertexPositions = primitiveCache.geometry.vertexPositions;
          for (let i = 0; i < vertexPositions.length; i++) {
            // Get vertex position
            let currentVertex: Vector3;
            if (self[vertexCount] !== undefined) {
              // Re-use existing instances
              currentVertex = self[vertexCount].setValue(vertexPositions[i]);
            } else {
              // Build up array for the first time
              currentVertex = self[vertexCount] = vertexPositions[i].clone();
            }

            currentVertex.multiplySelf(skinMatrices[vertexCount]);

            vertexCount++;
          }
        }
      },
    });

    /* Vertex normals */
    const tmp_allVertexNormals = new Matrix3();
    this.allVertexNormals = new Computed<readonly IReadonlyVector3[]>([], {
      dependencies: [
        ...primitiveCaches.map((primitiveCache) => primitiveCache.geometry.vertexNormalsChanged),
        skinMatricesComputed,
      ],
      recompute: (_self) => {
        const self = _self as Vector3[]; // @NOTE type laundering for mutability

        let vertexCount = 0;
        const skinMatrices = skinMatricesComputed.value;

        for (const primitiveCache of primitiveCaches) {
          const vertexNormals = primitiveCache.geometry.vertexNormals;
          for (let i = 0; i < vertexNormals.length; i++) {
            // Get vertex normal
            let currentVertex: Vector3;
            if (self[vertexCount] !== undefined) {
              // Re-use existing instances
              currentVertex = self[vertexCount].setValue(vertexNormals[i]);
            } else {
              // Build up array for the first time
              currentVertex = self[vertexCount] = vertexNormals[i].clone();
            }

            // Transform normal by transposed inverse of the skinMatrix
            tmp_allVertexNormals.normalSelf(skinMatrices[vertexCount]);
            currentVertex
              .multiplySelf(tmp_allVertexNormals)
              .normalizeSelf();

            vertexCount++;
          }
        }
      },
    });

    /* Triangles */
    this.allTriangleIndices = new Computed<readonly IReadonlyTriangleIndices[]>([], {
      dependencies: [
        // @NOTE Do not depend on `primitiveCache.geometry.vertexPositions` since we only need length (which cannot change)
        ...primitiveCaches.map((primitiveCache) => primitiveCache.geometry.triangleIndicesChanged),
      ],
      recompute: (_self) => {
        const self = _self as TriangleIndices[]; // @NOTE type laundering for mutability

        /**
         * We need to keep track of an offset for vertex indices,
         * since we are merging multiple primitives into one.
         */
        let vertexIndexOffset = 0;
        let triangleCount = 0;
        for (const primitiveCache of primitiveCaches) {
          for (const triangleIndices of primitiveCache.geometry.triangleIndices) {
            const aIndex = triangleIndices.aIndex + vertexIndexOffset;
            const bIndex = triangleIndices.bIndex + vertexIndexOffset;
            const cIndex = triangleIndices.cIndex + vertexIndexOffset;
            if (self[triangleCount] !== undefined) {
              // Re-use existing instances
              self[triangleCount].setValue(aIndex, bIndex, cIndex);
            } else {
              // Build up array for the first time
              self[triangleCount] = new TriangleIndices(aIndex, bIndex, cIndex);
            }
            triangleCount++;
          }
          vertexIndexOffset += primitiveCache.geometry.vertexPositions.length;
        }
      },
    });
    this.allTriangles = new Computed<readonly Triangle[]>([], {
      dependencies: [
        this.allVertexPositions,
        this.allTriangleIndices,
      ],
      recompute: (_self) => {
        const self = _self as Mutable<Triangle>[]; // @NOTE type laundering for mutability

        let triangleCount = 0;
        const allVertexPositions = this.allVertexPositions.value;
        for (const triangleIndices of this.allTriangleIndices.value) {
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
    const tmp_allTriangleNormals_edge1 = Vector3.zero();
    const tmp_allTriangleNormals_edge2 = Vector3.zero();
    this.allTriangleNormals = new Computed<readonly IReadonlyVector3[]>([], {
      dependencies: [
        this.allVertexPositions,
        this.allTriangles,
      ],
      recompute: (_self) => {
        const self = _self as Vector3[]; // @NOTE type laundering for mutability

        this.allTriangles.value.forEach((triangle, i) => {
          // Get or create reference to Vector3
          let triangleNormal: Vector3 = self[i];
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
    this.allEdgeIndices = new Computed<readonly EdgeIndices[]>([], {
      dependencies: [
        // @NOTE Do not depend on `primitiveCache.geometry.vertexPositions` since we only need length (which cannot change)
        ...primitiveCaches.map((primitiveCache) => primitiveCache.geometry.edgeIndices),
      ],
      recompute: (_self) => {
        const self = _self as Mutable<EdgeIndices>[]; // @NOTE type laundering for mutability

        /**
         * We need to keep track of an offset for vertex indices,
         * since we are merging multiple primitives into one.
         */
        let vertexIndexOffset = 0;
        let edgeCount = 0;
        for (const primitiveCache of primitiveCaches) {
          for (const edgeIndices of primitiveCache.geometry.edgeIndices.value) {
            const aIndex = edgeIndices[0] + vertexIndexOffset;
            const bIndex = edgeIndices[1] + vertexIndexOffset;
            if (self[edgeCount] !== undefined) {
              // Re-use existing instances
              self[edgeCount][0] = aIndex;
              self[edgeCount][1] = bIndex;
            } else {
              // Build up array for the first time
              self[edgeCount] = [
                aIndex,
                bIndex,
              ];
            }

            edgeCount++;
          }

          vertexIndexOffset += primitiveCache.geometry.vertexPositions.length;
        }

        // Number of unique edges can change, so ensure array is always correct size
        self.length = edgeCount;
      },
    });
    this.allEdges = new Computed<readonly Edge[]>([], {
      dependencies: [
        this.allVertexPositions,
        this.allEdgeIndices,
      ],
      recompute: (_self) => {
        const self = _self as Mutable<Edge>[]; // @NOTE type laundering for mutability

        let edgeCount = 0;
        const allVertexPositions = this.allVertexPositions.value;
        for (const edgeIndices of this.allEdgeIndices.value) {
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
    this.allVertexColors = new Computed<readonly (IReadonlyColor4 | undefined)[]>([], {
      dependencies: [
        ...primitiveCaches.flatMap((primitiveCache) => primitiveCache.geometry.vertexColorsChanged),
      ],
      recompute: (_self) => {
        const self = _self as Mutable<typeof _self>; // @NOTE type laundering for mutability

        self.length = 0;
        for (const primitiveCache of primitiveCaches) {
          // @NOTE Must retain parity with vertex indices so fill missing attributes with undefined
          if (primitiveCache.geometry.vertexColors !== undefined) {
            self.push(
              ...primitiveCache.geometry.vertexColors,
            );
          } else {
            self.push(
              ...Array.from<undefined>({ length: primitiveCache.geometry.vertexPositions.length }),
            );
          }
        }
      },
    });

    /* Texture coordinates */
    this.allVertexTextureCoordinates = new Computed<readonly (IReadonlyVector2 | undefined)[]>([], {
      dependencies: [
        ...primitiveCaches.flatMap((primitiveCache) => primitiveCache.geometry.vertexTextureCoordinatesChanged),
      ],
      recompute: (_self) => {
        const self = _self as Mutable<typeof _self>; // @NOTE type laundering for mutability

        self.length = 0;
        for (const primitiveCache of primitiveCaches) {
          // @NOTE Must retain parity with vertex indices so fill missing attributes with undefined
          if (primitiveCache.geometry.vertexTextureCoordinates !== undefined) {
            self.push(
              ...primitiveCache.geometry.vertexTextureCoordinates,
            );
          } else {
            self.push(
              ...Array.from<undefined>({ length: primitiveCache.geometry.vertexPositions.length }),
            );
          }
        }
      },
    });

    /* AABB */
    this.aabb = new Computed<Optional<IReadonlyAxisAlignedBoundingBox>>(Optional(), {
      dependencies: [
        this.allVertexPositions,
      ],
      recompute: (_self) => {
        const self = _self as Optional<AxisAlignedBoundingBox>; // @NOTE type laundering for mutability

        const allVertexPositions = this.allVertexPositions.value;
        if (allVertexPositions.length === 0) {
          // No geometry
          self.value = undefined;
          return;
        } else {
          // Ensure value is initialised
          const aabb: AxisAlignedBoundingBox = self.value ??= AxisAlignedBoundingBox.zero();

          // Recompute AABB based on vertex positions
          aabb.fromVerticesSelf(allVertexPositions);
        }
      },
    });

    /* AABB - approximate */
    /*
      @NOTE Calculate proactively since we don't need to allocate anything beyond a tmp value
      and the actual AABB instance which doesn't take much memory.
      This also helps calculate the approximate AABB based on the initial rest post rather than
      whatever pose the model is in the first time you computed it.
    */
    let approximateAabb: AxisAlignedBoundingBox | undefined;

    for (const primitiveCache of primitiveCaches) {
      // @NOTE Let `approximateAabb` remain undefined if ModelPart has no geometry
      if (primitiveCache.geometry.vertexPositions.length === 0) continue;

      if (approximateAabb === undefined) {
        approximateAabb = primitiveCache.geometry.extents.clone();
      } else {
        approximateAabb.unionSelf(primitiveCache.geometry.extents);
      }
    }
    this.approximateAabb = approximateAabb?.transformSelf(localMatrixComputed.value);
  }
}

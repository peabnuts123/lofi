import { Vector3 } from "@lofi/core/math/vector";
import type { Matrix4 } from "@lofi/core/math/Matrix4";
import { Computed, Observable } from "@lofi/core/util/observable";
import { Optional } from "@lofi/core/util/types";
import type { DrawTask, IEngine } from "@lofi/engine/Engine";
import type { ModelDefinition, ModelPartDefinition } from "@lofi/engine/loaders/definitions";
import { Animation } from "@lofi/engine/animation";
import { Material } from "@lofi/engine/materials";
import { AxisAlignedBoundingBox, type AxisAlignedBoundingBoxConstructorArgs } from "@lofi/engine/collision";

import { ModelPart } from "./ModelPart";
import { MeshSkin } from "./MeshSkin";
import { ModelMaterialOverrides, type MaterialOverrideType } from "./ModelMaterialOverrides";
import type { Edge, EdgeIndices, Triangle, TriangleIndices } from "./MeshPrimitiveCache";

/**
 * A 3D model, comprised of a hierarchy of `ModelPart`s, which are comprised
 * of a collection of `MeshPrimitive`s (or not in the case of a bone).
 * ```
 * Model => (0..*) ModelPart => (0..*) MeshPrimitive
 * ```
 */
export class Model {
  private readonly rootParts: ModelPart[];
  public readonly allParts: ModelPart[];
  public readonly animations: Animation[];
  public readonly materialOverrides: ModelMaterialOverrides;
  public readonly geometry: ModelGeometry;
  public readonly config: ModelConfig;

  private constructor(
    rootParts: ModelPart[],
    allParts: ModelPart[],
    animations: Animation[],
    materialOverrides: ModelMaterialOverrides,
    config: ModelConfig,
  ) {
    this.rootParts = rootParts;
    this.allParts = allParts;
    this.animations = animations;
    this.materialOverrides = materialOverrides;
    // @TODO How can we cache this across instances (but not instances that are different e.g. animated)
    this.config = config;
    this.geometry = new ModelGeometry(allParts, config);
  }

  public createInstance(): Model {
    const newRootParts: ModelPart[] = [];
    const newParts: ModelPart[] = [];

    const newInstancesCache = new Map<ModelPart, ModelPart>();

    /**
     * Recursively instantiate a ModelPart and its children.
     * @param modelPart
     */
    function createModelPartInstance(modelPart: ModelPart): ModelPart {
      // Check if we've already instantiated this part
      const cachedResult = newInstancesCache.get(modelPart);
      if (cachedResult) {
        return cachedResult;
      } else {
        // Instantiate parent first
        let parent: ModelPart | undefined;
        if (modelPart.parent) {
          parent = createModelPartInstance(modelPart.parent);
        }

        // Instantiate dependences for skinning first
        let skin: MeshSkin | undefined;
        if (modelPart.skin) {
          const skinJoinParts = modelPart.skin.skeleton.map(createModelPartInstance);
          skin = new MeshSkin(skinJoinParts, modelPart.skin.inverseBindMatrices);
        }

        // Create instance
        const instance = modelPart.createInstance(parent, skin);

        // Sanity check
        if (newInstancesCache.has(modelPart)) {
          throw new Error(`Logic error: Attempted to instantiate ModelPart twice`);
        }

        newParts.push(instance);
        newInstancesCache.set(modelPart, instance);

        // Instantiate children
        for (const childModelPart of modelPart.children) {
          createModelPartInstance(childModelPart);
        }

        return instance;
      }
    }

    // Instantiate top-level model parts
    for (const rootPart of this.rootParts) {
      const instance = createModelPartInstance(rootPart);
      newRootParts.push(instance);
    }

    // Sanity check
    if (newParts.length !== this.allParts.length) {
      throw new Error(`Logic error: Expected Model instance to have the same amount of ModelParts. Original: ${this.allParts.length}. Instance: ${newParts.length}`);
    }

    return new Model(
      newRootParts,
      newParts,
      this.animations,
      this.materialOverrides,
      this.config,
    );
  }

  public setMaterialOverride(materialName: string, material: Material, type: MaterialOverrideType = 'override'): void {
    this.materialOverrides.setOverride(materialName, material, type);
  }

  public removeMaterialOverride(materialName: string): void {
    this.materialOverrides.removeOverride(materialName);
  }

  public draw(engine: IEngine, drawQueue: DrawTask[], viewMatrix: Matrix4, worldMatrix: Matrix4, materialOverrides: ModelMaterialOverrides, renderLayer: number): void {
    for (const modelPart of this.allParts) {
      modelPart.draw(
        engine,
        drawQueue,
        viewMatrix,
        worldMatrix,
        materialOverrides,
        renderLayer,
      );
    }
  }

  public static async fromDefinition(engine: IEngine, definition: ModelDefinition): Promise<Model> {
    const modelPartProcessingCache = new Map<ModelPartDefinition, Promise<ModelPart>>();
    const rootParts: ModelPart[] = [];
    const allPartsPromises: Promise<ModelPart>[] = [];
    const defaultMaterials: Map<string, Material> = new Map();
    const modelConfig = new ModelConfig();

    // Build a lookup table for model part parent definitions.
    // We need to make sure a parent ModelPart is loaded before creating
    // its children as `parent` is a constructor param.
    // However `ModelPartDefinition` only has children properties.
    const parentDefinitionLookup = new Map<ModelPartDefinition, ModelPartDefinition | null>();
    function buildParentHierarchy(partDefinition: ModelPartDefinition): void {
      for (const child of partDefinition.children) {
        parentDefinitionLookup.set(child, partDefinition);
        buildParentHierarchy(child);
      }
    }
    for (const rootPart of definition.rootParts) {
      parentDefinitionLookup.set(rootPart, null);
      buildParentHierarchy(rootPart);
    }

    /**
     * Recursively create ModelPart and its children from a definition.
     * @param partDefinition
     */
    async function createModelPart(partDefinition: ModelPartDefinition): Promise<ModelPart> {
      // Check if we've already created this part
      const cachedResult = await modelPartProcessingCache.get(partDefinition);
      if (cachedResult) {
        return cachedResult;
      } else {
        const promise = (async () => {
          // Create parent first
          let parent: ModelPart | undefined;
          // Look up parent definition
          const parentDefinition = parentDefinitionLookup.get(partDefinition);
          if (parentDefinition === undefined) {
            // @NOTE Because `parentDefinition` would be `null` if model part had no parent.
            throw new Error(`Invalid operation: No parent information for part: ${JSON.stringify(partDefinition)}`);
          } else if (parentDefinition !== null) {
            // Wait for parent to be created
            parent = await createModelPart(parentDefinition);
          }

          // Create dependencies for skin first
          let skin: MeshSkin | undefined = undefined;
          if (partDefinition.skin) {
            const skinJointParts: ModelPart[] = [];
            // @NOTE Load each part in series.
            // Loading in "parallel" (with Promise.all) screws up guarantees around ordering.
            for (const jointPartDefinition of partDefinition.skin.jointParts) {
              const jointPart = await createModelPart(jointPartDefinition);
              skinJointParts.push(jointPart);
            }
            skin = new MeshSkin(skinJointParts, partDefinition.skin.inverseBindMatrices);
          }

          // Create part
          const modelPart = ModelPart.fromDefinition(engine, partDefinition, parent, skin, modelConfig);

          // Load all default materials
          if (partDefinition.mesh) {
            for (const meshPrimitiveDefinition of partDefinition.mesh.primitives) {
              if (meshPrimitiveDefinition.material) {
                // Only load each material once, keyed by name
                if (!defaultMaterials.has(meshPrimitiveDefinition.material.name)) {
                  const material = await Material.fromDefinition(engine, meshPrimitiveDefinition.material);
                  defaultMaterials.set(meshPrimitiveDefinition.material.name, material);
                }
              }
            }
          }

          return modelPart;
        })();

        // Sanity check
        if (modelPartProcessingCache.has(partDefinition)) {
          throw new Error(`Logic error: Attempted to create ModelPart from definition twice`);
        }

        allPartsPromises.push(promise);
        modelPartProcessingCache.set(partDefinition, promise);

        // Create children
        for (const childDefinition of partDefinition.children) {
          await createModelPart(childDefinition);
        }

        return promise;
      }
    }

    // Create model parts recursively from top-level parts
    for (const rootPart of definition.rootParts) {
      const modelPart = await createModelPart(rootPart);
      rootParts.push(modelPart);
    }

    const allParts = await Promise.all(allPartsPromises);

    // Animations
    const animations: Animation[] = [];
    for (const animationDefinition of definition.animations) {
      const animation = new Animation(animationDefinition);
      animations.push(animation);
    }

    const materialOverrides = new ModelMaterialOverrides(defaultMaterials);

    return new Model(rootParts, allParts, animations, materialOverrides, modelConfig);
  }
}

export class ModelGeometry {
  public readonly allVertexPositions: Computed<Vector3[]>;
  // public readonly allVertexNormals: Computed<Vector3[]>;
  public readonly allTriangleIndices: Computed<TriangleIndices[]>;
  public readonly allTriangles: Computed<Triangle[]>;
  public readonly allTriangleNormals: Computed<Vector3[]>;
  public readonly allEdgeIndices: Computed<EdgeIndices[]>;
  public readonly allEdges: Computed<Edge[]>;
  public readonly aabb: Computed<Optional<AxisAlignedBoundingBox>>;
  public readonly approximateAabb: Computed<Optional<AxisAlignedBoundingBox>>;

  public constructor(parts: ModelPart[], modelConfig: ModelConfig) {
    /* Vertices */
    this.allVertexPositions = new Computed<Vector3[]>([], {
      dependencies: [
        ...parts.map((part) => part.geometry.allVertexPositions),
      ],
      recompute: (self) => {
        let vertexCount = 0;
        for (const part of parts) {
          for (const vertexPosition of part.geometry.allVertexPositions.value) {
            self[vertexCount++] = vertexPosition;
          }
        }
      },
    });

    /* Triangles */
    this.allTriangleIndices = new Computed<TriangleIndices[]>([], {
      dependencies: [
        ...parts.map((part) => part.geometry.allVertexPositions),
        ...parts.map((part) => part.geometry.allTriangleIndices),
      ],
      recompute: (self) => {
        /**
         * We need to keep track of an offset for vertex indices,
         * since we are merging multiple primitives into one.
         */
        let vertexIndexOffset = 0;
        let triangleCount = 0;
        for (const part of parts) {
          for (const triangleIndices of part.geometry.allTriangleIndices.value) {
            self[triangleCount++] = [
              triangleIndices[0] + vertexIndexOffset,
              triangleIndices[1] + vertexIndexOffset,
              triangleIndices[2] + vertexIndexOffset,
            ];
          }
          vertexIndexOffset += part.geometry.allVertexPositions.value.length;
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
    this.allTriangleNormals = new Computed<Vector3[]>([], {
      dependencies: [
        ...parts.map((part) => part.geometry.allTriangleNormals),
      ],
      recompute: (self) => {
        let triangleCount = 0;
        for (const part of parts) {
          for (const triangleNormal of part.geometry.allTriangleNormals.value) {
            self[triangleCount++] = triangleNormal;
          }
        }
      },
    });

    /* Edges */
    this.allEdgeIndices = new Computed<EdgeIndices[]>([], {
      dependencies: [
        ...parts.map((part) => part.geometry.allVertexPositions),
        ...parts.map((part) => part.geometry.allEdgeIndices),
      ],
      recompute: (self) => {
        /**
         * We need to keep track of an offset for vertex indices,
         * since we are merging multiple primitives into one.
         */
        let vertexIndexOffset = 0;
        let edgeCount = 0;
        for (const part of parts) {
          for (const edgeIndices of part.geometry.allEdgeIndices.value) {
            self[edgeCount++] = [
              edgeIndices[0] + vertexIndexOffset,
              edgeIndices[1] + vertexIndexOffset,
            ];
          }
          vertexIndexOffset += part.geometry.allVertexPositions.value.length;
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
        const allVertexPositions = this.allVertexPositions.value;
        if (allVertexPositions.length === 0) {
          // Entire model has no geometry 🤯
          self.value = undefined;
        } else {
          // Ensure value is initialised
          const aabb = self.value ??= AxisAlignedBoundingBox.zero();

          // Recompute AABB based on vertex positions
          aabb.fromVerticesSelf(this.allVertexPositions.value);
        }
      },
    });
    this.approximateAabb = new Computed<Optional<AxisAlignedBoundingBox>>(Optional(), {
      dependencies: [
        modelConfig,
        ...parts.map((part) => part.geometry.approximateAabb),
      ],
      recompute: (self) => {
        if (modelConfig.aabbApproximationPolicy.type === 'fixed') {
          /* Fixed size AABB approximation */
          // Ensure value is initialised
          const aabb = self.value ??= AxisAlignedBoundingBox.zero();
          aabb.setValue(modelConfig.aabbApproximationPolicy.dimensions);
        } else {
          const partAABBs = parts
            .map((part) => part.geometry.approximateAabb.value.value)
            .filter((maybeAabb) => maybeAabb !== undefined);

          if (partAABBs.length === 0) {
            // Entire model has no geometry 🤯
            self.value = undefined;
          } else {
            // Ensure value is initialised
            const aabb = self.value ??= AxisAlignedBoundingBox.zero();

            // Combine child AABBs
            for (let i = 0; i < partAABBs.length; i++) {
              const partAABB = partAABBs[i];
              if (i === 0) {
                aabb.setValue(partAABB);
              } else {
                aabb.unionSelf(partAABB);
              }
            }

            const anyPartsHaveSkin = parts.some((part) => part.skin !== undefined);

            // Apply AABB approximation policy if any model parts have skin
            // Unskinned models' approximate AABBs should be identical to their actual AABB
            if (anyPartsHaveSkin) {
              switch (modelConfig.aabbApproximationPolicy.type) {
                case 'scaled': {
                  const scaleFactor = modelConfig.aabbApproximationPolicy.scaleFactor;
                  const xCenter = (aabb.xMin + aabb.xMax) / 2;
                  const yCenter = (aabb.yMin + aabb.yMax) / 2;
                  const zCenter = (aabb.zMin + aabb.zMax) / 2;

                  aabb.xMin = xCenter + (aabb.xMin - xCenter) * scaleFactor;
                  aabb.yMin = yCenter + (aabb.yMin - yCenter) * scaleFactor;
                  aabb.zMin = zCenter + (aabb.zMin - zCenter) * scaleFactor;
                  aabb.xMax = xCenter + (aabb.xMax - xCenter) * scaleFactor;
                  aabb.yMax = yCenter + (aabb.yMax - yCenter) * scaleFactor;
                  aabb.zMax = zCenter + (aabb.zMax - zCenter) * scaleFactor;
                  break;
                }
                default:
                  throw new Error(`Unimplemented AABB approximation policy type: '${(modelConfig.aabbApproximationPolicy as { type: string }).type}'`);
              }
            }
          }
        }
      },
    });
  }
}

export interface ScaleBasedAABBApproximationPolicy {
  type: 'scaled';
  scaleFactor: number;
}

export interface FixedSizeAABBApproximationPolicy {
  type: 'fixed';
  dimensions: AxisAlignedBoundingBoxConstructorArgs;
}

export type AABBApproximationPolicy = ScaleBasedAABBApproximationPolicy | FixedSizeAABBApproximationPolicy;

export class ModelConfig extends Observable {
  private _aabbApproximationPolicy: AABBApproximationPolicy = { type: 'scaled', scaleFactor: 2 };

  public get aabbApproximationPolicy(): AABBApproximationPolicy { return this._aabbApproximationPolicy; }
  public set aabbApproximationPolicy(value: AABBApproximationPolicy) {
    // Validation
    if (value.type === 'scaled') {
      if (value.scaleFactor === 0) {
        throw new Error(`AABB approximation policy of type '${value.type}' cannot have a scaleFactor of 0`);
      } else if (value.scaleFactor < 0) {
        throw new Error(`AABB approximation policy of type '${value.type}' cannot have a negative scaleFactor`);
      }
    }

    this.mutate(() => {
      this._aabbApproximationPolicy = value;
    });
  }
}

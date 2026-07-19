import  type { Matrix4 } from "@lopoly/core/math/Matrix4";
import  type { DrawTask, IEngine } from "@lopoly/engine/Engine";
import  type { ModelDefinition, ModelPartDefinition } from "@lopoly/engine/loaders/definitions";
import  { Animation } from "@lopoly/engine/animation";
import  { Material } from "@lopoly/engine/materials";

import { ModelPart } from "./ModelPart";
import { MeshSkin } from "./MeshSkin";
import { ModelMaterialOverrides, type MaterialOverrideType } from "./ModelMaterialOverrides";
import { ModelGeometry } from "./geometry";
import { ModelConfig } from "./ModelConfig";

/**
 * A 3D model, comprised of a hierarchy of `ModelPart`s, which are comprised
 * of a collection of `MeshPrimitive`s (or not in the case of a bone).
 * ```
 * Model => (0..*) ModelPart => (0..*) MeshPrimitive
 * ```
 */
export class Model {
  // @TODO Are these public or do we have methods like `forEachPart` and `findPartWithName` or whatever.
  public readonly rootParts: ModelPart[];
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
          const modelPart = ModelPart.fromDefinition(engine, partDefinition, parent, skin);

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

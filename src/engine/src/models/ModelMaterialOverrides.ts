import { Computed } from "@lofi/core/util/observable";
import { Material, MaterialInstance } from "@lofi/engine/materials";
import type { IEngine } from "@lofi/engine/Engine";
import type { MaterialDefinition } from "@lofi/engine/loaders/definitions";

export type MaterialOverrideType = 'override' | 'replace';
export interface MaterialOverride {
  material: Material;
  type: MaterialOverrideType;
}

export class ModelMaterialOverrides {
  /**
   * Default materials as defined on the model when it was loaded initially.
   * Keyed by material name.
   *
   * Shared across all instances of the {@linkcode ModelMaterialOverrides}.
   */
  private defaultMaterialCache: Map<string, Material>;

  /* Overrides */
  /**
   * Material overrides shared across all instances of the model.
   * Keyed by material name.
   */
  private sharedOverrides: Map<string, MaterialOverride>;
  /**
   * Material overrides unique to this instance of the model.
   * Keyed by material name.
   */
  private readonly instanceOverrides: Map<string, MaterialOverride>;

  /* Material instances */
  /**
   * Material instances that are the product of applying shared material overrides
   * to the default material.
   * Keyed by material name.
   */
  private sharedOverrideMaterialInstances: Map<string, Computed<MaterialInstance>>;
  /**
   * Material instances that are the product of applying both shared AND instance material overrides
   * to the default material.
   * Keyed by material name.
   */
  private readonly instanceOverrideMaterialInstances: Map<string, Computed<MaterialInstance>>;

  private constructor(
    defaultMaterialCache: Map<string, Material>,
    sharedOverrides: Map<string, MaterialOverride>,
    sharedOverrideMaterialInstances: Map<string, Computed<MaterialInstance>>,
  ) {
    // Properties shared across all instances
    this.defaultMaterialCache = defaultMaterialCache;
    this.sharedOverrides = sharedOverrides;
    this.sharedOverrideMaterialInstances = sharedOverrideMaterialInstances;

    // Properties unique to each instance
    this.instanceOverrides = new Map();
    this.instanceOverrideMaterialInstances = new Map();
  }

  /**
   * Load a default material from its definition, if it has not yet been loaded.
   */
  public async initDefaultMaterial(engine: IEngine, materialDefinition: MaterialDefinition): Promise<void> {
    if (!this.defaultMaterialCache.has(materialDefinition.name)) {
      const material = await Material.fromDefinition(engine, materialDefinition);
      this.defaultMaterialCache.set(materialDefinition.name, material);
    }
  }

  /**
   * Create a blank new {@linkcode ModelMaterialOverrides} object.
   */
  public static createNew(): ModelMaterialOverrides {
    return new ModelMaterialOverrides(
      new Map(),
      new Map(),
      new Map(),
    );
  }

  /**
   * Create a new {@linkcode ModelMaterialOverrides} instance from this instance,
   * preserving shared overrides and default materials.
   */
  public createInstance(): ModelMaterialOverrides {
    return new ModelMaterialOverrides(
      this.defaultMaterialCache,
      this.sharedOverrides,
      this.sharedOverrideMaterialInstances,
    );
  }

  /**
   * Get the resulting {@linkcode MaterialInstance} for a given material
   * by applying overrides to the material's default configuration.
   * @param materialName Name of the material.
   */
  public getResult(materialName: string): MaterialInstance {
    const computedMaterialInstance = this.getComputedMaterialInstance(materialName);
    return computedMaterialInstance.value;
  }

  /**
   * Set a material override.
   * @param materialName Name of the material to override.
   * @param material Material properties to override.
   * @param type Whether to replace or override material properties.
   * @param isInstance Whether this is an instance or shared override.
   */
  public setOverride(materialName: string, material: Material, type: MaterialOverrideType, isInstance: boolean): void {
    if (isInstance) {
      this.instanceOverrides.set(materialName, { material, type });
    } else {
      this.sharedOverrides.set(materialName, { material, type });
    }

    this.reconcileComputedMaterialInstanceDependencies(materialName);
  }

  /**
   * Remove a material override.
   * @param materialName Name of the material to remove the override from.
   * @param isInstance Whether this is an instance or shared override.
   */
  public removeOverride(materialName: string, isInstance: boolean): void {
    if (isInstance) {
      this.instanceOverrides.delete(materialName);
    } else {
      this.sharedOverrides.delete(materialName);
    }

    this.reconcileComputedMaterialInstanceDependencies(materialName);
  }

  /**
   * Ensure that the computed {@linkcode MaterialInstance}s for a given material have
   * the correct observable dependencies.
   * @param materialName
   */
  private reconcileComputedMaterialInstanceDependencies(materialName: string): void {
    const computedMaterialInstance = this.getComputedMaterialInstance(materialName);
    computedMaterialInstance.removeAllDependencies();
    const sharedOverride = this.sharedOverrides.get(materialName);
    if (sharedOverride) {
      computedMaterialInstance.addDependency(sharedOverride.material);
    }
    const instanceOverride = this.instanceOverrides.get(materialName);
    if (instanceOverride) {
      computedMaterialInstance.addDependency(instanceOverride.material);
    }
  }

  /**
   * Get the computed {@linkcode MaterialInstance} for a material.
   * @param materialName
   */
  private getComputedMaterialInstance(materialName: string): Computed<MaterialInstance> {
    const hasInstanceOverrides = this.instanceOverrides.has(materialName);
    if (hasInstanceOverrides) {
      // Get or create material based on Shared + Instance overrides
      let materialInstance = this.instanceOverrideMaterialInstances.get(materialName);
      if (materialInstance !== undefined) {
        return materialInstance;
      } else {
        materialInstance = this.createNewComputedMaterialInstance(materialName, (self) => {
          this.applyMaterialOverrideToInstance(self, this.sharedOverrides.get(materialName));
          this.applyMaterialOverrideToInstance(self, this.instanceOverrides.get(materialName));
        });

        this.instanceOverrideMaterialInstances.set(materialName, materialInstance);
        return materialInstance;
      }
    } else {
      // Get or create material based on ONLY Shared overrides
      let materialInstance = this.sharedOverrideMaterialInstances.get(materialName);
      if (materialInstance !== undefined) {
        return materialInstance;
      } else {
        materialInstance = this.createNewComputedMaterialInstance(materialName, (self) => {
          this.applyMaterialOverrideToInstance(self, this.sharedOverrides.get(materialName));
        });

        this.sharedOverrideMaterialInstances.set(materialName, materialInstance);
        return materialInstance;
      }
    }
  }

  /**
   * Create a new {@linkcode Computed<MaterialInstance>} for a material, based on
   * its default material configuration and a given {@linkcode recompute} parameter.
   * @param materialName Name of the material.
   * @param recompute Recompute function, intended to apply overrides to the material instance.
   */
  private createNewComputedMaterialInstance(materialName: string, recompute: (self: MaterialInstance) => void): Computed<MaterialInstance> {
    const defaultMaterial = this.defaultMaterialCache.get(materialName);
    if (defaultMaterial === undefined) {
      throw new Error(`Cannot compute material overrides for material '${materialName}' - it has not been initialised. Have you called 'init()'?`);
    }
    const computedMaterialInstance = new Computed(MaterialInstance.fromMaterial(defaultMaterial), {
      dependencies: [],
      recompute: (self) => {
        self.replaceWith(defaultMaterial);
        recompute(self);
      },
    });

    return computedMaterialInstance;
  }

  /**
   * Apply a {@linkcode MaterialOverride} to a {@linkcode MaterialInstance}.
   * Convenience function for efficient code reuse.
   * @param materialInstance
   * @param override
   */
  private applyMaterialOverrideToInstance(materialInstance: MaterialInstance, override: MaterialOverride | undefined): void {
    if (override !== undefined) {
      if (override.type === 'replace') {
        materialInstance.replaceWith(override.material);
      } else {
        materialInstance.overrideWith(override.material);
      }
    }
  }
}

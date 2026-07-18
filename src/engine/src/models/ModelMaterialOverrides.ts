import { Computed, Observable, type StopObservingFn } from "@lofi/core/util/observable";
import { Material, MaterialInstance } from "@lofi/engine/materials";

export type MaterialOverrideType = 'override' | 'replace';
export interface MaterialOverride {
  material: Material;
  type: MaterialOverrideType;
}

export type ModelMaterialOverridesParent = Map<string, Material> | ModelMaterialOverrides;

export class ModelMaterialOverrides extends Observable {
  // "Parent" is a another instance of ModelMaterialOverrides or
  // a map of default materials that this instance will override.
  /** Function to disconnect from the current parent's observable */
  private stopObservingParent: StopObservingFn | undefined;
  /**
   * Current parent instance. Parent is either another instance of
   * {@linkcode ModelMaterialOverrides} or a set of default materials
   * in the form of {@linkcode Map<string, Material>}.
   */
  private _parent: ModelMaterialOverridesParent;

  /** Overrides in this layer, keyed by material name. */
  private readonly overrides: Map<string, MaterialOverride>;
  /**
   * Computed material instances, keyed by material name.
   * Each material instance is the result of applying all layers
   * of material overrides in order.
   */
  private readonly computedMaterialInstances: Map<string, Computed<MaterialInstance>>;

  public constructor(parent: ModelMaterialOverridesParent) {
    super();
    this._parent = parent;
    if (parent instanceof ModelMaterialOverrides) {
      this.stopObservingParent = parent.onChange(() => this.onParentChange());
    }
    this.overrides = new Map();
    this.computedMaterialInstances = new Map();
  }

  /**
   * Get the resulting {@linkcode MaterialInstance} for a given material
   * by applying overrides in order.
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
   */
  public setOverride(materialName: string, material: Material, type: MaterialOverrideType): void {
    this.overrides.set(materialName, { material, type });
    this.reconcileComputedMaterialInstanceDependencies(materialName);
    this.notifyOnChange();
  }

  /**
   * Remove a material override.
   * @param materialName Name of the material to remove the override from.
   */
  public removeOverride(materialName: string): void {
    this.overrides.delete(materialName);
    this.reconcileComputedMaterialInstanceDependencies(materialName);
    this.notifyOnChange();
  }

  /**
   * Fired whenever a parent (either transitive or direct) mutates a property.
   */
  private onParentChange(): void {
    // Stack of dependencies is invalidated. Recompute every material
    // instance's dependencies.
    for (const materialName of this.computedMaterialInstances.keys()) {
      this.reconcileComputedMaterialInstanceDependencies(materialName);
    }
    this.notifyOnChange();
  }

  /**
   * Ensure that the computed {@linkcode MaterialInstance} for a given material has
   * the correct observable dependencies.
   * @param materialName
   */
  private reconcileComputedMaterialInstanceDependencies(materialName: string): void {
    const computedMaterialInstance = this.getComputedMaterialInstance(materialName);
    computedMaterialInstance.removeAllDependencies();
    const dependencies = this.getAllDependencies();
    for (const dependency of dependencies) {
      const override = dependency.overrides.get(materialName);
      if (override) {
        computedMaterialInstance.addDependency(override.material);
      }
    }
  }

  /**
   * Get the computed {@linkcode MaterialInstance} for a material.
   * @param materialName
   */
  private getComputedMaterialInstance(materialName: string): Computed<MaterialInstance> {
    let materialInstance = this.computedMaterialInstances.get(materialName);
    if (materialInstance) {
      return materialInstance;
    } else {
      materialInstance = new Computed(new MaterialInstance(), {
        dependencies: [], // @NOTE Dependencies managed dynamically by `reconcileComputedMaterialInstanceDependencies`
        recompute: (self) => {
          // Get dependencies
          const defaultMaterial = this.getDefaultMaterial(materialName);
          const dependencies = this.getAllDependencies();

          // Apply dependencies
          self.replaceWith(defaultMaterial!);
          for (const dependency of dependencies) {
            const override = dependency.overrides.get(materialName);
            if (override !== undefined) {
              if (override.type === 'replace') {
                self.replaceWith(override.material);
              } else {
                self.overrideWith(override.material);
              }
            }
          }
        },
      });

      this.computedMaterialInstances.set(materialName, materialInstance);

      return materialInstance;
    }
  }

  /**
   * Look up the default material properties for a material.
   * @param materialName
   */
  private getDefaultMaterial(materialName: string): Material | undefined {
    // Find default material by walking the chain of dependencies.
    // Default material is at the top, since a ModelMaterialOverrides
    // MUST have a parent, and its parent is either another ModelMaterialOverrides
    // instance or the set of default materials.
    let currentDependency = this.parent;
    while (true) {
      if (currentDependency instanceof ModelMaterialOverrides) {
        /* Override layer */
        currentDependency = currentDependency.parent;
      } else {
        /* Default material */
        return currentDependency.get(materialName);
      }
    }
  }

  /**
   * Get the full stack of dependencies for this ModelMaterialOverrides, INCLUDING itself.
   */
  private getAllDependencies(): ModelMaterialOverrides[] {
    const dependencies: ModelMaterialOverrides[] = [];

    // Gather dependencies
    let hasFoundDefaultMaterial = false;
    let currentDependency = this.parent;
    while (!hasFoundDefaultMaterial) {
      if (currentDependency instanceof ModelMaterialOverrides) {
        /* Override layer */
        dependencies.push(currentDependency);
        currentDependency = currentDependency.parent;
      } else {
        /* Default material */
        hasFoundDefaultMaterial = true;
      }
    }

    dependencies.push(this);

    return dependencies;
  }

  public get parent(): ModelMaterialOverridesParent { return this._parent; }
  public set parent(value: ModelMaterialOverridesParent) {
    // Stop observing old parent
    if (this.stopObservingParent) {
      this.stopObservingParent();
      this.stopObservingParent = undefined;
    }
    // Assign new parent
    this._parent = value;
    // Observe new parent
    if (value instanceof ModelMaterialOverrides) {
      this.stopObservingParent = value.onChange(() => this.onParentChange());
    }
    // Process updated parent dependencies
    this.onParentChange();
  }
}

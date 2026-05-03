import type { Material } from "@lofi/engine/materials";

export type MaterialOverrideType = 'override' | 'replace';
export interface MaterialOverride {
  material: Material;
  type: MaterialOverrideType;
}

export class ModelMaterialOverrides {
  private sharedOverrides: Map<string, MaterialOverride>;
  private readonly instanceOverrides: Map<string, MaterialOverride>;

  public constructor() {
    this.sharedOverrides = new Map();
    this.instanceOverrides = new Map();
  }

  public createInstance(): ModelMaterialOverrides {
    const instance = new ModelMaterialOverrides();
    instance.sharedOverrides = this.sharedOverrides;
    return instance;
  }

  public getOverrides(materialName: string): MaterialOverride[] | undefined {
    const overrides = [
      this.sharedOverrides.get(materialName),
      this.instanceOverrides.get(materialName),
    ].filter((override) => override !== undefined);

    if (overrides.length === 0) {
      return undefined;
    } else {
      return overrides;
    }
  }

  public setOverride(materialName: string, material: Material, type: MaterialOverrideType, isInstance: boolean): void {
    if (isInstance) {
      this.instanceOverrides.set(materialName, { material, type });
    } else {
      this.sharedOverrides.set(materialName, { material, type });
    }
  }

  public removeOverride(materialName: string, isInstance: boolean): void {
    if (isInstance) {
      this.instanceOverrides.delete(materialName);
    } else {
      this.sharedOverrides.delete(materialName);
    }
  }
}

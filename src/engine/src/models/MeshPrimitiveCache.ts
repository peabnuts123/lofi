import type { MeshPrimitiveDefinition } from "@lofi/engine/loaders/definitions/model";
import type { IEngine } from "@lofi/engine/Engine";
import { Material, MaterialDefaults, MaterialInstance } from "@lofi/engine/materials";

import { MeshPrimitive } from "./MeshPrimitive";
import type { MaterialOverride } from "./ModelMaterialOverrides";

type MaterialCacheKey = string;

/**
 * Cache that holds `MeshPrimitive` + `MaterialInstance` pairs.
 * Since a `MeshPrimitive`'s internal definition can alter based on what properties are
 * enabled on the material it is drawn with, this cache ensures unique permutations of
 * `MeshPrimitive` + `MaterialInstance` pairs are cached and only regenerated when needed,
 * based on the unique structure of the `MaterialInstance` (NOT by reference).
 */
export class MeshPrimitiveCache {
  private engine: IEngine;
  private cache: Map<MeshPrimitiveDefinition, Map<MaterialCacheKey, [MeshPrimitive, MaterialInstance]>>;
  private defaultMaterialCache: Map<MeshPrimitiveDefinition, Material>;

  public constructor(engine: IEngine) {
    this.engine = engine;
    this.cache = new Map();
    this.defaultMaterialCache = new Map();
  }

  /**
   * Initialise a primitive in the cache by loading its default material.
   */
  public async init(engine: IEngine, primitive: MeshPrimitiveDefinition): Promise<void> {
    let material: Material = Material.DefaultMaterial;
    if (primitive.material) {
      material = await Material.fromDefinition(engine, primitive.material);
    }
    this.defaultMaterialCache.set(primitive, material);
  }

  /**
   * Get a `MeshPrimitive` + `MaterialInstance` pair from the cache for a given primitive definition + any material overrides.
   * If the unique combination of material overrides is not present in the cache, a new MaterialInstance will be created,
   * and stored in the cache.
   * @returns Tuple of `MeshPrimitive` + the `MaterialInstance` it should be drawn with.
   */
  public getOrCreate(primitive: MeshPrimitiveDefinition, materialOverrides: MaterialOverride[] | undefined): [MeshPrimitive, MaterialInstance] {
    const defaultMaterial = this.defaultMaterialCache.get(primitive);
    if (defaultMaterial === undefined) {
      throw new Error(`Unknown error. Mesh primitive has no instance with default material. Has 'init()' been called?`);
    }

    const materialStructuralCacheKey = this.createMaterialStructuralCacheKey(defaultMaterial, materialOverrides);

    let materialCache = this.cache.get(primitive);
    if (materialCache) {
      const cachedResult = materialCache.get(materialStructuralCacheKey);
      if (cachedResult) {
        // Cache hit
        return cachedResult;
      }
    } else {
      materialCache = new Map();
      this.cache.set(primitive, materialCache);
    }

    // Cache miss - create new instances and store in cache
    // console.log(`[${MeshPrimitiveCache.name}] (${this.getOrCreate.name}) Cache MISS with structural key ${materialStructuralCacheKey}`);

    // Create material instance from primitive's default material (either specified in model asset or DefaultMaterial)
    let materialInstance = MaterialInstance.fromMaterial(defaultMaterial);
    // Apply overrides in order (lowest precedence to highest)
    if (materialOverrides !== undefined) {
      for (const materialOverride of materialOverrides) {
        // If material override is `replace` then create new instance from it, continuing to apply overrides
        if (materialOverride.type === 'replace') {
          materialInstance = MaterialInstance.fromMaterial(materialOverride.material);
        } else {
          materialInstance.applyOverride(materialOverride.material);
        }
      }
    }

    // Cache miss - create new instance and store in cache
    const newInstance = MeshPrimitive.fromDefinition(this.engine, primitive, materialInstance);
    materialCache.set(materialStructuralCacheKey, [newInstance, materialInstance]);

    return [newInstance, materialInstance];
  }

  /**
   * Creates a structural cache key that uniquely identifies a material configuration based on its
   * structural properties (i.e. which features are enabled), rather than by reference or the
   * value of its properties. This ensures that `MeshPrimitive` instances are only regenerated
   * when the material's structure changes.
   * Material overrides are applied in order (lowest to highest precedence) to determine the final
   * structural state.
   * @param defaultMaterial The primitive's default material to derive the base structural key from.
   * @param overrides Optional list of material overrides to apply on top of the default material.
   * @returns A string cache key representing the structural configuration of the resolved material.
   */
  private createMaterialStructuralCacheKey(defaultMaterial: Material, overrides: MaterialOverride[] | undefined): MaterialCacheKey {
    /*
      @NOTE Takes about ~8-10us on my machine. Not terribly slow, but, it's not fast. 100 primitives in the scene = 1ms of frame time
      @TODO optimisation ideas:
        - Precompute key result for defaultMaterial + no overrides. Since this will be most of the time.
        - Don't allocate array in `ModelMaterialOverrides.getOverrides()` + probably other hot allocations.
     */
    let blendingModeType = typeof defaultMaterial.blendingMode === 'object' ? defaultMaterial.blendingMode.type : MaterialDefaults.blendingMode.type;
    let hasDiffuseColor = typeof defaultMaterial.diffuseColor === 'object' ? defaultMaterial.diffuseColor !== undefined : MaterialDefaults.diffuseColor !== undefined;
    let hasDiffuseTexture = typeof defaultMaterial.diffuseTexture === 'object' ? defaultMaterial.diffuseTexture !== undefined : MaterialDefaults.diffuseTexture !== undefined;

    if (overrides !== undefined) {
      for (const override of overrides) {
        if (override.type === 'replace') {
          /* Blending mode */
          blendingModeType = typeof override.material.blendingMode === 'object' ? override.material.blendingMode.type : MaterialDefaults.blendingMode.type;
          /* Diffuse color */
          hasDiffuseColor = typeof override.material.diffuseColor === 'object' ? override.material.diffuseColor !== undefined : MaterialDefaults.diffuseColor !== undefined;
          /* Diffuse texture */
          hasDiffuseTexture = typeof override.material.diffuseTexture === 'object' ? override.material.diffuseTexture !== undefined : MaterialDefaults.diffuseTexture !== undefined;
        } else {
          /* Blending mode */
          if (override.material.blendingMode === 'unset') {
            blendingModeType = MaterialDefaults.blendingMode.type;
          } else if (override.material.blendingMode !== undefined) {
            blendingModeType = override.material.blendingMode.type;
          }

          /* Diffuse color */
          if (override.material.diffuseColor === 'unset') {
            hasDiffuseColor = MaterialDefaults.diffuseColor !== undefined;
          } else if (override.material.diffuseColor !== undefined) {
            hasDiffuseColor = override.material.diffuseColor !== undefined;
          }

          /* Diffuse texture */
          if (override.material.diffuseTexture === 'unset') {
            hasDiffuseTexture = MaterialDefaults.diffuseTexture !== undefined;
          } else if (override.material.diffuseTexture !== undefined) {
            hasDiffuseTexture = override.material.diffuseTexture !== undefined;
          }
        }
      }
    }

    return `${blendingModeType}|${hasDiffuseColor}|${hasDiffuseTexture}`;
  }
}

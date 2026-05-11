import type { MeshPrimitiveDefinition } from "@lofi/engine/loaders/definitions/model";
import type { IEngine } from "@lofi/engine/Engine";
import { MaterialInstance } from "@lofi/engine/materials";

import { MeshPrimitive } from "./MeshPrimitive";

type MaterialCacheKey = string;

/**
 * Cache that holds {@linkcode MeshPrimitive} instances.
 * Since a {@linkcode MeshPrimitive}'s internal definition alters based on what properties are
 * enabled on the material it is drawn with, this cache ensures unique permutations of
 * {@linkcode MeshPrimitiveDefinition} + {@linkcode MaterialInstance} are cached and only regenerated when needed,
 * based on the unique structure of the {@linkcode MaterialInstance}.
 */
export class MeshPrimitiveCache {
  private engine: IEngine;
  private cache: Map<MeshPrimitiveDefinition, Map<MaterialCacheKey, MeshPrimitive>>;

  public constructor(engine: IEngine) {
    this.engine = engine;
    this.cache = new Map();
  }

  /**
   * Get a {@link MeshPrimitive} instance from the cache for the unique combination of
   * the given primitive definition + the material with which it will be drawn.
   */
  public getOrCreate(primitive: MeshPrimitiveDefinition, materialInstance: MaterialInstance): MeshPrimitive {
    const materialStructuralCacheKey = this.createMaterialInstanceStructuralKey(materialInstance);

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

    const newInstance = MeshPrimitive.fromDefinition(this.engine, primitive, materialInstance);
    materialCache.set(materialStructuralCacheKey, newInstance);

    return newInstance;
  }

  /**
   * Create a key for the cache that uniquely identifies a material instance based on its
   * structural properties (i.e. which features are enabled), rather than by reference or the
   * value of its properties. This ensures that {@linkcode MeshPrimitive} instances are only regenerated
   * when the material's structure changes.
   * @param materialInstance Material from which to create a key.
   * @returns A string cache key representing the structural configuration of the resolved material.
   */
  private createMaterialInstanceStructuralKey(materialInstance: MaterialInstance): MaterialCacheKey {
    const blendingModeType = materialInstance.blendingMode.type;
    const hasDiffuseColor = materialInstance.diffuseColor !== undefined;
    const hasDiffuseTexture = materialInstance.diffuseTexture !== undefined;
    const hasReflection = materialInstance.reflectionCubemap !== undefined;
    return `${blendingModeType}|${hasDiffuseColor}|${hasDiffuseTexture}|${hasReflection}`;
  }
}

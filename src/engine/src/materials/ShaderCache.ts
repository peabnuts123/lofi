import { IdPool } from '@lofi/core/util/IdPool';
import type { IEngine } from '@lofi/engine/Engine';
import type { MeshPrimitiveDefinition } from '@lofi/engine/loaders/definitions';


import { ShaderVariant, type ShaderVariantOptions } from './ShaderVariant';
import type { MaterialInstance } from './MaterialInstance';

export class ShaderCache {
  private static readonly IdPool: IdPool = new IdPool();
  private static readonly cache: Record<string, ShaderVariant> = {};

  private static createCacheKey(options: ShaderVariantOptions): string {
    // @TODO make this more performant. Can blendingmode type be a numeric enum value?
    return [
      options.blendingMode.type,
      options.hasDiffuseColor,
      options.hasDiffuseTexture,
      options.hasSkin,
      options.hasVertexColors,
      options.unlit,
      options.hasReflection,
    ].join('|');
  }

  public static getOrCreate(engine: IEngine, primitiveDefinition: MeshPrimitiveDefinition, material: MaterialInstance): ShaderVariant {
    const options: ShaderVariantOptions = {
      blendingMode: material.blendingMode,
      hasDiffuseColor: material.diffuseColor !== undefined,
      hasDiffuseTexture: material.diffuseTexture !== undefined,
      // @NOTE @ASSUMPTION if skin attributes are defined then ModelPartDefinition has a skin defined
      hasSkin: primitiveDefinition.joints0Data !== undefined && primitiveDefinition.weights0Data !== undefined,
      hasVertexColors: primitiveDefinition.color0Data !== undefined,
      unlit: material.unlit,
      hasReflection: material.reflectionCubemap !== undefined,
    };

    const cacheKey = ShaderCache.createCacheKey(options);

    // Lookup shader in cache
    const existingShader = ShaderCache.cache[cacheKey];
    if (existingShader !== undefined) {
      return existingShader;
    } else {
      // Create new shader and add to cache
      const newShaderId = ShaderCache.IdPool.createNew();
      const newShader = new ShaderVariant(engine, newShaderId, material.shader, options);
      ShaderCache.cache[cacheKey] = newShader;
      return newShader;
    }
  }
}

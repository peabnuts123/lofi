import type { IEngine } from '@polyzone/engine/Engine';
import { IdPool } from '@polyzone/engine/util/IdPool';
import type { MeshPrimitiveDefinition } from '@polyzone/engine/loaders/definitions';


import { ShaderVariant, type ShaderVariantOptions } from './ShaderProgram';
import type { Material } from './Material';

export class ShaderCache {
  private static readonly IdPool: IdPool = new IdPool();
  private static readonly cache: Record<string, ShaderVariant> = {};
  /**
   * List of properties we know we are referencing in the generation of a cache key.
   */
  private static readonly KnownCacheProperties: (keyof ShaderVariantOptions)[] = [
    'blendingMode',
    'hasDiffuseColor',
    'hasDiffuseTexture',
    'hasSkin',
    'hasVertexColors',
    'unlit',
  ];

  private static createCacheKey(options: ShaderVariantOptions): string {
    /*
     * @NOTE
     * Simple fail-safe to make sure we never cache a shader without referencing a property.
     * We just maintain a list of properties that we "know" we are using in the generation
     * of the cache key, and validate that against all keys on the options object.
     * If somebody adds a new key to `ShaderProgramOptions` without updating this logic,
     * this will produce a warning.
     */
    const missingKeys: (keyof ShaderVariantOptions)[] = [];
    for (const optionsKey of Object.keys(options) as (keyof ShaderVariantOptions)[]) {
      if (!ShaderCache.KnownCacheProperties.includes(optionsKey)) {
        missingKeys.push(optionsKey);
      }
    }
    if (missingKeys.length > 0) {
      console.warn(`[${ShaderCache.name}] (${this.createCacheKey.name}) WARNING: Unused properties from 'options' object: `, missingKeys);
    }

    return [
      options.blendingMode.type,
      options.hasDiffuseColor,
      options.hasDiffuseTexture,
      options.hasSkin,
      options.hasVertexColors,
      options.unlit,
    ].join('|');
  }

  public static getOrCreate(engine: IEngine, primitiveDefinition: MeshPrimitiveDefinition, material: Material): ShaderVariant {
    const options: ShaderVariantOptions = {
      blendingMode: material.blendingMode,
      hasDiffuseColor: material?.diffuseColor !== undefined,
      hasDiffuseTexture: material?.diffuseTexture !== undefined,
      // @NOTE @ASSUMPTION if skin attributes are defined then NodeDefinition has a skin defined
      hasSkin: primitiveDefinition.joints0Data !== undefined && primitiveDefinition.weights0Data !== undefined,
      hasVertexColors: primitiveDefinition.color0Data !== undefined,
      unlit: material.unlit,
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

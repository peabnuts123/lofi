import type { IEngine } from '@polyzone/engine/Engine';
import { IdPool } from '@polyzone/engine/util/IdPool';
import type { MeshPrimitiveDefinition } from '@polyzone/engine/loaders/definitions';

import VertexShaderSource from '@polyzone/engine/materials/shaders/newShader.vert?raw';
import FragmentShaderSource from '@polyzone/engine/materials/shaders/newShader.frag?raw';

import { ShaderProgram, type ShaderProgramArgs, type ShaderProgramOptions } from './ShaderProgram';
import type { Material } from './Material';

export class ShaderCache {
  private static readonly IdPool: IdPool = new IdPool();
  private static readonly cache: Record<string, ShaderProgram> = {};
  /**
   * List of properties we know we are referencing in the generation of a cache key.
   */
  private static readonly KnownCacheProperties: (keyof ShaderProgramOptions)[] = [
    'blendingMode',
    'hasDiffuseColor',
    'hasDiffuseTexture',
    'hasSkin',
    'hasVertexColors',
    'unlit',
  ];

  private static createCacheKey(options: ShaderProgramOptions): string {
    /*
     * @NOTE
     * Simple fail-safe to make sure we never cache a shader without referencing a property.
     * We just maintain a list of properties that we "know" we are using in the generation
     * of the cache key, and validate that against all keys on the options object.
     * If somebody adds a new key to `ShaderProgramOptions` without updating this logic,
     * this will produce a warning.
     */
    const missingKeys: (keyof ShaderProgramOptions)[] = [];
    for (const optionsKey of Object.keys(options) as (keyof ShaderProgramOptions)[]) {
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

  public static create(engine: IEngine, primitiveDefinition: MeshPrimitiveDefinition, material: Material): ShaderProgram {
    const args: ShaderProgramArgs = {
      vertexShaderSource: VertexShaderSource,
      fragmentShaderSource: FragmentShaderSource,
    };
    const options: ShaderProgramOptions = {
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
      const newShader = new ShaderProgram(engine, newShaderId, args, options);
      ShaderCache.cache[cacheKey] = newShader;
      return newShader;
    }
  }
}

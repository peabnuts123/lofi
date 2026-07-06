import { IdPool } from '@lofi/core/util/IdPool';
import type { IEngine } from '@lofi/engine/Engine';
import type { MeshPrimitiveGeometry } from '@lofi/engine/models/geometry';

import { ShaderVariant } from './ShaderVariant';
import { MaterialInstance } from './MaterialInstance';
import { ShaderBlendingModeTypeEnumValue } from './ShaderBlendingMode';

export class ShaderCache {
  private static readonly IdPool: IdPool = new IdPool();
  private static readonly cache: Map<number, ShaderVariant> = new Map();

  public static getOrCreate(engine: IEngine, primitiveGeometry: MeshPrimitiveGeometry, material: MaterialInstance): ShaderVariant {
    const cacheKey = ShaderCache.createCacheKey(primitiveGeometry, material);

    // Lookup shader in cache
    const existingShader = ShaderCache.cache.get(cacheKey);
    if (existingShader !== undefined) {
      return existingShader;
    } else {
      const options = {
      blendingMode: material.blendingMode,
      hasDiffuseColor: material.diffuseColor !== undefined,
      hasDiffuseTexture: material.diffuseTexture !== undefined && primitiveGeometry.vertexTextureCoordinates !== undefined,
      // @NOTE @ASSUMPTION if skin attributes are defined then ModelPartDefinition has a skin defined
      hasSkin: primitiveGeometry.jointIndices !== undefined && primitiveGeometry.jointWeights !== undefined,
      hasVertexColors: primitiveGeometry.vertexColors !== undefined,
      unlit: material.unlit,
      hasReflection: material.reflectionCubemap !== undefined,
    };
      // Create new shader and add to cache
      const newShaderId = ShaderCache.IdPool.createNew();
      const newShader = new ShaderVariant(engine, newShaderId, material.shader, options);
      ShaderCache.cache.set(cacheKey, newShader);
      return newShader;
    }
  }

  public static createCacheKey(primitiveGeometry: MeshPrimitiveGeometry, material: MaterialInstance): number {
    const blendingMode = ShaderBlendingModeTypeEnumValue[material.blendingMode.type];
    const hasDiffuseColor = material.diffuseColor !== undefined;
    const hasDiffuseTexture = material.diffuseTexture !== undefined && primitiveGeometry.vertexTextureCoordinates !== undefined;
    // @NOTE @ASSUMPTION if skin attributes are defined then ModelPart has a skin defined
    const hasSkin = primitiveGeometry.jointIndices !== undefined && primitiveGeometry.jointWeights !== undefined;
    const hasVertexColors = primitiveGeometry.vertexColors !== undefined;
    const unlit = material.unlit;
    const hasReflection = material.reflectionCubemap !== undefined;

    // @TODO BYO shader will need to key off IShader.id or similar.

    return (
      // @NOTE Limited to 3 bits since `blendingMode.type` currently has <8 values
      /* bits 0-2 */ blendingMode |
      // @ts-expect-error Shifting a boolean is fine
      /* bit 3   */ (hasDiffuseColor << 3) |
      // @ts-expect-error Shifting a boolean is fine
      /* bit 4   */ (hasDiffuseTexture << 4) |
      // @ts-expect-error Shifting a boolean is fine
      /* bit 5   */ (hasSkin << 5) |
      // @ts-expect-error Shifting a boolean is fine
      /* bit 6   */ (hasVertexColors << 6) |
      // @ts-expect-error Shifting a boolean is fine
      /* bit 7   */ (unlit << 7) |
      // @ts-expect-error Shifting a boolean is fine
      /* bit 8   */ (hasReflection << 8)
    );
  }
}

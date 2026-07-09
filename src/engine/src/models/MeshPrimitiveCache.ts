import type { IEngine } from "@lofi/engine/Engine";
import type {
  MeshPrimitiveDefinition,
} from "@lofi/engine/loaders/definitions";
import { MaterialInstance, ShaderBlendingModeTypeEnumValue } from "@lofi/engine/materials";

import { MeshPrimitive } from "./MeshPrimitive";
import { MeshPrimitiveGeometry } from "./geometry";

type MaterialCacheKey = number;

/*
  @TODO Low Level API backlog
  // - Approximate BB is still listening to eg part rotations it should probably have next to no dependencies
  // - Approximate AABB should only apply to unskinned models
  // - Skinned normals need to be normalized as if using homogenous coordinates I think
  // - Expose these types from a public place (i.e. iterating model => modelpart => meshprim)
  // - Split types up into separate files
  // - Should probably split ModelPart and Model geometries into X and XComputed
  - Have a go writing some unit tests but probably don't exhaust it
  // - AABB is not correct for cylindrical object (?) is it being aggregated instead of computed?
 */

/**
 * Cache that holds {@linkcode MeshPrimitive} instances.
 * Since a {@linkcode MeshPrimitive}'s internal definition alters based on what properties are
 * enabled on the material it is drawn with, this cache ensures unique permutations of
 * {@linkcode MeshPrimitiveDefinition} + {@linkcode MaterialInstance} are cached and only regenerated when needed,
 * based on the unique structure of the {@linkcode MaterialInstance}.
 */
export class MeshPrimitiveCache {
  private readonly engine: IEngine;
  private readonly cache: Map<MaterialCacheKey, MeshPrimitive>;
  public readonly geometry: MeshPrimitiveGeometry;

  public constructor(engine: IEngine, definition: MeshPrimitiveDefinition) {
    this.engine = engine;
    this.cache = new Map();
    this.geometry = new MeshPrimitiveGeometry(engine, definition);
  }

  /**
   * Get a {@linkcode MeshPrimitive} instance from the cache for the material with
   * which it will be drawn.
   * @param materialInstance The material with which the primitive will be drawn.
   */
  public getOrCreate(materialInstance: MaterialInstance): MeshPrimitive {
    // Calculate "structural" key of material
    const materialStructuralCacheKey = this.createMaterialInstanceStructuralKey(materialInstance);

    const cachedResult = this.cache.get(materialStructuralCacheKey);
    if (cachedResult) {
      // Cache hit
      return cachedResult;
    } else {
      // Cache miss - create new instances and store in cache
      // console.log(`[${MeshPrimitiveCache.name}] (${this.getOrCreate.name}) Cache MISS with structural key ${materialStructuralCacheKey}`);

      const newInstance = MeshPrimitive.fromDefinition(this.engine, this.geometry, materialInstance);
      this.cache.set(materialStructuralCacheKey, newInstance);

      return newInstance;
    }
  }

  /**
   * Create a key for the cache that uniquely identifies a material instance based on its
   * structural properties (i.e. which features are enabled), rather than by reference or the
   * value of its properties. This ensures that {@linkcode MeshPrimitive} instances are only regenerated
   * when the material's structure changes.
   * @param materialInstance Material from which to create a key.
   * @returns A string cache key representing the structural configuration of the resolved material.
   */
  private createMaterialInstanceStructuralKey(material: MaterialInstance): MaterialCacheKey {
    const blendingMode = ShaderBlendingModeTypeEnumValue[material.blendingMode.type];
    const hasDiffuseColor = material.diffuseColor !== undefined;
    const hasDiffuseTexture = material.diffuseTexture !== undefined && this.geometry.texCoord0Attribute !== undefined;
    // @NOTE @ASSUMPTION if skin attributes are defined then ModelPart has a skin defined
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
        /* bit 5   */ (unlit << 5) |
        // @ts-expect-error Shifting a boolean is fine
        /* bit 6   */ (hasReflection << 6)
    );
  }
}

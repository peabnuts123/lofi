import { Color4 } from '@lofi/core/math/Color4';
import type { Color3 } from '@lofi/core/math/Color3';
import { Texture } from '@lofi/engine/textures/Texture';
import type { IEngine } from '@lofi/engine/Engine';
import type { MaterialDefinition } from '@lofi/engine/loaders/definitions';

import { ShaderBlendingMode } from './ShaderBlendingMode';

export interface MaterialConstructorOptions {
  diffuseColor?: Color4 | undefined | 'unset';
  diffuseTexture?: Texture | undefined | 'unset';
  emissionColor?: Color3 | undefined | 'unset';
  unlit?: boolean | undefined | 'unset';
  blendingMode?: ShaderBlendingMode | undefined | 'unset';
}

export class Material {
  public static readonly DefaultMaterial = new Material();

  public diffuseColor: Color4 | undefined | 'unset';
  public diffuseTexture: Texture | undefined | 'unset';
  public emissionColor: Color3 | undefined | 'unset';
  public unlit: boolean | undefined | 'unset';
  public blendingMode: ShaderBlendingMode | undefined | 'unset';

  /**
   *
   * @param options Material options. Use `"unset"` to specify a property should be empty.
   * @example
   * ```typescript
   * const redUntextured = new Material({
   *   diffuseColor: Color4.red(), // Override diffuse color.
   *   diffuseTexture: "unset",    // No texture, even if applying in "override" mode.
   * });
   * ```
   */
  public constructor(options?: MaterialConstructorOptions) {
    options ??= {};

    const {
      diffuseColor,
      diffuseTexture,
      emissionColor,
      unlit,
      blendingMode,
    } = options;


    this.diffuseColor = diffuseColor;
    this.diffuseTexture = diffuseTexture;
    this.emissionColor = emissionColor;
    this.unlit = unlit;
    this.blendingMode = blendingMode;
  }

  public static async fromDefinition(engine: IEngine, definition: MaterialDefinition): Promise<Material> {
    const material = new Material();

    /* Diffuse color */
    if (definition.diffuseColor !== undefined) {
      material.diffuseColor = definition.diffuseColor;
    }

    /* Diffuse texture */
    if (definition.diffuseTexture !== undefined) {
      material.diffuseTexture = await Texture.loadFromBuffer(engine, definition.diffuseTexture.buffer);
    }

    /* Blending mode */
    switch (definition.alpha.mode) {
      case 'OPAQUE':
        material.blendingMode = ShaderBlendingMode.None();
        break;
      case 'BLEND':
        material.blendingMode = ShaderBlendingMode.AlphaBlend();
        break;
      case 'MASK':
        material.blendingMode = ShaderBlendingMode.AlphaClip(definition.alpha.cutoff);
        break;
      default:
        throw new Error(`Unimplemented alpha mode: ${(definition.alpha as { mode: unknown }).mode}`);
    }

    return material;
  }
}

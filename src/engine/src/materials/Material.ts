import  { Color4 } from '@lopoly/core/math/Color4';
import  { Observable } from '@lopoly/core/util/Observable';
import  { Texture, Cubemap } from '@lopoly/engine/textures';
import  type { IEngine } from '@lopoly/engine/Engine';
import  type { MaterialDefinition } from '@lopoly/engine/loaders/definitions';

import { ShaderBlendingMode } from './ShaderBlendingMode';

export type Unset = 'unset';

export interface MaterialConstructorOptions {
  diffuseColor?: Color4 | undefined | Unset;
  diffuseTexture?: Texture | undefined | Unset;
  unlit?: boolean | undefined | Unset;
  blendingMode?: ShaderBlendingMode | undefined | Unset;
  reflectionCubemap?: Cubemap | undefined | Unset;
  reflectionIntensity?: number | undefined | Unset;
}

export class Material extends Observable {
  public static readonly DefaultMaterial = new Material();

  private _diffuseColor: Color4 | undefined | Unset;
  private _diffuseTexture: Texture | undefined | Unset;
  private _unlit: boolean | undefined | Unset;
  private _blendingMode: ShaderBlendingMode | undefined | Unset;
  private _reflectionCubemap: Cubemap | undefined | Unset;
  private _reflectionIntensity: number | undefined | Unset;

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
    super();
    options ??= {};

    const {
      diffuseColor,
      diffuseTexture,
      unlit,
      blendingMode,
      reflectionCubemap,
      reflectionIntensity,
    } = options;


    this.diffuseColor = diffuseColor;
    this.diffuseTexture = diffuseTexture;
    this.unlit = unlit;
    this.blendingMode = blendingMode;
    this.reflectionCubemap = reflectionCubemap;
    this.reflectionIntensity = reflectionIntensity;
  }

  public static async fromDefinition(engine: IEngine, definition: MaterialDefinition): Promise<Material> {
    const material = new Material();

    /* Diffuse color */
    if (definition.diffuseColor !== undefined) {
      material._diffuseColor = definition.diffuseColor;
    }

    /* Diffuse texture */
    if (definition.diffuseTexture !== undefined) {
      material._diffuseTexture = await Texture.loadFromBuffer(engine, definition.diffuseTexture.buffer);
    }

    /* Blending mode */
    switch (definition.alpha.mode) {
      case 'OPAQUE':
        material._blendingMode = ShaderBlendingMode.None();
        break;
      case 'BLEND':
        material._blendingMode = ShaderBlendingMode.AlphaBlend();
        break;
      case 'MASK':
        material._blendingMode = ShaderBlendingMode.AlphaClip(definition.alpha.cutoff);
        break;
      default:
        throw new Error(`Unimplemented alpha mode: ${(definition.alpha as { mode: unknown }).mode}`);
    }

    return material;
  }


  public get diffuseColor(): Color4 | undefined | Unset { return this._diffuseColor; }
  public set diffuseColor(value: Color4 | undefined | Unset) {
    this._diffuseColor = value;
    this.notifyOnChange();
  }
  public get diffuseTexture(): Texture | undefined | Unset { return this._diffuseTexture; }
  public set diffuseTexture(value: Texture | undefined | Unset) {
    this._diffuseTexture = value;
    this.notifyOnChange();
  }
  public get unlit(): boolean | undefined | Unset { return this._unlit; }
  public set unlit(value: boolean | undefined | Unset) {
    this._unlit = value;
    this.notifyOnChange();
  }
  public get blendingMode(): ShaderBlendingMode | undefined | Unset { return this._blendingMode; }
  public set blendingMode(value: ShaderBlendingMode | undefined | Unset) {
    this._blendingMode = value;
    this.notifyOnChange();
  }
  public get reflectionCubemap(): Cubemap | undefined | Unset { return this._reflectionCubemap; }
  public set reflectionCubemap(value: Cubemap | undefined | Unset) {
    this._reflectionCubemap = value;
    this.notifyOnChange();
  }
  public get reflectionIntensity(): number | undefined | Unset { return this._reflectionIntensity; }
  public set reflectionIntensity(value: number | undefined | Unset) {
    this._reflectionIntensity = value;
    this.notifyOnChange();
  }
}

import  { IdPool } from '@lopoly/core/util/IdPool';
import  { Color4 } from '@lopoly/core/math/Color4';
import  { Texture, Cubemap } from '@lopoly/engine/textures';

import  VertexShaderSource from '@lopoly/engine/materials/shaders/shader.vert';
import  FragmentShaderSource from '@lopoly/engine/materials/shaders/shader.frag';

import { ShaderBlendingMode } from './ShaderBlendingMode';
import { DefaultShader, type IShader } from './ShaderVariant';
import { Material } from './Material';
import  { clamp01 } from '@lopoly/core/math/util';

export const MaterialDefaults = {
  unlit: false,
  blendingMode: ShaderBlendingMode.None(),
  diffuseColor: undefined,
  diffuseTexture: undefined,
  reflectionCubemap: undefined,
  reflectionIntensity: 0.5,
};

const DefaultShaderInstance = new DefaultShader(
  VertexShaderSource,
  FragmentShaderSource,
);
export class MaterialInstance {
  private static readonly IdPool: IdPool = new IdPool();
  public static readonly DefaultMaterial = MaterialInstance.fromMaterial(Material.DefaultMaterial);
  public readonly id: number;

  public readonly shader: IShader;

  private _diffuseColor: Color4 | undefined;
  private _diffuseTexture: Texture | undefined;
  private _unlit: boolean;
  private _blendingMode: ShaderBlendingMode;
  private _reflectionCubemap: Cubemap | undefined;
  private _reflectionIntensity: number;

  public constructor() {
    this.id = MaterialInstance.IdPool.createNew();

    // @TODO BYO shader.
    this.shader = DefaultShaderInstance;

    this._diffuseColor = MaterialDefaults.diffuseColor;
    this._diffuseTexture = MaterialDefaults.diffuseTexture;
    this._unlit = MaterialDefaults.unlit;
    this._blendingMode = MaterialDefaults.blendingMode;
    this._reflectionCubemap = MaterialDefaults.reflectionCubemap;
    this._reflectionIntensity = MaterialDefaults.reflectionIntensity;
  }

  public static fromMaterial(material: Material): MaterialInstance {
    const instance = new MaterialInstance();
    instance.overrideWith(material);
    return instance;
  }

  /**
   * Replace all material properties on this material instance
   * with the material properties on {@linkcode material}, including unspecified
   * or unset properties.
   * @param material
   */
  public replaceWith(material: Material): void {
    this.diffuseColor = MaterialDefaults.diffuseColor;
    this.diffuseTexture = MaterialDefaults.diffuseTexture;
    this.unlit = MaterialDefaults.unlit;
    this.blendingMode = MaterialDefaults.blendingMode;
    this.reflectionCubemap = MaterialDefaults.reflectionCubemap;
    this.reflectionIntensity = MaterialDefaults.reflectionIntensity;
    this.overrideWith(material);
  }

  /**
   * Override material properties on this material instance
   * with any material properties specified in {@linkcode material}.
   * Any properties not specified on {@linkcode material} are ignored.
   * @param material
   */
  public overrideWith(material: Material): void {
    /* Diffuse color */
    if (material.diffuseColor === 'unset') {
      this.diffuseColor = MaterialDefaults.diffuseColor;
    } else if (material.diffuseColor !== undefined) {
      this.diffuseColor = material.diffuseColor;
    }

    /* Diffuse texture */
    if (material.diffuseTexture === 'unset') {
      this.diffuseTexture = MaterialDefaults.diffuseTexture;
    } else if (material.diffuseTexture !== undefined) {
      this.diffuseTexture = material.diffuseTexture;
    }

    /* Unlit */
    if (material.unlit === 'unset') {
      this.unlit = MaterialDefaults.unlit;
    } else if (material.unlit !== undefined) {
      this.unlit = material.unlit;
    }

    /* Blending mode */
    if (material.blendingMode === 'unset') {
      this.blendingMode = MaterialDefaults.blendingMode;
    } else if (material.blendingMode !== undefined) {
      this.blendingMode = material.blendingMode;
    }

    /* Reflection - cubemap */
    if (material.reflectionCubemap === 'unset') {
      this.reflectionCubemap = MaterialDefaults.reflectionCubemap;
    } else if (material.reflectionCubemap !== undefined) {
      this.reflectionCubemap = material.reflectionCubemap;
    }

    /* Reflection - intensity */
    if (material.reflectionIntensity === 'unset') {
      this.reflectionIntensity = MaterialDefaults.reflectionIntensity;
    } else if (material.reflectionIntensity !== undefined) {
      this.reflectionIntensity = material.reflectionIntensity;
    }
  }

  public get diffuseColor(): Color4 | undefined { return this._diffuseColor; }
  private set diffuseColor(value: Color4 | undefined) { this._diffuseColor = value; }
  public get diffuseTexture(): Texture | undefined { return this._diffuseTexture; }
  private set diffuseTexture(value: Texture | undefined) { this._diffuseTexture = value; }
  public get unlit(): boolean { return this._unlit; }
  private set unlit(value: boolean) { this._unlit = value; }
  public get blendingMode(): ShaderBlendingMode { return this._blendingMode; }
  private set blendingMode(value: ShaderBlendingMode) { this._blendingMode = value; }
  public get reflectionCubemap(): Cubemap | undefined { return this._reflectionCubemap; }
  public set reflectionCubemap(value: Cubemap | undefined) { this._reflectionCubemap = value; }
  public get reflectionIntensity(): number { return this._reflectionIntensity; }
  public set reflectionIntensity(value: number) { this._reflectionIntensity = clamp01(value); }
}

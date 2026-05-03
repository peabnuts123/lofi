import { IdPool } from '@lofi/core/util/IdPool';
import { Color4 } from '@lofi/core/math/Color4';
import type { Color3 } from '@lofi/core/math/Color3';
import { Texture } from '@lofi/engine/textures/Texture';

import VertexShaderSource from '@lofi/engine/materials/shaders/shader.vert';
import FragmentShaderSource from '@lofi/engine/materials/shaders/shader.frag';

import { ShaderBlendingMode } from './ShaderBlendingMode';
import { DefaultShader, type IShader } from './ShaderVariant';
import type { Material } from './Material';


export interface MaterialInstanceConstructorOptions {
  diffuseColor: Color4 | undefined;
  diffuseTexture: Texture | undefined;
  emissionColor: Color3 | undefined;
  unlit: boolean;
  blendingMode: ShaderBlendingMode;
}

export const MaterialDefaults: MaterialInstanceConstructorOptions = {
  diffuseColor: undefined,
  diffuseTexture: undefined,
  emissionColor: undefined,
  unlit: false,
  blendingMode: ShaderBlendingMode.None(),
};

export class MaterialInstance {
  private static readonly IdPool: IdPool = new IdPool();
  public readonly id: number;

  public shader: IShader;

  public _diffuseColor: Color4 | undefined;
  public _diffuseTexture: Texture | undefined;
  public _emissionColor: Color3 | undefined;
  public _unlit: boolean;
  public _blendingMode: ShaderBlendingMode;

  public constructor({
    diffuseColor,
    diffuseTexture,
    emissionColor,
    unlit,
    blendingMode,
  }: MaterialInstanceConstructorOptions) {
    this.id = MaterialInstance.IdPool.createNew();

    this.shader = new DefaultShader(
      VertexShaderSource,
      FragmentShaderSource,
    );

    this._diffuseColor = diffuseColor;
    this._diffuseTexture = diffuseTexture;
    this._emissionColor = emissionColor;
    this._unlit = unlit;
    this._blendingMode = blendingMode;
  }

  public static fromMaterial(material: Material): MaterialInstance {
    const instance = new MaterialInstance(MaterialDefaults);
    instance.applyOverride(material);
    return instance;
  }

  public applyOverride(overrides: Material): void {
    /* Diffuse color */
    if (overrides.diffuseColor === 'unset') {
      this.diffuseColor = MaterialDefaults.diffuseColor;
    } else if (overrides.diffuseColor !== undefined) {
      this.diffuseColor = overrides.diffuseColor;
    }

    /* Diffuse texture */
    if (overrides.diffuseTexture === 'unset') {
      this.diffuseTexture = MaterialDefaults.diffuseTexture;
    } else if (overrides.diffuseTexture !== undefined) {
      this.diffuseTexture = overrides.diffuseTexture;
    }

    /* Emission color */
    if (overrides.emissionColor === 'unset') {
      this.emissionColor = MaterialDefaults.emissionColor;
    } else if (overrides.emissionColor !== undefined) {
      this.emissionColor = overrides.emissionColor;
    }

    /* Unlit */
    if (overrides.unlit === 'unset') {
      this.unlit = MaterialDefaults.unlit;
    } else if (overrides.unlit !== undefined) {
      this.unlit = overrides.unlit;
    }

    /* Blending mode */
    if (overrides.blendingMode === 'unset') {
      this.blendingMode = MaterialDefaults.blendingMode;
    } else if (overrides.blendingMode !== undefined) {
      this.blendingMode = overrides.blendingMode;
    }
  }

  public get diffuseColor(): Color4 | undefined { return this._diffuseColor; }
  private set diffuseColor(value: Color4 | undefined) { this._diffuseColor = value; }
  public get diffuseTexture(): Texture | undefined { return this._diffuseTexture; }
  private set diffuseTexture(value: Texture | undefined) { this._diffuseTexture = value; }
  public get emissionColor(): Color3 | undefined { return this._emissionColor; }
  private set emissionColor(value: Color3 | undefined) { this._emissionColor = value; }
  public get unlit(): boolean { return this._unlit; }
  private set unlit(value: boolean) { this._unlit = value; }
  public get blendingMode(): ShaderBlendingMode { return this._blendingMode; }
  private set blendingMode(value: ShaderBlendingMode) { this._blendingMode = value; }
}

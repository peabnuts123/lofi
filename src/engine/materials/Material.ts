import { Color4 } from '@polyzone/engine/util/Color4';
import type { Color3 } from '@polyzone/engine/util/Color3';
import { Texture } from '@polyzone/engine/textures/Texture';
import type { IEngine } from '@polyzone/engine/Engine';
import { IdPool } from '@polyzone/engine/util/IdPool';
import type { MaterialDefinition } from '@polyzone/engine/loaders/definitions';

import { ShaderBlendingMode } from './ShaderBlendingMode';

export interface MaterialConstructorOptions {
  diffuseColor?: Color4;
  diffuseTexture?: Texture;
  emissionColor?: Color3;
  unlit?: boolean;
  blendingMode?: ShaderBlendingMode;
}

export class Material {
  private static readonly IdPool: IdPool = new IdPool();

  public readonly id: number;
  public readonly name: string;
  public diffuseColor: Color4 | undefined;
  public diffuseTexture: Texture | undefined;
  public emissionColor: Color3 | undefined; // @TODO ... LOL
  public unlit: boolean;
  public blendingMode: ShaderBlendingMode;

  public constructor(name: string, initialValues?: MaterialConstructorOptions) {
    this.id = Material.IdPool.createNew();
    this.name = name;
    this.diffuseColor = initialValues?.diffuseColor;
    this.diffuseTexture = initialValues?.diffuseTexture;
    this.emissionColor = initialValues?.emissionColor;
    this.unlit = initialValues?.unlit ?? false;
    this.blendingMode = initialValues?.blendingMode ?? ShaderBlendingMode.None();
  }

  public static async fromDefinition(engine: IEngine, definition: MaterialDefinition): Promise<Material> {
    const material = new Material(definition.name);
    if (definition.diffuseColor !== undefined) {
      material.diffuseColor = definition.diffuseColor;
    }
    if (definition.diffuseTexture !== undefined) {
      material.diffuseTexture = await Texture.loadFromBuffer(engine, definition.diffuseTexture.buffer);
    }

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

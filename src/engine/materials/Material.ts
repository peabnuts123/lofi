import { Color4, type Color4Definition } from '@polyzone/engine/util/Color4';
import { Texture } from '@polyzone/engine/textures/Texture';
import type { Engine } from '@polyzone/engine/Engine';

import { ShaderBlendingMode, ShaderProgram } from './ShaderProgram';

export interface MaterialDefinition {
  name: string;
  diffuseColor?: Color4Definition;
  diffuseTexturePath?: string;
  blendingMode?: ShaderBlendingMode;
  blackIsTransparent?: boolean;
  unlit?: boolean;
}

export interface MaterialConstructorOptions {
  diffuseColor?: Color4;
  diffuseTexture?: Texture;
  blendingMode?: ShaderBlendingMode;
  blackIsTransparent?: boolean;
  unlit?: boolean;
}

export class Material {
  public readonly name: string;
  public readonly shader: ShaderProgram;

  public diffuseColor: Color4;
  public diffuseTexture: Texture | undefined;

  private constructor(engine: Engine, name: string, options: MaterialConstructorOptions) {
    this.name = name;
    this.diffuseColor = options.diffuseColor ?? Color4.white();
    this.diffuseTexture = options.diffuseTexture;
    this.shader = new ShaderProgram(engine, name, {
      hasDiffuseTexture: !!options.diffuseTexture,
      blendingMode: options.blendingMode ?? ShaderBlendingMode.None,
      blackIsTransparent: options.blackIsTransparent ?? false,
      unlit: options.unlit ?? false,
    });
  }

  public static async fromDefinition(engine: Engine, definition: MaterialDefinition): Promise<Material> {
    const materialOptions: MaterialConstructorOptions = {};

    // Diffuse color
    if (definition.diffuseColor) {
      materialOptions.diffuseColor = new Color4(
        definition.diffuseColor.r,
        definition.diffuseColor.g,
        definition.diffuseColor.b,
        definition.diffuseColor.a,
      );
    }

    // Diffuse texture
    if (definition.diffuseTexturePath) {
      materialOptions.diffuseTexture = await Texture.load(engine, definition.diffuseTexturePath);
    }

    // Blending
    materialOptions.blendingMode = definition.blendingMode;
    materialOptions.blackIsTransparent = definition.blackIsTransparent;

    // Debug flags
    materialOptions.unlit = definition.unlit;

    return new Material(engine, definition.name, materialOptions);
  }
}

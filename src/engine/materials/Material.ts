import type { Color3 } from '@polyzone/engine/util/color';
import { Texture } from '@polyzone/engine/textures/Texture';
import type { Engine } from '@polyzone/engine/Engine';

import { ShaderProgram } from './ShaderProgram';

export interface MaterialDefinition {
  name: string;
  diffuseColor?: Color3;
  diffuseTexturePath?: string;
}

export interface MaterialConstructorOptions {
  diffuseColor?: Color3;
  diffuseTexture?: Texture;
}

export class Material {
  public readonly name: string;
  public readonly shader: ShaderProgram;

  public diffuseColor: Color3;
  public diffuseTexture: Texture | undefined;

  private constructor(engine: Engine, name: string, options: MaterialConstructorOptions) {
    this.name = name;
    this.diffuseColor = options.diffuseColor ?? { r: 1, g: 1, b: 1 };
    this.diffuseTexture = options.diffuseTexture;
    this.shader = new ShaderProgram(engine, name, {
      hasDiffuseTexture: !!options.diffuseTexture,
    });
  }

  public static async fromDefinition(engine: Engine, definition: MaterialDefinition): Promise<Material> {
    const materialOptions: MaterialConstructorOptions = {};

    // Diffuse color
    materialOptions.diffuseColor = definition.diffuseColor;

    // Diffuse texture
    if (definition.diffuseTexturePath) {
      materialOptions.diffuseTexture = await Texture.load(engine, definition.diffuseTexturePath);
    }

    return new Material(engine, definition.name, materialOptions);
  }
}

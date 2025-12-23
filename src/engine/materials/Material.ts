import type { Color3 } from '@polyzone/engine/util/color';
import type { Texture } from '@polyzone/engine/textures/Texture';

import { ShaderProgram } from './ShaderProgram';

export interface MaterialDefinition {
  name?: string;
  diffuseColor?: Color3;
  diffuseTexturePath?: string;
}

export class Material {
  public readonly name: string;
  public readonly shader: ShaderProgram;

  public diffuseColor: Color3;
  public diffuseTexture: Texture | undefined;

  public constructor(gl: WebGL2RenderingContext, name: string, definition: MaterialDefinition, texture: Texture | undefined) {
    this.name = name;
    this.diffuseColor = definition.diffuseColor ?? { r: 1, g: 1, b: 1 };
    this.diffuseTexture = texture;
    this.shader = new ShaderProgram(gl, name, {
      hasDiffuseTexture: !!texture,
    });
  }
}

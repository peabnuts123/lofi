import { CameraUboIndex } from '@polyzone/engine/scene/nodes/CameraNode';
import { LightingUboIndex } from '@polyzone/engine/scene/SceneLighting';
import type { IEngine } from '@polyzone/engine/Engine';
import type { Enum } from '@polyzone/engine/util/enum';

import VertexShaderSource from './shaders/shader.vert?raw';
import FragmentShaderSource from './shaders/shader.frag?raw';

export const ShaderBlendingMode = {
  None: 0,
  Average: 1,
  Additive: 2,
  Subtractive: 3,
  SourceAlpha: 4,
} as const;
export type ShaderBlendingMode = Enum<typeof ShaderBlendingMode>;

export interface ShaderProgramOptions {
  hasDiffuseTexture: boolean;
  blendingMode: ShaderBlendingMode; // @TODO Should we just pass the material reference?
  blackIsTransparent: boolean;
  unlit: boolean;
}

export class ShaderProgram {
  public readonly name: string;
  public readonly program: WebGLProgram;
  public readonly vertexPositionAttribute: number;
  public readonly vertexColorAttribute: number;
  public readonly vertexNormalAttribute: number;
  public readonly vertexTextureCoordinateAttribute: number;
  public readonly worldMatrixUniform: WebGLUniformLocation;
  public readonly normalMatrixUniform: WebGLUniformLocation;
  public readonly diffuseColorUniform: WebGLUniformLocation;
  public readonly textureSamplerUniform: WebGLUniformLocation | undefined;

  public constructor(engine: IEngine, name: string, options: ShaderProgramOptions) {
    const { gl } = engine;

    this.name = name;
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    const program = gl.createProgram();

    if (!vertexShader || !fragmentShader || !program) {
      throw new Error(`Failed to allocate GL objects`);
    }

    function inject(name: string, injected: string, src: string): string {
      return src.replace(new RegExp(`#pragma\\s+inject\\s*\\(\\s*${name}\\s*\\)\\s*$`, "m"), injected);
    }
    const definesBlock = `#define _ShaderName ${name}\n` + ShaderProgram.getDefinesFromShaderOptions(options)
      .map((define) => `#define ${define}`).join('\n') + '\n';
    const vertexShaderSource = inject('defines', definesBlock, VertexShaderSource);
    gl.shaderSource(vertexShader, vertexShaderSource);
    const fragmentShaderSource = inject('defines', definesBlock, FragmentShaderSource);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    // console.log(`Shader '${name}'\n<VERTEX_SHADER>\n${vertexShaderSource}\n</VERTEX_SHADER>\n<FRAGMENT_SHADER>\n${fragmentShaderSource}\n</FRAGMENT_SHADER>`);

    gl.compileShader(vertexShader);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      const errorMessage = gl.getShaderInfoLog(vertexShader);
      throw new Error(`Failed to compile vertex shader: ${errorMessage}`);
    }
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      const errorMessage = gl.getShaderInfoLog(fragmentShader);
      throw new Error(`Failed to compile fragment shader: ${errorMessage}`);
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const errorMessage = gl.getProgramInfoLog(program);
      throw new Error(`Failed to link GL program: ${errorMessage}`);
    }

    this.program = program;

    this.vertexPositionAttribute = getAttribute(gl, program, 'vertexPosition', true);
    this.vertexColorAttribute = getAttribute(gl, program, 'vertexColor', true);
    this.vertexNormalAttribute = getAttribute(gl, program, 'vertexNormal', true);
    this.vertexTextureCoordinateAttribute = getAttribute(gl, program, 'textureCoord', true);

    this.worldMatrixUniform = getUniform(gl, program, 'worldMatrix', true);
    this.normalMatrixUniform = getUniform(gl, program, 'normalMatrix', true);
    this.diffuseColorUniform = getUniform(gl, program, 'diffuseColor', true);
    this.textureSamplerUniform = getUniform(gl, program, 'sampler', false);

    const cameraUboBlockIndex = gl.getUniformBlockIndex(this.program, "Camera");
    gl.uniformBlockBinding(this.program, cameraUboBlockIndex, CameraUboIndex);
    const lightingUboBlockIndex = gl.getUniformBlockIndex(this.program, "Lighting");
    gl.uniformBlockBinding(this.program, lightingUboBlockIndex, LightingUboIndex);
  }

  private static getDefinesFromShaderOptions(options: ShaderProgramOptions): string[] {
    const defines: string[] = [];

    if (options.hasDiffuseTexture) {
      defines.push('DIFFUSE_TEXTURE');
    }

    switch (options.blendingMode) {
      case ShaderBlendingMode.None:
        /* No blending, will set alpha = 1.0 in shader by default */
        break;
      case ShaderBlendingMode.Average:
        /* Averaged blending. Transparent pixels set to alpha=0.5f for blending */
        defines.push('FIXED_TRANSPARENCY_ALPHA 0.5f');
        break;
      case ShaderBlendingMode.Additive:
        /* Additive blending. Transparent pixels set to alpha=0.0f for blending */
        defines.push('FIXED_TRANSPARENCY_ALPHA 0.0f');
        break;
      case ShaderBlendingMode.Subtractive:
        /* Subtractive blending. Transparent pixels set to alpha=0.0f for blending */
        defines.push('FIXED_TRANSPARENCY_ALPHA 0.0f');
        break;
      case ShaderBlendingMode.SourceAlpha:
        /* Source alpha - do not manipulate shader output alpha */
        defines.push('USE_SOURCE_ALPHA_FOR_TRANSPARENCY');
        break;
      default:
        throw new Error(`Unimplemented blending mode: '${options.blendingMode}'`);
    }

    if (options.blackIsTransparent) {
      defines.push("BLACK_IS_TRANSPARENT");
    }

    if (options.unlit) {
      defines.push("UNLIT");
    }

    return defines;
  }
}


export function getAttribute(gl: WebGL2RenderingContext, program: WebGLShader, attributeName: string, required: true): number;
export function getAttribute(gl: WebGL2RenderingContext, program: WebGLShader, attributeName: string, required: false): number | undefined;
export function getAttribute(gl: WebGL2RenderingContext, program: WebGLShader, attributeName: string, required: boolean): number | undefined {
  const attribute = gl.getAttribLocation(program, attributeName);
  if (attribute < 0) {
    if (required) {
      throw new Error(`Failed to look up attribute location '${attributeName}' in shader`);
    } else {
      return undefined;
    }
  }

  return attribute;
}

export function getUniform(gl: WebGL2RenderingContext, program: WebGLShader, uniformName: string, required: true): WebGLUniformLocation;
export function getUniform(gl: WebGL2RenderingContext, program: WebGLShader, uniformName: string, required: false): WebGLUniformLocation | undefined;
export function getUniform(gl: WebGL2RenderingContext, program: WebGLShader, uniformName: string, required: boolean): WebGLUniformLocation | undefined {
  const uniform = gl.getUniformLocation(program, uniformName);
  if (!uniform) {
    if (required) {
      throw new Error(`Failed to look up uniform location '${uniformName}' in shader`);
    } else {
      return undefined;
    }
  }

  return uniform;
}

import { CameraUboIndex } from '@polyzone/engine/scene/nodes/CameraNode';
import { LightingUboIndex } from '@polyzone/engine/scene/SceneLighting';
import type { IEngine } from '@polyzone/engine/Engine';

import { ShaderBlendingMode } from './ShaderBlendingMode';

export interface ShaderProgramOptions {
  hasDiffuseColor: boolean;
  hasVertexColors: boolean;
  hasDiffuseTexture: boolean;
  blendingMode: ShaderBlendingMode;
  unlit: boolean;
  hasSkin: boolean;
}
export const DefaultShaderProgramOptions: ShaderProgramOptions = {
  hasDiffuseColor: false,
  hasVertexColors: false,
  hasDiffuseTexture: false,
  blendingMode: ShaderBlendingMode.None(),
  unlit: false,
  hasSkin: false,
};

export interface ShaderProgramArgs {
  vertexShaderSource: string;
  fragmentShaderSource: string;
}
export class ShaderProgram {
  public static MaxBones = 64;

  public readonly id: number;

  private readonly gl: WebGL2RenderingContext;
  public readonly program: WebGLProgram;

  public constructor(engine: IEngine, id: number, args: ShaderProgramArgs, options?: Partial<ShaderProgramOptions>) {
    const { gl } = engine;

    this.gl = gl;
    this.id = id;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    const program = this.program = gl.createProgram();

    if (!vertexShader || !fragmentShader || !program) {
      throw new Error(`Failed to allocate GL objects`);
    }

    function inject(name: string, injected: string, src: string): string {
      return src.replace(new RegExp(`#pragma\\s+inject\\s*\\(\\s*${name}\\s*\\)\\s*$`, "m"), injected);
    }
    const definesBlock = `#define _ShaderId ${id}\n` + ShaderProgram.getDefinesFromShaderOptions({
      ...DefaultShaderProgramOptions,
      ...options,
    })
      .map((define) => `#define ${define}`).join('\n') + '\n';
    const vertexShaderSource = inject('defines', definesBlock, args.vertexShaderSource);
    gl.shaderSource(vertexShader, vertexShaderSource);
    const fragmentShaderSource = inject('defines', definesBlock, args.fragmentShaderSource);
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

    const cameraUboBlockIndex = gl.getUniformBlockIndex(this.program, "Camera");
    if (cameraUboBlockIndex !== WebGL2RenderingContext.INVALID_INDEX) {
      gl.uniformBlockBinding(this.program, cameraUboBlockIndex, CameraUboIndex);
    }
    const lightingUboBlockIndex = gl.getUniformBlockIndex(this.program, "Lighting");
    if (lightingUboBlockIndex !== WebGL2RenderingContext.INVALID_INDEX) {
      gl.uniformBlockBinding(this.program, lightingUboBlockIndex, LightingUboIndex);
    }
  }

  public getAttribute(attributeName: string): number | undefined {
    const attribute = this.gl.getAttribLocation(this.program, attributeName);
    if (attribute < 0) {
      return undefined;
    } else {
      return attribute;
    }
  }

  public getUniform(uniformName: string): WebGLUniformLocation | undefined {
    const uniform = this.gl.getUniformLocation(this.program, uniformName);
    if (!uniform) {
      return undefined;
    }

    return uniform;
  }

  private static getDefinesFromShaderOptions(options: ShaderProgramOptions): string[] {
    const defines: string[] = [];

    if (options.hasDiffuseColor) {
      defines.push('DIFFUSE_COLOR');
    }

    if (options.hasVertexColors) {
      defines.push('VERTEX_COLORS');
    }

    if (options.hasSkin) {
      defines.push('SKIN', 'MAX_BONES ' + ShaderProgram.MaxBones);
    }

    if (options.hasDiffuseTexture) {
      defines.push('DIFFUSE_TEXTURE');
    }

    if (options.blendingMode) {
      switch (options.blendingMode.type) {
        case 'None':
          /* No blending, will set alpha = 1.0 in shader by default */
          break;
        case 'Average':
          /* Averaged blending. Transparent pixels set to alpha=0.5f for blending */
          defines.push('FIXED_TRANSPARENCY_ALPHA 0.5f');
          break;
        case 'Additive':
          /* Additive blending. Transparent pixels set to alpha=0.0f for blending */
          defines.push('FIXED_TRANSPARENCY_ALPHA 0.0f');
          break;
        case 'Subtractive':
          /* Subtractive blending. Transparent pixels set to alpha=0.0f for blending */
          defines.push('FIXED_TRANSPARENCY_ALPHA 0.0f');
          break;
        case 'AlphaBlend':
          /* Alpha blend. Do not manipulate shader output alpha */
          defines.push('ALPHA_BLENDING');
          break;
        case 'AlphaClip':
          /* Alpha clip. Pixels with alpha less than the cutoff are discarded, otherwise rendered as opaque */
          defines.push('ALPHA_CLIPPING');
          break;
        default:
          throw new Error(`Unimplemented blending mode: '${(options.blendingMode as { type: unknown }).type}'`);
      }
    }

    if (options.unlit) {
      defines.push("UNLIT");
    }

    return defines;
  }
}

import { CameraUboIndex } from '@polyzone/engine/camera/Camera';
import { LightingUboIndex } from '@polyzone/engine/lighting/Lighting';
import type { Engine } from '@polyzone/engine/Engine';

import VertexShaderSource from './shaders/shader.vert?raw';
import FragmentShaderSource from './shaders/shader.frag?raw';

export interface ShaderProgramOptions {
  hasDiffuseTexture: boolean;
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

  public constructor(engine: Engine, name: string, options: ShaderProgramOptions) {
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
    const definesBlock = ShaderProgram.getDefinesFromShaderOptions(options)
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

    function getAttribute(attributeName: string, required: true): number;
    function getAttribute(attributeName: string, required: false): number | undefined;
    function getAttribute(attributeName: string, required: boolean): number | undefined {
      const attribute = gl.getAttribLocation(program, attributeName);
      if (attribute < 0) {
        if (required) {
          throw new Error(`Failed to look up attribute location '${attributeName}' in shader '${name}'`);
        } else {
          return undefined;
        }
      }

      return attribute;
    }

    function getUniform(uniformName: string, required: true): WebGLUniformLocation;
    function getUniform(uniformName: string, required: false): WebGLUniformLocation | undefined;
    function getUniform(uniformName: string, required: boolean): WebGLUniformLocation | undefined {
      const uniform = gl.getUniformLocation(program, uniformName);
      if (!uniform) {
        if (required) {
          throw new Error(`Failed to look up uniform location '${uniformName}' in shader '${name}'`);
        } else {
          return undefined;
        }
      }

      return uniform;
    }

    this.vertexPositionAttribute = getAttribute('vertexPosition', true);
    this.vertexColorAttribute = getAttribute('vertexColor', true);
    this.vertexNormalAttribute = getAttribute('vertexNormal', true);
    this.vertexTextureCoordinateAttribute = getAttribute('textureCoord', true);

    this.worldMatrixUniform = getUniform('worldMatrix', true);
    this.normalMatrixUniform = getUniform('normalMatrix', true);
    this.diffuseColorUniform = getUniform('diffuseColor', true);
    this.textureSamplerUniform = getUniform('sampler', false);

    const cameraUboBlockIndex = gl.getUniformBlockIndex(this.program, "Camera");
    gl.uniformBlockBinding(this.program, cameraUboBlockIndex, CameraUboIndex);
    const lightingUboBlockIndex = gl.getUniformBlockIndex(this.program, "Lighting");
    gl.uniformBlockBinding(this.program, lightingUboBlockIndex, LightingUboIndex);
  }

  private static getDefinesFromShaderOptions(options: ShaderProgramOptions): string[] {
    const defines: string[] = [];

    if (options.hasDiffuseTexture) {
      defines.push(`DIFFUSE_TEXTURE`);
    }

    return defines;
  }
}

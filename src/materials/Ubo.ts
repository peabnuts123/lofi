import { createBuffer } from "@polyzone/engine/util/createBuffer";
import type { IEngine } from "@polyzone/engine/Engine";

import VertexShaderSource from '@polyzone/engine/materials/shaders/newShader.vert';
import FragmentShaderSource from '@polyzone/engine/materials/shaders/newShader.frag';
import { DefaultShader, ShaderVariant } from "./ShaderVariant";


interface UboBufferProperty {
  index: number;
  offset: number;
}
export class Ubo<TPropertyName extends string> {
  private buffer: WebGLBuffer;
  private propertyInfo: Record<TPropertyName, UboBufferProperty>;

  public constructor(engine: IEngine, uboName: string, uboIndex: number, propertyNames: readonly TPropertyName[]) {
    const { gl } = engine;

    // @NOTE Look up how big the ubo is in bytes to avoid having to hardcode a brittle value.
    // To do this, we create a real shader instance and read from that.
    // The @ASSUMPTION is that Ubo definitions will always be the same size across
    // all shaders and present in the default shader.
    // This is a somewhat brittle assumption, but will work for now. In the future,
    // we may have to develop a more sophisticated, robust system for UBOs.
    const referenceShader = new ShaderVariant(engine, -1, new DefaultShader(
      VertexShaderSource,
      FragmentShaderSource,
    ));

    // Look up UBO size in bytes
    const blockIndex = gl.getUniformBlockIndex(referenceShader.program, uboName);
    const blockSize = gl.getActiveUniformBlockParameter(
      referenceShader.program,
      blockIndex,
      gl.UNIFORM_BLOCK_DATA_SIZE,
    ) as GLuint;

    // Create uniform buffer
    this.buffer = createBuffer(gl, gl.UNIFORM_BUFFER, blockSize, gl.DYNAMIC_DRAW);
    // Set uniform buffer index
    gl.bindBufferBase(gl.UNIFORM_BUFFER, uboIndex, this.buffer);

    // Look up property indices
    const uboVariableIndices = gl.getUniformIndices(
      referenceShader.program,
      propertyNames,
    );
    if (!uboVariableIndices) {
      throw new Error(`Failed to look up uniform indices for property names: ${propertyNames.join(',')}`);
    }
    // Look up property byte offsets
    const uboVariableOffsets = gl.getActiveUniforms(
      referenceShader.program,
      uboVariableIndices,
      gl.UNIFORM_OFFSET,
    ) as GLuint[];
    if (!uboVariableOffsets) {
      throw new Error(`Failed to look up uniform offsets for property names: ${propertyNames.join(',')}`);
    }

    // Aggregate indices + offsets into dictionary
    this.propertyInfo = propertyNames.reduce((curr, next, index) => {
      curr[next] = {
        index: uboVariableIndices[index],
        offset: uboVariableOffsets[index],
      };
      return curr;
    }, {} as Record<TPropertyName, UboBufferProperty>);
  }

  public setProperty<TValue extends AllowSharedBufferSource>(gl: WebGL2RenderingContext, propertyName: TPropertyName, value: TValue): void {
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
    gl.bufferSubData(
      gl.UNIFORM_BUFFER,
      this.propertyInfo[propertyName].offset,
      value,
    );
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
  }
}

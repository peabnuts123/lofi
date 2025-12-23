import { createBuffer } from "@polyzone/engine/util/createBuffer";

import type { ShaderProgram } from "./ShaderProgram";

interface UboBufferProperty {
  index: number;
  offset: number;
}
export class Ubo<TPropertyName extends string> {
  private buffer: WebGLBuffer;
  private propertyInfo: Record<TPropertyName, UboBufferProperty>;

  public constructor(gl: WebGL2RenderingContext, uboName: string, uboIndex: number, propertyNames: readonly TPropertyName[], referenceShader: ShaderProgram) {
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

import  type { Enum } from "@lopoly/core/util/types";

export const BufferUsage = {
  STATIC_DRAW: 0x88E4,
  DYNAMIC_DRAW: 0x88E8,
} as const;
export type BufferUsage = Enum<typeof BufferUsage>;

export const BufferType = {
  ARRAY_BUFFER: 0x8892,
  ELEMENT_ARRAY_BUFFER: 0x8893,
  UNIFORM_BUFFER: 0x8A11,
} as const;
export type BufferType = Enum<typeof BufferType>;

export function createBuffer(gl: WebGL2RenderingContext, bufferType: BufferType, data: AllowSharedBufferSource, usage?: GLenum): WebGLBuffer;
export function createBuffer(gl: WebGL2RenderingContext, bufferType: BufferType, size: GLsizeiptr, usage?: GLenum): WebGLBuffer;
export function createBuffer(gl: WebGL2RenderingContext, bufferType: BufferType, dataOrSize: AllowSharedBufferSource | GLsizeiptr, usage?: GLenum): WebGLBuffer;
export function createBuffer(gl: WebGL2RenderingContext, bufferType: BufferType, dataOrSize: AllowSharedBufferSource | GLsizeiptr, usage: GLenum = BufferUsage.STATIC_DRAW): WebGLBuffer {
  if (
    bufferType !== BufferType.ARRAY_BUFFER &&
    bufferType !== BufferType.ELEMENT_ARRAY_BUFFER &&
    bufferType !== BufferType.UNIFORM_BUFFER
  ) {
    throw new Error(`Invalid buffer type: ${bufferType}`);
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(bufferType, buffer);
  gl.bufferData(bufferType, dataOrSize as BufferSource, usage); // @NOTE Type laundering
  gl.bindBuffer(bufferType, null);

  return buffer;
}

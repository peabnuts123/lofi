/* WebGL2RenderingContext['ARRAY_BUFFER'] */
export type GlArrayBuffer = 0x8892;
export const GlArrayBuffer = 0x8892;
/* WebGL2RenderingContext['ELEMENT_ARRAY_BUFFER'] */
export type GlElementArrayBuffer = 0x8893;
export const GlElementArrayBuffer = 0x8893;
/* WebGL2RenderingContext['UNIFORM_BUFFER'] */
export type GlUniformBuffer = 0x8A11;
export const GlUniformBuffer = 0x8A11;

export type GlBufferEnum = GlArrayBuffer | GlElementArrayBuffer | GlUniformBuffer;

const AllowedBufferTypes: Record<GlBufferEnum, true> = {
  // @NOTE Hard-coded constants since `WebGL2RenderingContext` does not exist in tests :/
  [GlArrayBuffer]: true,
  [GlElementArrayBuffer]: true,
  [GlUniformBuffer]: true,
};

export function createBuffer(gl: WebGL2RenderingContext, bufferType: GlBufferEnum, data: AllowSharedBufferSource, usage?: GLenum): WebGLBuffer;
export function createBuffer(gl: WebGL2RenderingContext, bufferType: GlBufferEnum, size: GLsizeiptr, usage?: GLenum): WebGLBuffer;
export function createBuffer(gl: WebGL2RenderingContext, bufferType: GlBufferEnum, dataOrSize: AllowSharedBufferSource | GLsizeiptr, usage?: GLenum): WebGLBuffer;
export function createBuffer(gl: WebGL2RenderingContext, bufferType: GlBufferEnum, dataOrSize: AllowSharedBufferSource | GLsizeiptr, usage: GLenum = WebGL2RenderingContext.STATIC_DRAW): WebGLBuffer {
  if (!AllowedBufferTypes[bufferType]) {
    throw new Error(`Invalid buffer type: ${bufferType}`);
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(bufferType, buffer);
  gl.bufferData(bufferType, dataOrSize as BufferSource, usage); // @NOTE Type laundering
  gl.bindBuffer(bufferType, null);

  return buffer;
}

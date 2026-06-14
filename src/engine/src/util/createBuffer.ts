const AllowedBufferTypes: Record<GLenum, true> = {
  // @NOTE Hard-coded constants since `WebGL2RenderingContext` does not exist in tests :/
  [0x8892 /* WebGL2RenderingContext['ARRAY_BUFFER'] */]: true,
  [0x8893 /* WebGL2RenderingContext['ELEMENT_ARRAY_BUFFER'] */]: true,
  [0x8A11 /* WebGL2RenderingContext['UNIFORM_BUFFER'] */]: true,
};

export function createBuffer(gl: WebGL2RenderingContext, bufferType: GLenum, data: AllowSharedBufferSource, usage?: GLenum): WebGLBuffer;
export function createBuffer(gl: WebGL2RenderingContext, bufferType: GLenum, size: GLsizeiptr, usage?: GLenum): WebGLBuffer;
export function createBuffer(gl: WebGL2RenderingContext, bufferType: GLenum, dataOrSize: AllowSharedBufferSource | GLsizeiptr, usage?: GLenum): WebGLBuffer;
export function createBuffer(gl: WebGL2RenderingContext, bufferType: GLenum, dataOrSize: AllowSharedBufferSource | GLsizeiptr, usage: GLenum = WebGL2RenderingContext.STATIC_DRAW): WebGLBuffer {
  if (!AllowedBufferTypes[bufferType]) {
    throw new Error(`Invalid buffer type: ${bufferType}`);
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(bufferType, buffer);
  gl.bufferData(bufferType, dataOrSize as BufferSource, usage); // @NOTE Type laundering
  gl.bindBuffer(bufferType, null);

  return buffer;
}

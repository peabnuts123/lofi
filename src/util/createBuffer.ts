export function createBuffer(gl: WebGL2RenderingContext, bufferType: GLenum, data: AllowSharedBufferSource, usage?: GLenum): WebGLBuffer;
export function createBuffer(gl: WebGL2RenderingContext, bufferType: GLenum, size: GLsizeiptr, usage?: GLenum): WebGLBuffer;
export function createBuffer(gl: WebGL2RenderingContext, bufferType: GLenum, dataOrSize: AllowSharedBufferSource | GLsizeiptr, usage?: GLenum): WebGLBuffer;
export function createBuffer(gl: WebGL2RenderingContext, bufferType: GLenum, dataOrSize: AllowSharedBufferSource | GLsizeiptr, usage: GLenum = gl.STATIC_DRAW): WebGLBuffer {
  const AllowedBufferTypes: (keyof WebGL2RenderingContext)[] = [
    'ARRAY_BUFFER',
    'ELEMENT_ARRAY_BUFFER',
    'UNIFORM_BUFFER',
  ];
  if (!AllowedBufferTypes.some((allowedBufferType) => bufferType === gl[allowedBufferType])) {
    throw new Error(`Invalid buffer type. Expected one of: ${AllowedBufferTypes.join(', ')}`);
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(bufferType, buffer);
  gl.bufferData(bufferType, dataOrSize as BufferSource, usage); // @NOTE Type laundering
  gl.bindBuffer(bufferType, null); // @TODO Is this necessary? Should we add a callback or something? Most calls are immediately calling `bindBuffer` again

  return buffer;
}

export class MockWebGlContext /* implements WebGL2RenderingContext */ { // @NOTE Uncomment to let autocomplete fill out mocked method signatures
  public createBuffer(): WebGLBuffer {
    return {};
  }
  public bindBuffer(_target: GLenum, _buffer: WebGLBuffer | null): void { }
  public bufferData(_target: unknown, _srcData: unknown, _usage: unknown, _srcOffset?: unknown, _length?: unknown): void { }
  public bufferSubData(_target: unknown, _dstByteOffset: unknown, _srcData: unknown, _srcOffset?: unknown, _length?: unknown): void { }
  public createShader(_type: GLenum): WebGLShader | null { return {}; }
  public createProgram(): WebGLProgram { return {}; }
  public shaderSource(_shader: WebGLShader, _source: string): void { }
  public compileShader(_shader: WebGLShader): void { }
  public getShaderParameter(_shader: WebGLShader, pname: GLenum): any {
    if (pname === this.COMPILE_STATUS) return true;
    else throw new Error(`Unmocked shader parameter type: ${pname}`);
  }
  public attachShader(_program: WebGLProgram, _shader: WebGLShader): void { }
  public linkProgram(_program: WebGLProgram): void { }
  public getProgramParameter(_program: WebGLProgram, pname: GLenum): any {
    if (pname === this.LINK_STATUS) return true;
    else throw new Error(`Unmocked program parameter type: ${pname}`);
  }
  public getUniformBlockIndex(_program: WebGLProgram, _uniformBlockName: string): GLuint { return 0; }
  public uniformBlockBinding(_program: WebGLProgram, _uniformBlockIndex: GLuint, _uniformBlockBinding: GLuint): void { }
  public getAttribLocation(_program: WebGLProgram, _name: string): GLint { return 0; }
  public getUniformLocation(_program: WebGLProgram, _name: string): WebGLUniformLocation | null { return 0; }
  public createVertexArray(): WebGLVertexArrayObject { return {}; }
  public bindVertexArray(_array: WebGLVertexArrayObject | null): void { }
  public enableVertexAttribArray(_index: GLuint): void { }
  public vertexAttribPointer(_index: GLuint, _size: GLint, _type: GLenum, _normalized: GLboolean, _stride: GLsizei, _offset: GLintptr): void { }



  public readonly COMPILE_STATUS = 0x8B81;
  public readonly LINK_STATUS = 0x8B82;
  public readonly INVALID_INDEX = 0xFFFFFFFF;
}

export function createMockWebGLContext(): WebGL2RenderingContext {
  return new Proxy(new MockWebGlContext(), {
    get(target, property) {
      if (property in target) {
        return (target)[property as keyof MockWebGlContext];
      } else {
        throw new Error(`Property '${String(property)}' is not mocked in ${MockWebGlContext.name}`);
      }
    },
  }) as WebGL2RenderingContext;
}

export class MockWebGlContext /* implements WebGL2RenderingContext */ { // @NOTE Uncomment to let autocomplete fill out mocked method signatures
  public createBuffer(): WebGLBuffer {
    return {};
  }
  public bindBuffer(_target: GLenum, _buffer: WebGLBuffer | null): void { }
  public bufferData(_target: unknown, _srcData: unknown, _usage: unknown, _srcOffset?: unknown, _length?: unknown): void { }
  public bufferSubData(_target: unknown, _dstByteOffset: unknown, _srcData: unknown, _srcOffset?: unknown, _length?: unknown): void { }
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

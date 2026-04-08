import type { IEngine } from "@lofi/engine/Engine";

export class Texture {
  public readonly texture: WebGLTexture;
  private constructor(engine: IEngine, texImage2d: () => void) {
    const { gl } = engine;

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    // @NOTE Callback, assumed to call gl.texImage2D()
    texImage2d();

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  public static async load(engine: IEngine, path: string): Promise<Texture> {
    const { gl } = engine;
    const textureFile = await engine.fileSystem.readFile(path);
    const blob = new Blob([textureFile.bytes as Uint8Array<ArrayBuffer>]);
    const bitmap = await window.createImageBitmap(blob, { imageOrientation: "flipY" });
    return new Texture(engine, () => {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        bitmap,
      );
    });
  }

  public static async loadFromBuffer(engine: IEngine, buffer: Uint8Array): Promise<Texture> {
    const { gl } = engine;
    const blob = new Blob([buffer as Uint8Array<ArrayBuffer>]);
    const bitmap = await window.createImageBitmap(blob, {  });
    return new Texture(engine, () => {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        bitmap,
      );
    });
  }
}

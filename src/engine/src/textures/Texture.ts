import  type { IEngine } from "@lopoly/engine/Engine";

export class Texture {
  public readonly glTexture: WebGLTexture;
  private readonly bitmap: ImageBitmap;

  private constructor(engine: IEngine, bitmap: ImageBitmap) {
    const { gl } = engine;

    this.bitmap = bitmap;
    this.glTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.glTexture);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      bitmap,
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  public static async load(engine: IEngine, path: string): Promise<Texture> {
    const textureFile = await engine.fileSystem.readFile(path);
    const blob = new Blob([textureFile.bytes]);
    const bitmap = await window.createImageBitmap(blob);
    return new Texture(engine, bitmap);
  }

  public static async loadFromBuffer(engine: IEngine, buffer: Uint8Array<ArrayBuffer>): Promise<Texture> {
    const blob = new Blob([buffer]);
    const bitmap = await window.createImageBitmap(blob);
    return new Texture(engine, bitmap);
  }

  public static async decodeBuffer(buffer: Uint8Array<ArrayBuffer>): Promise<ImageData> {
    const blob = new Blob([buffer]);
    const bitmap = await window.createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  }

  public getRawBytes(): ImageData {
    const canvas = new OffscreenCanvas(this.bitmap.width, this.bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(this.bitmap, 0, 0);
    return ctx.getImageData(0, 0, this.bitmap.width, this.bitmap.height);
  }
}

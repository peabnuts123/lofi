export class Texture {
  public readonly texture: WebGLTexture;
  public constructor(gl: WebGL2RenderingContext, texImage2d: () => void) {
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    // @NOTE Callback, assumed to call gl.texImage2D()
    texImage2d();

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  public static async fromBytes(gl: WebGL2RenderingContext, bytes: Uint8Array<ArrayBuffer>): Promise<Texture> {
    const blob = new Blob([bytes]);
    const bitmap = await window.createImageBitmap(blob);
    return new Texture(gl, () => {
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

  public static async fromUrl(gl: WebGL2RenderingContext, url: string): Promise<Texture> {
    const image = new Image();
    image.src = url;

    await new Promise<void>((resolve, reject) => {
      image.onload = (_e) => {
        resolve();
      };
      image.onerror = (_e, _src, _lineno, _colno, err) => {
        reject(new Error(`Failed to load image: ${err}`));
      };
    });

    return new Texture(gl, () => {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );
    });
  }
}

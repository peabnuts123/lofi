import type { IEngine } from "@lofi/engine/Engine";

export class Cubemap {
  public readonly glTexture: WebGLTexture;

  private constructor(engine: IEngine, bitmaps: CubemapParts<ImageBitmap>) {
    const { gl } = engine;

    this.glTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.glTexture);

    const glTexImage2d = (bitmap: ImageBitmap, target: GLenum): void => {
      gl.texImage2D(
        target,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        bitmap,
      );
    };

    // @NOTE WebGL makes assumptions about handedness with its constant names
    // These are corrected in the shader by changing the reflection swizzle
    // I believe we have to do it this way so that textures are rendered
    // not just on the correct axis but also in the correct orientation.
    glTexImage2d(bitmaps.right, gl.TEXTURE_CUBE_MAP_POSITIVE_X);
    glTexImage2d(bitmaps.left, gl.TEXTURE_CUBE_MAP_NEGATIVE_X);
    glTexImage2d(bitmaps.up, gl.TEXTURE_CUBE_MAP_POSITIVE_Y);
    glTexImage2d(bitmaps.down, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y);
    glTexImage2d(bitmaps.forward, gl.TEXTURE_CUBE_MAP_POSITIVE_Z);
    glTexImage2d(bitmaps.back, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z);

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /**
   * Create a {@linkcode Cubemap} from a set of individual texture files.
   * @param engine Engine instance.
   * @param paths Paths for each individual texture.
   */
  public static async loadSeparate(engine: IEngine, paths: CubemapParts<string>): Promise<Cubemap> {
    const bitmaps = await mapCubemapParts(paths, async (path): Promise<ImageBitmap> => {
      const textureFile = await engine.fileSystem.readFile(path);
      const blob = new Blob([textureFile.bytes as Uint8Array<ArrayBuffer>]);
      const bitmap = await window.createImageBitmap(blob);
      return bitmap;
    });

    return new Cubemap(engine, bitmaps);
  }

  /**
   * Create a {@linkcode Cubemap} from a single texture containing six
   * textures in a "box-net" layout.
   * ```
   *     0    1    2    3
   *   ┌────┬────┬────┬────┐
   * 0 │    │ up │    │    │
   *   ├────┼────┼────┼────┤
   * 1 │ lf │ fd │ rt │ bk │
   *   ├────┼────┼────┼────┤
   * 2 │    │ dn │    │    │
   *   └────┴────┴────┴────┘
   * ```
   * @param engine Engine instance.
   * @param path Path to texture file containing the cubemap textures in a box-net layout.
   */
  public static async loadBoxNet(engine: IEngine, path: string): Promise<Cubemap> {
    const textureFile = await engine.fileSystem.readFile(path);
    const blob = new Blob([textureFile.bytes as Uint8Array<ArrayBuffer>]);
    const bitmap = await window.createImageBitmap(blob);

    // Read texture into canvas
    const [canvas, ctx] = Cubemap.loadTextureToCanvas(bitmap);

    // Read specific chunks of image data into set of cubemap parts
    const cellSize = canvas.width / 4;
    const images: CubemapParts<ImageData> = {
      right: Cubemap.readCanvasCell(ctx, 2, 1, cellSize),
      left: Cubemap.readCanvasCell(ctx, 0, 1, cellSize),
      up: Cubemap.readCanvasCell(ctx, 1, 0, cellSize),
      down: Cubemap.readCanvasCell(ctx, 1, 2, cellSize),
      forward: Cubemap.readCanvasCell(ctx, 1, 1, cellSize),
      back: Cubemap.readCanvasCell(ctx, 3, 1, cellSize),
    };

    const bitmaps = await mapCubemapParts(images, async (imageData): Promise<ImageBitmap> => {
      const bitmap = await window.createImageBitmap(imageData);
      return bitmap;
    });

    return new Cubemap(engine, bitmaps);
  }

  /**
   * Read a specific block of raw image data from a canvas.
   * @param ctx 2D canvas rendering context
   * @param cellX X coordinate of the cell to read
   * @param cellY Y coordinate of the cell to read
   * @param cellSize Size (in pixels) of each cell (assumed to be square)
   */
  private static readCanvasCell(ctx: OffscreenCanvasRenderingContext2D, cellX: number, cellY: number, cellSize: number): ImageData {
    return ctx.getImageData(cellX * cellSize, cellY * cellSize, cellSize, cellSize);
  }

  /**
   * Initialise an {@linkcode OffscreenCanvas} with the data of {@linkcode bitmap}.
   * @param bitmap
   */
  private static loadTextureToCanvas(bitmap: ImageBitmap): [OffscreenCanvas, OffscreenCanvasRenderingContext2D] {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0);

    return [canvas, ctx];
  }
}

/**
 * Set of arbitrary data relating to the individual sides of a {@linkcode Cubemap}.
 */
export interface CubemapParts<T> {
  right: T;
  left: T;
  up: T;
  down: T;
  forward: T;
  back: T;
}

/**
 * Map a set of Cubemap data, transforming it from one type to another.
 * @param parts Cubemap data.
 * @param mapFn Function to transform data.
 */
async function mapCubemapParts<TSource, TResult>(parts: CubemapParts<TSource>, mapFn: (source: TSource) => Promise<TResult>): Promise<CubemapParts<TResult>> {
  return {
    right: await mapFn(parts.right),
    left: await mapFn(parts.left),
    up: await mapFn(parts.up),
    down: await mapFn(parts.down),
    back: await mapFn(parts.back),
    forward: await mapFn(parts.forward),
  } satisfies CubemapParts<TResult>;
}

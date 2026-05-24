import type { TypedArray } from "@lofi/core/util/types";

/**
 * Split a typed array into a series of chunks and then map each chunk into
 * a different value.
 * @param buffer Typed array to split
 * @param chunkSize Size of each chunk
 * @param mapFn Map function to convert buffer view into another type
 */
export function mapBufferChunks<TBuffer extends TypedArray, TResult>(buffer: TBuffer, chunkSize: number, mapFn: (args: TBuffer) => TResult): TResult[] {
  const result: TResult[] = [];
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const view = buffer.subarray(i, i + chunkSize) as TBuffer;
    result.push(mapFn(view));
  }
  return result;
}

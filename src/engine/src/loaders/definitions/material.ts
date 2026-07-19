import  type { Color4 } from "@lopoly/core/math/Color4";

export interface MaterialDefinition {
  name: string;
  alpha: { mode: 'OPAQUE' } | { mode: 'BLEND' } | { mode: 'MASK', cutoff: number };
  diffuseColor?: Color4;
  diffuseTexture?: {
    buffer: Uint8Array<ArrayBuffer>;
  },
}

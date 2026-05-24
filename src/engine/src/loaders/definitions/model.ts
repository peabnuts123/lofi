import type { Matrix4 } from "@lofi/core/math/Matrix4";
import type { Quaternion } from "@lofi/core/math/Quaternion";
import type { Vector3 } from "@lofi/core/math/vector";

import type { AnimationDefinition } from "./animation";
import type { MaterialDefinition } from "./material";
import type { VirtualFile } from "@lofi/engine/filesystem";
import type { TypedArray } from "@lofi/core/util/types";

export type AccessorComponentType = (
  WebGL2RenderingContext['BYTE'] |
  WebGL2RenderingContext['UNSIGNED_BYTE'] |
  WebGL2RenderingContext['SHORT'] |
  WebGL2RenderingContext['UNSIGNED_SHORT'] |
  // @NOTE Accessors under the GLTF specification cannot be signed INT
  // See: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#accessor-data-types
  WebGL2RenderingContext['UNSIGNED_INT'] |
  WebGL2RenderingContext['FLOAT']
);
export type MeshPrimitiveMode = (
  WebGL2RenderingContext['POINTS'] |
  WebGL2RenderingContext['LINES'] |
  WebGL2RenderingContext['LINE_LOOP'] |
  WebGL2RenderingContext['LINE_STRIP'] |
  WebGL2RenderingContext['TRIANGLES'] |
  WebGL2RenderingContext['TRIANGLE_STRIP'] |
  WebGL2RenderingContext['TRIANGLE_FAN']
);

export interface ModelDefinitionDependency {
  path: string;
  file: VirtualFile;
}
export interface ModelDefinition {
  rootParts: ModelPartDefinition[];
  animations: AnimationDefinition[]; // @TODO nullable
  // @TODO Consider exposing all the materials in a flat list
  dependencies?: {
    textures?: ModelDefinitionDependency[];
    // @TODO non-texture dependencies (e.g. .bin, .mtl)
  },
}

export interface TransformDefinition {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
}

export interface ModelPartDefinition {
  name: string;
  transform: TransformDefinition;
  children: ModelPartDefinition[];
  mesh?: MeshDefinition;
  skin?: SkinDefinition;
}

export interface MeshDefinition {
  primitives: MeshPrimitiveDefinition[];
}

export interface MeshPrimitiveDefinition {
  /** GL rendering mode e.g. TRIANGLES, LINES, TRIANGLE_FAN, etc. */
  mode: MeshPrimitiveMode;
  positionData: AttributeDefinition;      // VEC3
  // @TODO Make required. Move generation code into loader
  normalData?: AttributeDefinition;       // VEC3
  extents: Extents,
  texCoord0Data?: AttributeDefinition;    // VEC2
  color0Data?: AttributeDefinition;       // VEC3 or VEC4
  joints0Data?: AttributeDefinition;      // VEC4
  weights0Data?: AttributeDefinition;     // VEC4
  indices?: AttributeDefinition,          // SCALAR
  material?: MaterialDefinition;
}

export interface AttributeDefinition {
  /** Raw typed array of data. */
  buffer: TypedArray;
  /** Number of components per element of data. For example, the element size of a Vector2 is 2. */
  componentCount: number;
  /**
   * Number of bytes per component. For example, Float32 is 4 bytes.
   * The full size of an element is calculated as `componentCount * componentSize`.
   */
  componentSize: number;
  /** Type of each component e.g. `FLOAT`, `UNSIGNED_INT`, etc. */
  componentType: AccessorComponentType;
  /**
   * Specifies whether integer data values should be normalized (true) to [0, 1] (for unsigned types)
   * or [-1, 1] (for signed types), or converted directly (false) when they are accessed.
   */
  normalized: boolean;
}

export interface SkinDefinition {
  inverseBindMatrices: Matrix4[];
  jointParts: ModelPartDefinition[];
}

export interface Extents {
  min: Vector3;
  max: Vector3;
}

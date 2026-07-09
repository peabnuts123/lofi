import type { Matrix4 } from "@lofi/core/math/Matrix4";
import type { Quaternion } from "@lofi/core/math/Quaternion";
import type { Vector3 } from "@lofi/core/math/vector";
import type { Enum } from "@lofi/core/util";
import type { VirtualFile } from "@lofi/engine/filesystem";
import type { AxisAlignedBoundingBox } from "@lofi/engine/collision";

import type { AnimationDefinition } from "./animation";
import type { MaterialDefinition } from "./material";

/**
 * Any valid GL data type e.g. `gl.FLOAT`, `gl.UNSIGNED_SHORT`, etc.
 */
export type AccessorComponentType = Enum<typeof AccessorComponentType>;
export const AccessorComponentType = {
  BYTE: 0x1400,
  UNSIGNED_BYTE: 0x1401,
  SHORT: 0x1402,
  UNSIGNED_SHORT: 0x1403,
  // @NOTE Accessors under the GLTF specification cannot be signed INT
  // See: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#accessor-data-types
  UNSIGNED_INT: 0x1405,
  FLOAT: 0x1406,
} as const;

/**
 * Lookup type utility for a GL data type's size in bytes.
 *
 * e.g.
 * ```
 * AccessorComponentTypeSize[typeof AccessorComponentType['FLOAT']] // 4
 * ```
 */
export type AccessorComponentTypeSize = {
  [AccessorComponentType.BYTE]: 1,
  [AccessorComponentType.UNSIGNED_BYTE]: 1,
  [AccessorComponentType.SHORT]: 2,
  [AccessorComponentType.UNSIGNED_SHORT]: 2,
  [AccessorComponentType.UNSIGNED_INT]: 4,
  [AccessorComponentType.FLOAT]: 4,
}
/**
 * Lookup type utility for a GL data type's native buffer type.
 *
 * e.g.
 * ```
 * AccessorComponentBuffer[typeof AccessorComponentType['FLOAT']] // Float32Array
 * ```
 */
export type AccessorComponentBuffer = {
  [AccessorComponentType.BYTE]: Int8Array,
  [AccessorComponentType.UNSIGNED_BYTE]: Uint8Array,
  [AccessorComponentType.SHORT]: Int16Array,
  [AccessorComponentType.UNSIGNED_SHORT]: Uint16Array,
  [AccessorComponentType.UNSIGNED_INT]: Uint32Array,
  [AccessorComponentType.FLOAT]: Float32Array,
}

export type MeshPrimitiveMode = Enum<typeof MeshPrimitiveMode>;
export const MeshPrimitiveMode = {
  POINTS: 0x0000,
  LINES: 0x0001,
  LINE_LOOP: 0x0002,
  LINE_STRIP: 0x0003,
  TRIANGLES: 0x0004,
  TRIANGLE_STRIP: 0x0005,
  TRIANGLE_FAN: 0x0006,
} as const;

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
  extents: AxisAlignedBoundingBox;
  positionData: VertexPositionAttributeDefinition;
  normalData?: VertexNormalAttributeDefinition;
  texCoord0Data?: VertexTextureCoordinateAttributeDefinition;
  color0Data?: VertexColorAttributeDefinition;
  joints0Data?: VertexJointIndicesAttributeDefinition;
  weights0Data?: VertexJointWeightsAttributeDefinition;
  indices?: TriangleIndicesAttributeDefinition,
  material?: MaterialDefinition;
}

// Attribute definitions based on GLTF file format.
// See: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview
export type VertexPositionAttributeDefinition = AttributeDefinition<
  { componentCount: 3 /* Vector3 */ },
  { type: typeof AccessorComponentType['FLOAT'], normalized: false }
>;
export type VertexNormalAttributeDefinition = AttributeDefinition<
  { componentCount: 3 /* Vector3 */ },
  { type: typeof AccessorComponentType['FLOAT'], normalized: false }
>;
export type VertexTextureCoordinateAttributeDefinition = AttributeDefinition<
  { componentCount: 2 /* Vector2 */ },
  { type: typeof AccessorComponentType['FLOAT'], normalized: false } |
  { type: typeof AccessorComponentType['UNSIGNED_BYTE'], normalized: true } |
  { type: typeof AccessorComponentType['UNSIGNED_SHORT'], normalized: true }
>;
export type VertexColorAttributeDefinition = AttributeDefinition<
  { componentCount: 3 /* Color3 */ } | { componentCount: 4 /* Color4 */ },
  { type: typeof AccessorComponentType['FLOAT'], normalized: false } |
  { type: typeof AccessorComponentType['UNSIGNED_BYTE'], normalized: true } |
  { type: typeof AccessorComponentType['UNSIGNED_SHORT'], normalized: true }
>;
export type VertexJointIndicesAttributeDefinition = AttributeDefinition<
  { componentCount: 4 /* JointIndices */ },
  { type: typeof AccessorComponentType['UNSIGNED_BYTE'], normalized: false } |
  { type: typeof AccessorComponentType['UNSIGNED_SHORT'], normalized: false }
>
export type VertexJointWeightsAttributeDefinition = AttributeDefinition<
  { componentCount: 4 /* JointWeights */ },
  { type: typeof AccessorComponentType['FLOAT'], normalized: false } |
  { type: typeof AccessorComponentType['UNSIGNED_BYTE'], normalized: true } |
  { type: typeof AccessorComponentType['UNSIGNED_SHORT'], normalized: true }
>;
// @NOTE Indices attribute lacks an explicit definition in GLTF format specification.
// Closest thing is: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#_accessor_sparse_indices_componenttype
// and quote under 3.7.2.1: "indices accessor MUST NOT contain the maximum possible value for the component type used
// (i.e., 255 for unsigned bytes, 65535 for unsigned shorts, 4294967295 for unsigned ints)."
export type TriangleIndicesAttributeDefinition = AttributeDefinition<
  // @NOTE Indices are stored in an odd way. They specify componentCount: 1 even though
  // they might be drawn as triangles, lines, etc.
  { componentCount: 1 },
  { type: typeof AccessorComponentType['UNSIGNED_BYTE'], normalized: false } |
  { type: typeof AccessorComponentType['UNSIGNED_SHORT'], normalized: false } |
  { type: typeof AccessorComponentType['UNSIGNED_INT'], normalized: false }
>

export type AttributeDefinitionComponentCount = { componentCount: number };
export type AttributeDefinitionType = { type: AccessorComponentType, normalized: boolean };

export type BaseAttributeDefinition<
  ComponentCount extends AttributeDefinitionComponentCount,
  ComponentType extends AttributeDefinitionType,
> = ComponentType extends {
  type: infer TType,
  normalized: infer TNormalized,
}
  ? TType extends AccessorComponentType
  ? TNormalized extends boolean
  ? {
    /** Number of components per element of data. For example, the element size of a Vector2 is 2. */
    componentCount: ComponentCount['componentCount'];
    /**
     * Number of bytes per component. For example, Float32 is 4 bytes.
     * The full size of an element is calculated as `componentCount * componentSize`.
     */
    componentSize: AccessorComponentTypeSize[TType];
    /** Type of each component e.g. `FLOAT`, `UNSIGNED_INT`, etc. */
    componentType: TType;
    /**
     * Specifies whether integer data values should be normalized (true) to [0, 1] (for unsigned types)
     * or [-1, 1] (for signed types), or converted directly (false) when they are accessed.
     */
    normalized: TNormalized;
  }
  : never
  : never
  : never;

export type AnyAttributeDefinition = AttributeDefinition<AttributeDefinitionComponentCount, AttributeDefinitionType>;
export type AttributeDefinition<
  ComponentCount extends AttributeDefinitionComponentCount,
  ComponentType extends AttributeDefinitionType,
> = ComponentType extends {
  type: infer TType,
}
  ? TType extends AccessorComponentType
  ? BaseAttributeDefinition<ComponentCount, ComponentType> & {
    /** Raw typed array of data. */
    buffer: AccessorComponentBuffer[TType];
  }
  : never
  : never;

export interface SkinDefinition {
  inverseBindMatrices: Matrix4[];
  jointParts: ModelPartDefinition[];
}

export interface Extents {
  min: Vector3;
  max: Vector3;
}


import { Vector3, Quaternion, Color4 } from '@lofi/core/math';
import { AccessorComponentType, MeshPrimitiveMode, type MaterialDefinition, type MeshPrimitiveDefinition, type ModelPartDefinition } from '@lofi/engine/loaders/definitions';
import { AxisAlignedBoundingBox } from '@lofi/engine/collision';



export function createMockModelPartDefinition({
  name,
  primitive,
  material,
}: {
  name: string,
  primitive?: MeshPrimitiveDefinition,
  material?: Partial<MaterialDefinition>,
}): ModelPartDefinition {
  return {
    name,
    children: [],
    transform: {
      position: Vector3.zero(),
      rotation: Quaternion.identity(),
      scale: Vector3.one(),
    },
    mesh: {
      primitives: [{
        ...(primitive ?? createCubeMeshPrimitiveDefinition()),
        material: {
          name: 'default',
          alpha: { mode: 'OPAQUE' },
          diffuseColor: Color4.white(),
          ...material,
        },
      }],
    },
  };
}

export interface CreateCubeMeshPrimitiveDefinitionArgs {
  size: number;
}
export const DefaultCreateCubeMeshPrimitiveDefinitionArgs: CreateCubeMeshPrimitiveDefinitionArgs = {
  size: 1,
};
export function createCubeMeshPrimitiveDefinition(options: Partial<CreateCubeMeshPrimitiveDefinitionArgs> = {}): MeshPrimitiveDefinition {
  const opts: CreateCubeMeshPrimitiveDefinitionArgs = {
    ...DefaultCreateCubeMeshPrimitiveDefinitionArgs,
    ...options,
  };
  const halfSize = opts.size / 2;
  return {
    mode: MeshPrimitiveMode.TRIANGLES,
    positionData: {
      componentCount: 3,
      componentType: AccessorComponentType.FLOAT,
      componentSize: 4,
      normalized: false,
      buffer: new Float32Array([
        // Front face
        -halfSize, -halfSize, halfSize,
        halfSize, -halfSize, halfSize,
        halfSize, halfSize, halfSize,
        -halfSize, halfSize, halfSize,

        // Right face
        halfSize, -halfSize, halfSize,
        halfSize, -halfSize, -halfSize,
        halfSize, halfSize, -halfSize,
        halfSize, halfSize, halfSize,

        // Back face
        halfSize, -halfSize, -halfSize,
        -halfSize, -halfSize, -halfSize,
        -halfSize, halfSize, -halfSize,
        halfSize, halfSize, -halfSize,

        // Left face
        -halfSize, -halfSize, -halfSize,
        -halfSize, -halfSize, halfSize,
        -halfSize, halfSize, halfSize,
        -halfSize, halfSize, -halfSize,

        // Top face
        -halfSize, halfSize, halfSize,
        halfSize, halfSize, halfSize,
        halfSize, halfSize, -halfSize,
        -halfSize, halfSize, -halfSize,

        // Bottom face
        -halfSize, -halfSize, -halfSize,
        halfSize, -halfSize, -halfSize,
        halfSize, -halfSize, halfSize,
        -halfSize, -halfSize, halfSize,
      ]),
    },
    extents: new AxisAlignedBoundingBox(
      new Vector3(-halfSize, -halfSize, -halfSize),
      new Vector3(halfSize, halfSize, halfSize),
    ),
    normalData: {
      componentCount: 3,
      componentType: AccessorComponentType.FLOAT,
      componentSize: 4,
      normalized: false,
      buffer: new Float32Array([
        // Front face (pointing towards +Z)
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,

        // Right face (pointing towards +X)
        1.0, 0.0, 0.0,
        1.0, 0.0, 0.0,
        1.0, 0.0, 0.0,
        1.0, 0.0, 0.0,

        // Back face (pointing towards -Z)
        0.0, 0.0, -1.0,
        0.0, 0.0, -1.0,
        0.0, 0.0, -1.0,
        0.0, 0.0, -1.0,

        // Left face (pointing towards -X)
        -1.0, 0.0, 0.0,
        -1.0, 0.0, 0.0,
        -1.0, 0.0, 0.0,
        -1.0, 0.0, 0.0,

        // Top face (pointing towards +Y)
        0.0, 1.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 1.0, 0.0,

        // Bottom face (pointing towards -Y)
        0.0, -1.0, 0.0,
        0.0, -1.0, 0.0,
        0.0, -1.0, 0.0,
        0.0, -1.0, 0.0,
      ]),
    },
    texCoord0Data: {
      componentCount: 2,
      componentType: AccessorComponentType.FLOAT,
      componentSize: 4,
      normalized: false,
      buffer: new Float32Array([
        // Front face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,

        // Right face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,

        // Back face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,

        // Left face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,

        // Top face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,

        // Bottom face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
      ]),
    },
    color0Data: {
      componentCount: 4,
      componentType: AccessorComponentType.UNSIGNED_BYTE,
      componentSize: 1,
      normalized: true,
      buffer: new Uint8Array([
        // Front face
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,

        // Right face
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,

        // Back face
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,

        // Left face
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,

        // Top face
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,

        // Bottom face
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF,
      ]),
    },
    indices: {
      componentCount: 1,
      componentType: AccessorComponentType.UNSIGNED_BYTE,
      componentSize: 1,
      normalized: false,
      buffer: new Uint8Array([
        0, 1, 2,    /**/ 2, 3, 0,    // Front face
        4, 5, 6,    /**/ 6, 7, 4,    // Right face
        8, 9, 10,   /**/ 10, 11, 8,  // Back face
        12, 13, 14, /**/ 14, 15, 12, // Left face
        16, 17, 18, /**/ 18, 19, 16, // Top face
        20, 21, 22, /**/ 22, 23, 20, // Bottom face
      ]),
    },
  };
}

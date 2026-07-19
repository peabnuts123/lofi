
import  { Vector3, Quaternion, Color4 } from '@lopoly/core/math';
import  { AccessorComponentType, MeshPrimitiveMode, type MaterialDefinition, type MeshPrimitiveDefinition, type ModelPartDefinition } from '@lopoly/engine/loaders/definitions';
import  type { IFileSystem } from '@lopoly/engine/filesystem';
import  { AxisAlignedBoundingBox } from '@lopoly/engine/collision';

export class DebugGeometry {
  private readonly fileSystem: IFileSystem;

  public constructor(fileSystem: IFileSystem) {
    this.fileSystem = fileSystem;
  }

  public simplePart({
    name,
    primitive,
    material,
  }: {
    name: string,
    primitive?: Omit<MeshPrimitiveDefinition, 'material'>,
    material?: MaterialDefinition,
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
          ...(primitive ?? this.cubePrimitive()),
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

  public async material({
    name,
    alpha,
    diffuseColor,
    diffuseTexturePath: textureFilePath,
  }: {
    name: string,
    alpha?: MaterialDefinition['alpha'],
    diffuseColor?: Color4,
    diffuseTexturePath?: string,
  }): Promise<MaterialDefinition> {
    let textureBytes: Uint8Array<ArrayBuffer> | undefined = undefined;

    if (textureFilePath) {
      const textureFile = await this.fileSystem.readFile(textureFilePath);
      textureBytes = textureFile.bytes;
    }

    return {
      name,
      alpha: alpha ?? { mode: 'OPAQUE' },
      diffuseColor: diffuseColor ?? Color4.white(),
      diffuseTexture: textureBytes && {
        buffer: textureBytes,
        texCoord: 0,
      },
    };
  }

  public planePrimitive(
    subdivisionsX: number = 1,
    subdivisionsY: number = 1,
    overrides: Partial<MeshPrimitiveDefinition> = {},
  ): MeshPrimitiveDefinition {
    if (subdivisionsX < 1 || subdivisionsY < 1) {
      throw new Error(`Plane primitive subdivisions must be greater than 0`);
    }

    const vertexCountX = subdivisionsX + 1;
    const vertexCountY = subdivisionsY + 1;

    const PlaneDim = 1;
    const PlaneCornerCoord = -(PlaneDim / 2);

    const positionBuffer = new Float32Array(vertexCountX * vertexCountY * 3 /* values per vertex */);
    const normalsBuffer = new Float32Array(positionBuffer.length);
    const indicesBuffer = new Uint32Array(subdivisionsX * subdivisionsY * 2 /* triangles */ * 3 /* indices per triangle */);
    const colorsBuffer = new Float32Array(positionBuffer.length)
    const textureCoordinatesBuffer = new Float32Array(positionBuffer.length);


    for (let y = 0; y < vertexCountY; y++) {
      const yNormalized = y / (vertexCountY - 1);
      for (let x = 0; x < vertexCountX; x++) {
        const vertexIndex = (y * vertexCountX + x);
        const xNormalized = x / (vertexCountX - 1);

        /* Positions */
        positionBuffer[(vertexIndex * 3) + 0] = /* x */ PlaneCornerCoord + xNormalized * PlaneDim;
        positionBuffer[(vertexIndex * 3) + 1] = /* y */ PlaneCornerCoord + yNormalized * PlaneDim;
        positionBuffer[(vertexIndex * 3) + 2] = /* z */ 0;

        /* Normals */
        normalsBuffer[(vertexIndex * 3) + 0] = /* x */ 0;
        normalsBuffer[(vertexIndex * 3) + 1] = /* y */ 0;
        normalsBuffer[(vertexIndex * 3) + 2] = /* z */ 1;

        /* Indices */
        if (x < subdivisionsX && y < subdivisionsY) {
          const indexOffset = (y * subdivisionsX + x) * 2 * 3;
          /* Triangle A */
          indicesBuffer[indexOffset + 0] = vertexIndex;
          indicesBuffer[indexOffset + 1] = vertexIndex + 1;
          indicesBuffer[indexOffset + 2] = vertexIndex + vertexCountX;
          /* Triangle B */
          indicesBuffer[indexOffset + 3] = vertexIndex + vertexCountX;
          indicesBuffer[indexOffset + 4] = vertexIndex + 1;
          indicesBuffer[indexOffset + 5] = vertexIndex + vertexCountX + 1;
        }

        /* Colors */
        colorsBuffer[(vertexIndex * 3) + 0] = /* r */ 1;
        colorsBuffer[(vertexIndex * 3) + 1] = /* g */ 1;
        colorsBuffer[(vertexIndex * 3) + 2] = /* b */ 1;

        /* Texture coordinates */
        textureCoordinatesBuffer[(vertexIndex * 2) + 0] = /* r */ xNormalized;
        textureCoordinatesBuffer[(vertexIndex * 2) + 1] = /* g */ yNormalized;
      }
    }

    return {
      mode: MeshPrimitiveMode.TRIANGLES,
      positionData: {
        componentCount: 3,
        componentType: AccessorComponentType.FLOAT,
        componentSize: 4,
        normalized: false,
        buffer: positionBuffer,
      },
      extents: new AxisAlignedBoundingBox(
        new Vector3(-0.5, -0.5, 0),
        new Vector3(0.5, 0.5, 0),
      ),
      normalData: {
        componentCount: 3,
        componentType: AccessorComponentType.FLOAT,
        componentSize: 4,
        normalized: false,
        buffer: normalsBuffer,
      },
      color0Data: {
        componentCount: 3,
        componentType: AccessorComponentType.FLOAT,
        componentSize: 4,
        normalized: false,
        buffer: colorsBuffer,
      },
      texCoord0Data: {
        componentCount: 2,
        componentType: AccessorComponentType.FLOAT,
        componentSize: 4,
        normalized: false,
        buffer: textureCoordinatesBuffer,
      },
      indices: {
        componentCount: 1,
        componentType: AccessorComponentType.UNSIGNED_INT,
        componentSize: 4,
        normalized: false,
        buffer: indicesBuffer,
      },
      ...overrides,
    }
  }

  public cubePrimitive(overrides: Partial<MeshPrimitiveDefinition> = {}): MeshPrimitiveDefinition {
    return {
      mode: MeshPrimitiveMode.TRIANGLES,
      positionData: {
        componentCount: 3,
        componentType: AccessorComponentType.FLOAT,
        componentSize: 4,
        normalized: false,
        buffer: new Float32Array([
          // Front face (z = 0.5) - indices 0-3
          -0.5, -0.5, 0.5,
          0.5, -0.5, 0.5,
          0.5, 0.5, 0.5,
          -0.5, 0.5, 0.5,

          // Right face (x = 0.5) - indices 4-7
          0.5, -0.5, 0.5,
          0.5, -0.5, -0.5,
          0.5, 0.5, -0.5,
          0.5, 0.5, 0.5,

          // Back face (z = -0.5) - indices 8-11
          0.5, -0.5, -0.5,
          -0.5, -0.5, -0.5,
          -0.5, 0.5, -0.5,
          0.5, 0.5, -0.5,

          // Left face (x = -0.5) - indices 12-15
          -0.5, -0.5, -0.5,
          -0.5, -0.5, 0.5,
          -0.5, 0.5, 0.5,
          -0.5, 0.5, -0.5,

          // Top face (y = 0.5) - indices 16-19
          -0.5, 0.5, 0.5,
          0.5, 0.5, 0.5,
          0.5, 0.5, -0.5,
          -0.5, 0.5, -0.5,

          // Bottom face (y = -0.5) - indices 20-23
          -0.5, -0.5, -0.5,
          0.5, -0.5, -0.5,
          0.5, -0.5, 0.5,
          -0.5, -0.5, 0.5,
        ]),
      },
      extents: new AxisAlignedBoundingBox(
        new Vector3(-0.5, -0.5, -0.5),
        new Vector3(0.5, 0.5, 0.5),
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
          0x00, 0x00, 0xFF, 0xFF, // -X, -Y, +Z = Blue
          0xFF, 0x00, 0xFF, 0xFF, // +X, -Y, +Z = Magenta
          0xFF, 0xFF, 0xFF, 0xFF, // +X, +Y, +Z = White
          0x00, 0xFF, 0xFF, 0xFF, // -X, +Y, +Z = Cyan

          // Right face
          0xFF, 0x00, 0xFF, 0xFF, // +X, -Y, +Z = Magenta
          0xFF, 0x00, 0x00, 0xFF, // +X, -Y, -Z = Red
          0xFF, 0xFF, 0x00, 0xFF, // +X, +Y, -Z = Yellow
          0xFF, 0xFF, 0xFF, 0xFF, // +X, +Y, +Z = White

          // Back face
          0xFF, 0x00, 0x00, 0xFF, // +X, -Y, -Z = Red
          0x00, 0x00, 0x00, 0xFF, // -X, -Y, -Z = Black
          0x00, 0xFF, 0x00, 0xFF, // -X, +Y, -Z = Green
          0xFF, 0xFF, 0x00, 0xFF, // +X, +Y, -Z = Yellow

          // Left face
          0x00, 0x00, 0x00, 0xFF, // -X, -Y, -Z = Black
          0x00, 0x00, 0xFF, 0xFF, // -X, -Y, +Z = Blue
          0x00, 0xFF, 0xFF, 0xFF, // -X, +Y, +Z = Cyan
          0x00, 0xFF, 0x00, 0xFF, // -X, +Y, -Z = Green

          // Top face
          0x00, 0xFF, 0xFF, 0xFF, // -X, +Y, +Z = Cyan
          0xFF, 0xFF, 0xFF, 0xFF, // +X, +Y, +Z = White
          0xFF, 0xFF, 0x00, 0xFF, // +X, +Y, -Z = Yellow
          0x00, 0xFF, 0x00, 0xFF, // -X, +Y, -Z = Green

          // Bottom face
          0x00, 0x00, 0x00, 0xFF, // -X, -Y, -Z = Black
          0xFF, 0x00, 0x00, 0xFF, // +X, -Y, -Z = Red
          0xFF, 0x00, 0xFF, 0xFF, // +X, -Y, +Z = Magenta
          0x00, 0x00, 0xFF, 0xFF, // -X, -Y, +Z = Blue
          // eslint-disable-next-line no-constant-condition
        ].map((byte) => /* RGBCube? */ false ? byte : 0xFF)),
      },
      indices: {
        componentCount: 1,
        componentType: AccessorComponentType.UNSIGNED_BYTE,
        componentSize: 1,
        normalized: false,
        buffer: new Uint8Array([
          0, 1, 2, /**/ 2, 3, 0,       // Front face
          4, 5, 6, /**/ 6, 7, 4,       // Right face
          8, 9, 10, /**/ 10, 11, 8,    // Back face
          12, 13, 14, /**/ 14, 15, 12, // Left face
          16, 17, 18, /**/ 18, 19, 16, // Top face
          20, 21, 22, /**/ 22, 23, 20, // Bottom face
        ]),
      },
      ...overrides,
    };
  }
};

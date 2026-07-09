import { Color4, Vector2, Vector3, type IReadonlyColor4, type IReadonlyVector2, type IReadonlyVector3 } from "@lofi/core/math";
import { Computed, Observable, ObservableEvent, type Mutable, type TypedArray } from "@lofi/core/util";
import type { IEngine } from "@lofi/engine/Engine";
import {
  type AnyAttributeDefinition,
  type AttributeDefinition,
  type BaseAttributeDefinition,
  type MaterialDefinition,
  type MeshPrimitiveDefinition,
  type MeshPrimitiveMode,
  type VertexPositionAttributeDefinition,
  type VertexNormalAttributeDefinition,
  type VertexTextureCoordinateAttributeDefinition,
  type VertexColorAttributeDefinition,
  type VertexJointIndicesAttributeDefinition,
  type VertexJointWeightsAttributeDefinition,
  type TriangleIndicesAttributeDefinition,
  AccessorComponentType,
} from "@lofi/engine/loaders/definitions";
import { createBuffer, BufferType } from "@lofi/engine/util/createBuffer";
import type { IReadonlyAxisAlignedBoundingBox } from "@lofi/engine/collision";
import {
  JointIndices,
  JointWeights,
  TriangleIndices,
  type Edge,
  type EdgeIndices,
  type IReadonlyJointIndices,
  type IReadonlyJointWeights,
  type IReadonlyTriangleIndices,
  type Triangle,
} from "./index";


export type BaseVertexDefinition<TAttributeDefinition extends AnyAttributeDefinition> =
  TAttributeDefinition extends AttributeDefinition<infer ComponentCount, infer ComponentType> ?
  // Common keys of `TAttributeDefinition` and `BaseAttributeDefinition`
  Pick<TAttributeDefinition,
    Extract<
      keyof TAttributeDefinition,
      keyof BaseAttributeDefinition<ComponentCount, ComponentType>
    >
  > : never;
export type VertexAttribute<TAttributeDefinition extends AnyAttributeDefinition> =
  BaseVertexDefinition<TAttributeDefinition> & {
    glBuffer: WebGLBuffer;
  };
export type AnyVertexAttribute = VertexAttribute<AnyAttributeDefinition>;
export type VertexPositionAttribute = VertexAttribute<VertexPositionAttributeDefinition>;
export type VertexNormalAttribute = VertexAttribute<VertexNormalAttributeDefinition>;
export type VertexTextureCoordinateAttribute = VertexAttribute<VertexTextureCoordinateAttributeDefinition>;
export type VertexColorAttribute = VertexAttribute<VertexColorAttributeDefinition>;
export type VertexJointIndicesAttribute = VertexAttribute<VertexJointIndicesAttributeDefinition>;
export type VertexJointWeightsAttribute = VertexAttribute<VertexJointWeightsAttributeDefinition>;
export type TriangleIndicesAttribute = VertexAttribute<TriangleIndicesAttributeDefinition>;

/**
 * Exposes a read-only view of a mesh primitive's geometry, as well
 * as functionality for mutating it and having the changes
 * automatically propagate to the GPU.
 */
export class MeshPrimitiveGeometry {
  private readonly engine: IEngine;

  /* Mesh primitive */
  /** GL mode with which this primitive will be drawn. e.g. `POINTS`, `LINES`, `TRIANGLES`, etc. */
  public readonly glMode: MeshPrimitiveMode;
  /** Axis-aligned extents that the geometry of this mesh primitive is contained within. */
  public readonly extents: IReadonlyAxisAlignedBoundingBox;
  /** Default material as read from the asset's definition. */
  public readonly defaultMaterialDefinition: MaterialDefinition | undefined;

  /* Vertex attributes */
  public readonly positionAttribute: Readonly<VertexPositionAttribute>;
  public readonly normalAttribute: Readonly<VertexNormalAttribute>;
  public readonly indicesAttribute: Readonly<TriangleIndicesAttribute>;
  public readonly joints0Attribute: Readonly<VertexJointIndicesAttribute> | undefined;
  public readonly weights0Attribute: Readonly<VertexJointWeightsAttribute> | undefined;
  public readonly color0Attribute: Readonly<VertexColorAttribute> | undefined;
  public readonly texCoord0Attribute: Readonly<VertexTextureCoordinateAttribute> | undefined;

  /* Parsed data */
  private readonly _vertexPositions: readonly Vector3[];
  private readonly _vertexNormals: readonly Vector3[];
  private readonly _triangleIndices: readonly TriangleIndices[];
  private readonly _jointIndices: readonly JointIndices[] | undefined;
  private readonly _jointWeights: readonly JointWeights[] | undefined;
  private readonly _vertexColors: readonly Color4[] | undefined;
  private readonly _vertexTextureCoordinates: readonly Vector2[] | undefined;
  /* Parsed data - readonly */
  private readonly _triangles: Computed<readonly Triangle[]>;
  private readonly _edgeIndices: Computed<readonly EdgeIndices[]>;
  private readonly _edges: Computed<readonly Edge[]>;

  /* Observable events - fired when any underlying data is changed via `mutate()` */
  public readonly vertexPositionsChanged: ObservableEvent;
  public readonly vertexNormalsChanged: ObservableEvent;
  public readonly triangleIndicesChanged: ObservableEvent;
  public readonly jointIndicesChanged: ObservableEvent;
  public readonly jointWeightsChanged: ObservableEvent;
  public readonly vertexColorsChanged: ObservableEvent;
  public readonly vertexTextureCoordinatesChanged: ObservableEvent;

  /* Mutation observers */
  private readonly vertexPositionsMutationObserver: VertexAttributeMutationObserver<Vector3>;
  private readonly vertexNormalsMutationObserver: VertexAttributeMutationObserver<Vector3>;
  private readonly triangleIndicesMutationObserver: VertexAttributeMutationObserver<TriangleIndices>;
  private readonly jointIndicesMutationObserver: VertexAttributeMutationObserver<JointIndices> | undefined;
  private readonly jointWeightsMutationObserver: VertexAttributeMutationObserver<JointWeights> | undefined;
  private readonly vertexColorsMutationObserver: VertexAttributeMutationObserver<Color4> | undefined;
  private readonly vertexTextureCoordinatesMutationObserver: VertexAttributeMutationObserver<Vector2> | undefined;

  public constructor(engine: IEngine, definition: MeshPrimitiveDefinition) {
    this.engine = engine;

    this.glMode = definition.mode;
    this.extents = definition.extents;
    this.defaultMaterialDefinition = definition.material;

    const { gl } = engine;

    /* Observable events */
    this.vertexPositionsChanged = new ObservableEvent();
    this.vertexNormalsChanged = new ObservableEvent();
    this.triangleIndicesChanged = new ObservableEvent();
    this.jointIndicesChanged = new ObservableEvent();
    this.jointWeightsChanged = new ObservableEvent();
    this.vertexColorsChanged = new ObservableEvent();
    this.vertexTextureCoordinatesChanged = new ObservableEvent();

    /* Vertex positions */
    // Parse data
    this._vertexPositions = Object.freeze(this.parsePositionNormalAttribute(definition.positionData));
    // Create GL buffer
    this.positionAttribute = this.createVertexAttribute(definition.positionData, BufferType.ARRAY_BUFFER);
    // Create mutation observer
    this.vertexPositionsMutationObserver = new VertexAttributeMutationObserver(
      this._vertexPositions,
      this.positionAttribute,
      this.vertexPositionsChanged,
      this.createTmpBufferForVertexAttribute(this.positionAttribute, this._vertexPositions.length),
      (vertexPosition, buffer, offset) => {
        buffer[offset + 0] = vertexPosition.x;
        buffer[offset + 1] = vertexPosition.y;
        buffer[offset + 2] = vertexPosition.z;
      },
    );

    /* Triangle indices */
    if (definition.indices) {
      // Triangles defined by vertex indices
      // Parse data
      this._triangleIndices = Object.freeze(this.parseIndicesAttribute(definition.indices));
      // Create GL buffer
      this.indicesAttribute = this.createVertexAttribute(definition.indices, BufferType.ELEMENT_ARRAY_BUFFER);
    } else {
      // Triangles assumed to be sequential
      // Generate data
      const triangleIndices: TriangleIndices[] = this._triangleIndices = [];
      const glBufferData = new Uint32Array(this._vertexPositions.length);
      for (let i = 2; i < this._vertexPositions.length; i += 3) {
        triangleIndices.push(new TriangleIndices(
          i - 2,
          i - 1,
          i,
        ));

        // Write data to gl buffer
        glBufferData[i - 2] = i - 2;
        glBufferData[i - 1] = i - 1;
        glBufferData[i] = i;
      }

      Object.freeze(triangleIndices);

      // Create GL buffer
      this.indicesAttribute = {
        glBuffer: createBuffer(gl, BufferType.ELEMENT_ARRAY_BUFFER, glBufferData),
        componentCount: 1,
        componentSize: 4,
        componentType: AccessorComponentType.UNSIGNED_INT,
        normalized: false,
      };
    }
    // @NOTE Sanity check triangle indices
    this._triangleIndices.forEach((triangle, triangleIndex) => {
      for (const i of ['aIndex', 'bIndex', 'cIndex'] as const) {
        const vertexIndex = triangle[i];
        if (this._vertexPositions[vertexIndex] === undefined) {
          throw new Error(`Triangle ${triangleIndex} vertex ${i} is out of bounds: ${vertexIndex}`);
        }
      }
    });
    // Create mutation observer
    // @NOTE Triangle indices need custom component count since the spec says that
    // indices component count is 1, yet triangles need 3 indices.
    // @TODO We kind of need to honor the spec a bit better here, we are making assumptions indices are always triangles.
    const TriangleIndicesCustomComponentCount = 3;
    let triangleIndicesScratchBuffer: TypedArray;
    switch (this.indicesAttribute.componentType) {
      case AccessorComponentType['UNSIGNED_BYTE']:
        triangleIndicesScratchBuffer = new Uint8Array(TriangleIndicesCustomComponentCount * this._triangleIndices.length);
        break;
      case AccessorComponentType['UNSIGNED_SHORT']:
        triangleIndicesScratchBuffer = new Uint16Array(TriangleIndicesCustomComponentCount * this._triangleIndices.length);
        break;
      case AccessorComponentType['UNSIGNED_INT']:
        triangleIndicesScratchBuffer = new Uint32Array(TriangleIndicesCustomComponentCount * this._triangleIndices.length);
        break;
      default:
        throw new Error(`Unimplemented indices attribute component type: ${(this.indicesAttribute as { componentType: number }).componentType}`);
    }
    this.triangleIndicesMutationObserver = new VertexAttributeMutationObserver(
      this._triangleIndices,
      this.indicesAttribute,
      this.triangleIndicesChanged,
      triangleIndicesScratchBuffer,
      (triangleIndices, buffer, offset) => {
        buffer[offset + 0] = triangleIndices.aIndex;
        buffer[offset + 1] = triangleIndices.bIndex;
        buffer[offset + 2] = triangleIndices.cIndex;
      },
      BufferType.ELEMENT_ARRAY_BUFFER,
    );
    // @NOTE Override component count
    this.triangleIndicesMutationObserver.componentCount = 3;

    /* Triangles */
    this._triangles = new Computed<readonly Triangle[]>([], {
      dependencies: [
        this.vertexPositionsChanged,
        this.triangleIndicesChanged,
      ],
      recompute: (_self) => {
        const self = _self as Mutable<Triangle>[]; // @NOTE type laundering for mutability

        let triangleCount = 0;
        for (const triangleIndices of this.triangleIndices) {
          const aTriangle = this.vertexPositions[triangleIndices.aIndex];
          const bTriangle = this.vertexPositions[triangleIndices.bIndex];
          const cTriangle = this.vertexPositions[triangleIndices.cIndex];
          if (self[triangleCount] !== undefined) {
            // Re-use existing instances
            self[triangleCount][0] = aTriangle;
            self[triangleCount][1] = bTriangle;
            self[triangleCount][2] = cTriangle;
          } else {
            // Build up array for the first time
            self[triangleCount] = [
              aTriangle,
              bTriangle,
              cTriangle,
            ];
          }
          triangleCount++;
        }
      },
    });

    /* Vertex normals */
    if (definition.normalData !== undefined) {
      // Normals provided by asset
      // Parse data
      this._vertexNormals = Object.freeze(this.parsePositionNormalAttribute(definition.normalData));
      // Create GL buffer
      this.normalAttribute = this.createVertexAttribute(definition.normalData, BufferType.ARRAY_BUFFER);
    } else {
      // Normals MISSING from asset
      // Generate data
      this._vertexNormals = Object.freeze(this._vertexPositions.map(() => Vector3.zero()));
      this.recomputeVertexNormals();

      // Write data to GL buffer
      const glBufferData = new Float32Array(this._vertexNormals.length * 3);
      for (let i = 0; i < this._vertexNormals.length; i++) {
        const vertexNormal = this._vertexNormals[i];
        glBufferData[i * 3] = vertexNormal.x;
        glBufferData[i * 3 + 1] = vertexNormal.y;
        glBufferData[i * 3 + 2] = vertexNormal.z;
      }

      // Create GL buffer
      this.normalAttribute = {
        glBuffer: createBuffer(gl, BufferType.ARRAY_BUFFER, glBufferData),
        componentCount: 3,
        componentSize: 4,
        componentType: AccessorComponentType.FLOAT,
        normalized: false,
      };
    }
    // Create mutation observer
    this.vertexNormalsMutationObserver = new VertexAttributeMutationObserver(
      this._vertexNormals,
      this.normalAttribute,
      this.vertexNormalsChanged,
      this.createTmpBufferForVertexAttribute(this.normalAttribute, this._vertexNormals.length),
      (vertexNormal, buffer, offset) => {
        buffer[offset + 0] = vertexNormal.x;
        buffer[offset + 1] = vertexNormal.y;
        buffer[offset + 2] = vertexNormal.z;
      },
    );

    /* Edges */
    // @NOTE Edges are entirely computed based on parsed geometry
    this._edgeIndices = new Computed<readonly EdgeIndices[]>([], {
      dependencies: [
        this.triangleIndicesChanged,
      ],
      recompute: (_self) => {
        const self = _self as Mutable<typeof _self>; // @NOTE type laundering for mutability

        // Truncate array
        self.length = 0;

        // Build up a set of all unique edge indices
        const edgeMap = new Map<string, EdgeIndices>();
        // @TODO Move out of this scope into static function?
        function addEdge(indexA: number, indexB: number): void {
          const edge: EdgeIndices = indexA < indexB ? [indexA, indexB] : [indexB, indexA];
          const edgeKey = `${edge[0]},${edge[1]}`;
          if (!edgeMap.has(edgeKey)) {
            edgeMap.set(edgeKey, edge);
          }
        }
        this._triangleIndices.forEach((triangle) => {
          addEdge(triangle.aIndex, triangle.bIndex);
          addEdge(triangle.bIndex, triangle.cIndex);
          addEdge(triangle.cIndex, triangle.aIndex);
        });

        for (const edge of edgeMap.values()) {
          self.push(edge);
        }
      },
    });
    this._edges = new Computed<readonly Edge[]>([], {
      dependencies: [
        this.vertexPositionsChanged,
        this.edgeIndicesComputed,
      ],
      recompute: (_self) => {
        const self = _self as Mutable<Edge>[]; // @NOTE type laundering for mutability

        let edgeCount = 0;
        const allVertexPositions = this.vertexPositions;
        for (const edgeIndices of this.edgeIndicesComputed.value) {
          const aVertex = allVertexPositions[edgeIndices[0]];
          const bVertex = allVertexPositions[edgeIndices[1]];
          if (self[edgeCount] !== undefined) {
            // Re-use existing instances
            self[edgeCount][0] = aVertex;
            self[edgeCount][1] = bVertex;
          } else {
            // Build up array for the first time
            self[edgeCount] = [
              aVertex,
              bVertex,
            ];
          }
          edgeCount++;
        }

        // Number of unique edges can change, so ensure array is always correct size
        self.length = edgeCount;
      },
    });

    /* Skin */
    if (definition.joints0Data && definition.weights0Data) {
      // Parse data
      this._jointIndices = Object.freeze(this.parseJointIndicesAttribute(definition.joints0Data));
      this._jointWeights = Object.freeze(this.parseJointWeightsAttribute(definition.weights0Data));
      // Create GL buffers
      this.joints0Attribute = this.createVertexAttribute(definition.joints0Data, BufferType.ARRAY_BUFFER);
      this.weights0Attribute = this.createVertexAttribute(definition.weights0Data, BufferType.ARRAY_BUFFER);
      // Create mutation observers
      this.jointIndicesMutationObserver = new VertexAttributeMutationObserver(
        this._jointIndices,
        this.joints0Attribute,
        this.jointIndicesChanged,
        this.createTmpBufferForVertexAttribute(this.joints0Attribute, this._jointIndices.length),
        (jointIndices, buffer, offset) => {
          buffer[offset + 0] = jointIndices[0];
          buffer[offset + 1] = jointIndices[1];
          buffer[offset + 2] = jointIndices[2];
          buffer[offset + 3] = jointIndices[3];
        },
      );
      this.jointWeightsMutationObserver = new VertexAttributeMutationObserver(
        this._jointWeights,
        this.weights0Attribute,
        this.jointWeightsChanged,
        this.createTmpBufferForVertexAttribute(this.weights0Attribute, this._jointWeights.length),
        (jointWeights, buffer, offset) => {
          buffer[offset + 0] = this.denormalizeValue(jointWeights[0], this.weights0Attribute!);
          buffer[offset + 1] = this.denormalizeValue(jointWeights[1], this.weights0Attribute!);
          buffer[offset + 2] = this.denormalizeValue(jointWeights[2], this.weights0Attribute!);
          buffer[offset + 3] = this.denormalizeValue(jointWeights[3], this.weights0Attribute!);
        },
      );
    }

    /* Colors */
    if (definition.color0Data) {
      // Parse data
      this._vertexColors = Object.freeze(this.parseVertexColorAttribute(definition.color0Data));
      // Create GL buffer
      this.color0Attribute = this.createVertexAttribute(definition.color0Data, BufferType.ARRAY_BUFFER);
      // Create mutation observer
      this.vertexColorsMutationObserver = new VertexAttributeMutationObserver(
        this._vertexColors,
        this.color0Attribute,
        this.vertexColorsChanged,
        this.createTmpBufferForVertexAttribute(this.color0Attribute, this._vertexColors.length),
        (vertexColor, buffer, offset) => {
          buffer[offset + 0] = this.denormalizeValue(vertexColor.r / 0xFF, this.color0Attribute!);
          buffer[offset + 1] = this.denormalizeValue(vertexColor.g / 0xFF, this.color0Attribute!);
          buffer[offset + 2] = this.denormalizeValue(vertexColor.b / 0xFF, this.color0Attribute!);
          if (this.color0Attribute!.componentCount === 4) {
            buffer[offset + 3] = this.denormalizeValue(vertexColor.a / 0xFF, this.color0Attribute!);
          }
        },
      );
    }

    /* Texture coordinates */
    if (definition.texCoord0Data) {
      // Parse data
      this._vertexTextureCoordinates = Object.freeze(this.parseVertexTextureCoordinatesAttribute(definition.texCoord0Data));
      // Create GL buffer
      this.texCoord0Attribute = this.createVertexAttribute(definition.texCoord0Data, BufferType.ARRAY_BUFFER);
      // Create mutation observer
      this.vertexTextureCoordinatesMutationObserver = new VertexAttributeMutationObserver(
        this._vertexTextureCoordinates,
        this.texCoord0Attribute,
        this.vertexTextureCoordinatesChanged,
        this.createTmpBufferForVertexAttribute(this.texCoord0Attribute, this._vertexTextureCoordinates.length),
        (vertexTexCoord, buffer, offset) => {
          buffer[offset + 0] = this.denormalizeValue(vertexTexCoord.x, this.texCoord0Attribute!);
          buffer[offset + 1] = this.denormalizeValue(vertexTexCoord.y, this.texCoord0Attribute!);
        },
      );
    }
  }

  public mutate(callback: (mutableGeometry: MutableMeshPrimitiveGeometry) => void): void {
    try {
      // Enable mutation observers
      this.vertexPositionsMutationObserver.reset();
      this.vertexNormalsMutationObserver.reset();
      this.triangleIndicesMutationObserver.reset();
      this.jointIndicesMutationObserver?.reset();
      this.jointWeightsMutationObserver?.reset();
      this.vertexColorsMutationObserver?.reset();
      this.vertexTextureCoordinatesMutationObserver?.reset();

      // @NOTE Sad, the whole point of this pattern is that we can make this cast. But TypeScript won't allow it.
      callback(this as unknown as MutableMeshPrimitiveGeometry);

      // Write changes (if any) to GPU
      /* Vertex positions */
      this.writeDirtyData(this.vertexPositionsMutationObserver);
      /* Vertex normals */
      this.writeDirtyData(this.vertexNormalsMutationObserver);
      /* Triangle indices */
      this.writeDirtyData(this.triangleIndicesMutationObserver);
      /* Joint indices */
      if (this.jointIndicesMutationObserver !== undefined) {
        this.writeDirtyData(this.jointIndicesMutationObserver);
      }
      /* Joint weights */
      if (this.jointWeightsMutationObserver !== undefined) {
        this.writeDirtyData(this.jointWeightsMutationObserver);
      }
      /* Vertex colors */
      if (this.vertexColorsMutationObserver !== undefined) {
        this.writeDirtyData(this.vertexColorsMutationObserver);
      }
      /* Vertex texture coordinates */
      if (this.vertexTextureCoordinatesMutationObserver !== undefined) {
        this.writeDirtyData(this.vertexTextureCoordinatesMutationObserver);
      }
    } finally {
      // Stop observing mutations
      this.vertexPositionsMutationObserver.disable();
      this.vertexNormalsMutationObserver.disable();
      this.triangleIndicesMutationObserver.disable();
      this.jointIndicesMutationObserver?.disable();
      this.jointWeightsMutationObserver?.disable();
      this.vertexColorsMutationObserver?.disable();
      this.vertexTextureCoordinatesMutationObserver?.disable();
    }
  }
  private writeDirtyData<TData extends Observable>(
    mutationObserver: VertexAttributeMutationObserver<TData>,
  ): void {
    const { observableEvent, minDirtyRange, maxDirtyRange, dirtyRangeIsEmpty, scratchBuffer, attribute, componentCount, bufferType } = mutationObserver;
    // Check if data is dirty
    if (!dirtyRangeIsEmpty) {
      // Notify listeners
      observableEvent.changed();

      // Write dirty range to scratch buffer (starting at offset 0)
      const rangeSize = maxDirtyRange - minDirtyRange + 1;
      for (let i = 0; i < rangeSize; i++) {
        mutationObserver.writeDatumToBuffer(mutationObserver.data[minDirtyRange + i], scratchBuffer, i * componentCount);
      }

      // Write dirty range of scratch buffer to GL
      const { gl } = this.engine;
      gl.bindBuffer(bufferType, attribute.glBuffer);
      gl.bufferSubData(bufferType, minDirtyRange * componentCount * attribute.componentSize, scratchBuffer, 0, rangeSize * componentCount);
      gl.bindBuffer(bufferType, null);
    }
  }

  private static readonly tmp_recomputeVertexNormals_edgeA = Vector3.zero();
  private static readonly tmp_recomputeVertexNormals_edgeB = Vector3.zero();
  private static readonly tmp_recomputeVertexNormals_triangleNormal = Vector3.zero();
  public recomputeVertexNormals(): void {
    // Zero all normals
    for (let i = 0; i < this._vertexNormals.length; i++) {
      this._vertexNormals[i].setValue(0, 0, 0);
    }

    // For each triangle
    for (let i = 0; i < this._triangleIndices.length; i++) {
      const triangleIndices = this._triangleIndices[i];
      // Compute triangle normal from cross product of two edges
      const edge1 = MeshPrimitiveGeometry.tmp_recomputeVertexNormals_edgeA
        .setValue(this._vertexPositions[triangleIndices.bIndex])
        .subtractSelf(this._vertexPositions[triangleIndices.aIndex]);
      const edge2 = MeshPrimitiveGeometry.tmp_recomputeVertexNormals_edgeB
        .setValue(this._vertexPositions[triangleIndices.cIndex])
        .subtractSelf(this._vertexPositions[triangleIndices.aIndex]);
      const triangleNormal = MeshPrimitiveGeometry.tmp_recomputeVertexNormals_triangleNormal
        .setValue(edge1)
        .crossSelf(edge2)
        .normalizeSelf();

      // Add triangle normal to each vertices' normal
      this._vertexNormals[triangleIndices.aIndex].addSelf(triangleNormal);
      this._vertexNormals[triangleIndices.bIndex].addSelf(triangleNormal);
      this._vertexNormals[triangleIndices.cIndex].addSelf(triangleNormal);
    }

    // Normalise normals
    for (let i = 0; i < this._vertexNormals.length; i++) {
      this._vertexNormals[i].setValue(this._vertexNormals[i].normalizeSelf());
    };
  }

  private createVertexAttribute<TAttributeDefinition extends AnyAttributeDefinition>(attributeDefinition: TAttributeDefinition, bufferType: BufferType = BufferType.ARRAY_BUFFER): VertexAttribute<TAttributeDefinition> {
    const { gl } = this.engine;
    // @NOTE Type laundering because types like `attributeDefinition.componentCount` are getting widened to e.g. `number`
    return {
      glBuffer: createBuffer(gl, bufferType, attributeDefinition.buffer),
      componentCount: attributeDefinition.componentCount,
      componentSize: attributeDefinition.componentSize,
      componentType: attributeDefinition.componentType,
      normalized: attributeDefinition.normalized,
    } as unknown as VertexAttribute<TAttributeDefinition>;
  }

  private createTmpBufferForVertexAttribute(attribute: AnyVertexAttribute, length: number): TypedArray {
    switch (attribute.componentType) {
      case AccessorComponentType['BYTE']:
        return new Int8Array(attribute.componentCount * length);
      case AccessorComponentType['UNSIGNED_BYTE']:
        return new Uint8Array(attribute.componentCount * length);
      case AccessorComponentType['SHORT']:
        return new Int16Array(attribute.componentCount * length);
      case AccessorComponentType['UNSIGNED_SHORT']:
        return new Uint16Array(attribute.componentCount * length);
      // @NOTE Accessors under the GLTF specification cannot be signed INT
      case AccessorComponentType['UNSIGNED_INT']:
        return new Uint32Array(attribute.componentCount * length);
      case AccessorComponentType['FLOAT']:
        return new Float32Array(attribute.componentCount * length);
      default:
        throw new Error(`Unimplemented attribute type: ${(attribute as { componentType: number }).componentType}`);
    }
  }

  private parsePositionNormalAttribute(attribute: VertexPositionAttributeDefinition | VertexNormalAttributeDefinition): Vector3[] {
    /*
      @NOTE Mesh primitive POSITION and NORMAL attributes must be FLOAT type.
      See: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview
     */

    if (attribute.componentCount !== 3) {
      throw new Error(`Cannot parse attribute as Vector3: component count is not 3 (componentCount='${attribute.componentCount}')`);
    }

    const result: Vector3[] = [];

    for (let i = 2; i < attribute.buffer.length; i += 3) {
      result.push(new Vector3(
        attribute.buffer[i - 2],
        attribute.buffer[i - 1],
        attribute.buffer[i],
      ));
    }

    return result;
  }

  private parseIndicesAttribute(attribute: TriangleIndicesAttributeDefinition): TriangleIndices[] {
    /*
      @NOTE Mesh primitive indices must be SCALAR and unsigned integer type.
      See: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#_mesh_primitive_indices
     */

    if (attribute.componentCount !== 1) {
      throw new Error(`Cannot parse attribute as Triangle Indices: component count is not 1 (componentCount='${attribute.componentCount}')`);
    }

    const result: TriangleIndices[] = [];

    for (let i = 2; i < attribute.buffer.length; i += 3) {
      result.push(new TriangleIndices(
        attribute.buffer[i - 2],
        attribute.buffer[i - 1],
        attribute.buffer[i],
      ));
    }

    return result;
  }

  private parseJointIndicesAttribute(attribute: VertexJointIndicesAttributeDefinition): JointIndices[] {
    /*
      @NOTE Mesh primitive joint indices attributes must be VEC4 and unsigned integer type.
      See: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview
     */

    if (attribute.componentCount !== 4) {
      throw new Error(`Cannot parse attribute as Joints Indices: component count is not 4 (componentCount='${attribute.componentCount}')`);
    }

    const result: JointIndices[] = [];

    for (let i = 3; i < attribute.buffer.length; i += 4) {
      result.push(new JointIndices(
        attribute.buffer[i - 3],
        attribute.buffer[i - 2],
        attribute.buffer[i - 1],
        attribute.buffer[i],
      ));
    }

    return result;
  }

  private parseJointWeightsAttribute(attribute: VertexJointWeightsAttributeDefinition): JointWeights[] {
    /*
      @NOTE Mesh primitive joint weights attributes must be VEC4 and float or normalized unsigned integer type.
      See: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview
     */

    if (attribute.componentCount !== 4) {
      throw new Error(`Cannot parse attribute as Joints Weights: component count is not 4 (componentCount='${attribute.componentCount}')`);
    }

    const result: JointWeights[] = [];

    for (let i = 3; i < attribute.buffer.length; i += 4) {
      result.push(new JointWeights(
        this.normalizeValue(attribute.buffer[i - 3], attribute),
        this.normalizeValue(attribute.buffer[i - 2], attribute),
        this.normalizeValue(attribute.buffer[i - 1], attribute),
        this.normalizeValue(attribute.buffer[i], attribute),
      ));
    }

    return result;
  }

  private parseVertexColorAttribute(attribute: VertexColorAttributeDefinition): Color4[] {
    /*
      @NOTE Mesh primitive COLOR_X attributes must be FLOAT or normalized unsigned int type.
      COLOR_X attributes can be either VEC3 or VEC4
      See: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview
     */

    if (attribute.componentCount !== 3 && attribute.componentCount !== 4) {
      throw new Error(`Cannot parse attribute as Color4: component count is not 3 or 4 (componentCount='${attribute.componentCount}')`);
    }

    const result: Color4[] = [];

    for (let i = attribute.componentCount - 1; i < attribute.buffer.length; i += attribute.componentCount) {
      if (attribute.componentCount === 3) {
        // RGB
        result.push(new Color4(
          this.normalizeValue(attribute.buffer[i - 2], attribute) * 0xFF,
          this.normalizeValue(attribute.buffer[i - 1], attribute) * 0xFF,
          this.normalizeValue(attribute.buffer[i], attribute) * 0xFF,
          0xFF,
        ));
      } else {
        // RGBA
        result.push(new Color4(
          this.normalizeValue(attribute.buffer[i - 3], attribute) * 0xFF,
          this.normalizeValue(attribute.buffer[i - 2], attribute) * 0xFF,
          this.normalizeValue(attribute.buffer[i - 1], attribute) * 0xFF,
          this.normalizeValue(attribute.buffer[i], attribute) * 0xFF,
        ));
      }
    }

    return result;
  }

  private parseVertexTextureCoordinatesAttribute(attribute: VertexTextureCoordinateAttributeDefinition): Vector2[] {
    /*
      @NOTE Mesh primitive TEXCOORD_X attributes must be FLOAT or normalized unsigned int type.
      See: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview
     */

    if (attribute.componentCount !== 2) {
      throw new Error(`Cannot parse attribute as Vector2: component count is not 2 (componentCount='${attribute.componentCount}')`);
    }

    const result: Vector2[] = [];

    for (let i = 1; i < attribute.buffer.length; i += 2) {
      result.push(new Vector2(
        this.normalizeValue(attribute.buffer[i - 1], attribute),
        this.normalizeValue(attribute.buffer[i], attribute),
      ));
    }

    return result;
  }

  private normalizeValue(value: number, attributeDefinition: AnyAttributeDefinition): number {
    if (attributeDefinition.normalized === false) {
      // Data does not need normalizing
      return value;
    } else {
      // Data needs to be normalized
      // @NOTE Slightly cursed normalization logic in GLTF specification.
      // Maximally negative values (like -128 for BYTE) are clamped to -1.
      // See: https://github.com/KhronosGroup/glTF/issues/1317
      switch (attributeDefinition.componentType) {
        case AccessorComponentType['BYTE']:
          return Math.max(value / 0x7F, -1);
        case AccessorComponentType['UNSIGNED_BYTE']:
          return value / 0xFF;
        case AccessorComponentType['SHORT']:
          return Math.max(value / 0x7FFF, -1);
        case AccessorComponentType['UNSIGNED_SHORT']:
          return value / 0xFFFF;

        // Unsigned int / float not valid to be normalized
        // See: https://github.com/KhronosGroup/glTF/blob/4ecfc3bd8c439a1c3feab04218212e6b9b222253/specification/2.0/schema/accessor.schema.json#L66
        case AccessorComponentType['UNSIGNED_INT']:
          throw new Error(`Invalid accessor definition. Data specifies 'normalized' but is of type 'UNSIGNED_INT' (${AccessorComponentType['UNSIGNED_INT']})`);
        case AccessorComponentType['FLOAT']:
          throw new Error(`Invalid accessor definition. Data specifies 'normalized' but is of type 'FLOAT' (${AccessorComponentType['FLOAT']})`);

        // Unimplemented / future values
        default:
          throw new Error(`Unimplemented attribute component type: ${(attributeDefinition as { componentType: number }).componentType}`);
      }
    }
  }

  private denormalizeValue(value: number, attributeDefinition: BaseVertexDefinition<AnyAttributeDefinition>): number {
    if (attributeDefinition.normalized === false) {
      // Data does not need normalizing
      return value;
    } else {
      // Data needs to be normalized
      // @NOTE Slightly cursed normalization logic in GLTF specification.
      // Maximally negative values (like -128 for BYTE) are clamped to -1.
      // See: https://github.com/KhronosGroup/glTF/issues/1317
      switch (attributeDefinition.componentType) {
        case AccessorComponentType['BYTE']:
          return value * 0x7F;
        case AccessorComponentType['UNSIGNED_BYTE']:
          return value * 0xFF;
        case AccessorComponentType['SHORT']:
          return value * 0x7FFF;
        case AccessorComponentType['UNSIGNED_SHORT']:
          return value * 0xFFFF;

        // Unsigned int / float not valid to be normalized
        // See: https://github.com/KhronosGroup/glTF/blob/4ecfc3bd8c439a1c3feab04218212e6b9b222253/specification/2.0/schema/accessor.schema.json#L66
        case AccessorComponentType['UNSIGNED_INT']:
          throw new Error(`Invalid accessor definition. Data specifies 'normalized' but is of type 'UNSIGNED_INT' (${AccessorComponentType['UNSIGNED_INT']})`);
        case AccessorComponentType['FLOAT']:
          throw new Error(`Invalid accessor definition. Data specifies 'normalized' but is of type 'FLOAT' (${AccessorComponentType['FLOAT']})`);

        // Unimplemented / future values
        default:
          throw new Error(`Unimplemented attribute component type: ${(attributeDefinition as { componentType: number }).componentType}`);
      }
    }
  }

  // Read-only data
  public get vertexPositions(): readonly IReadonlyVector3[] { return this._vertexPositions; }
  public get vertexNormals(): readonly IReadonlyVector3[] { return this._vertexNormals; }
  public get triangleIndices(): readonly IReadonlyTriangleIndices[] { return this._triangleIndices; }
  public get triangles(): readonly Triangle[] { return this._triangles.value; }
  public get edgeIndices(): readonly EdgeIndices[] { return this._edgeIndices.value; }
  public get edges(): readonly Edge[] { return this._edges.value; }
  public get jointIndices(): readonly IReadonlyJointIndices[] | undefined { return this._jointIndices; }
  public get jointWeights(): readonly IReadonlyJointWeights[] | undefined { return this._jointWeights; }
  public get vertexColors(): readonly IReadonlyColor4[] | undefined { return this._vertexColors; }
  public get vertexTextureCoordinates(): readonly IReadonlyVector2[] | undefined { return this._vertexTextureCoordinates; }

  // Computeds
  public get trianglesComputed(): Computed<readonly Triangle[]> { return this._triangles; }
  public get edgeIndicesComputed(): Computed<readonly EdgeIndices[]> { return this._edgeIndices; }
  public get edgesComputed(): Computed<readonly Edge[]> { return this._edges; }
}

/** Mutable set of geometry for a mesh primitive. */
export interface MutableMeshPrimitiveGeometry {
  get vertexPositions(): readonly Vector3[];
  get vertexNormals(): readonly Vector3[];
  get triangleIndices(): readonly TriangleIndices[];
  get jointIndices(): readonly JointIndices[] | undefined;
  get jointWeights(): readonly JointWeights[] | undefined;
  get vertexColors(): readonly Color4[] | undefined;
  get vertexTextureCoordinates(): readonly Vector2[] | undefined;
  /** Recompute vertex normals based on the current mesh's triangles. */
  recomputeVertexNormals(): void;
}

export type WriteDatumToBufferFunc<TData extends Observable> = (datum: TData, buffer: TypedArray, offset: number) => void;
/**
 * Utility class for observing mutations to individual vertex attributes as
 * part of mutating geometry. Listens for mutations to the underlying data and
 * tracks the range of modifications, for writing only a subset of data
 * to the GPU. Also stores references to several objects used as part of
 * writing the changes to the GPU.
 */
export class VertexAttributeMutationObserver<TData extends Observable> {
  // References
  public readonly data: readonly TData[];
  public readonly attribute: AnyVertexAttribute;
  public readonly observableEvent: ObservableEvent;
  public readonly scratchBuffer: TypedArray;
  public readonly writeDatumToBuffer: WriteDatumToBufferFunc<TData>;
  public readonly bufferType: BufferType;

  // State
  private readonly dirtyRange: Uint32Array;
  private _dirtyRangeIsEmpty: boolean = true;
  private enabled: boolean = false;
  /**
   * Alias for `attribute.componentCount`.
   * This is primarily an escape hatch for TriangleIndices, since the logic needs
   * to override the attribute definition with a custom value.
   */
  public componentCount: number;

  public constructor(
    data: readonly TData[],
    attribute: AnyVertexAttribute,
    observableEvent: ObservableEvent,
    scratchBuffer: TypedArray,
    writeDatumToBuffer: WriteDatumToBufferFunc<TData>,
    bufferType: BufferType = BufferType.ARRAY_BUFFER,
  ) {
    // Store references
    this.data = data;
    this.attribute = attribute;
    this.observableEvent = observableEvent;
    this.scratchBuffer = scratchBuffer;
    this.writeDatumToBuffer = writeDatumToBuffer;
    this.bufferType = bufferType;

    this.componentCount = attribute.componentCount;

    this.dirtyRange = new Uint32Array(2);
    this._dirtyRangeIsEmpty = true;

    // Subscribe to all data changes
    for (let i = 0; i < data.length; i++) {
      data[i].onChange(() => {
        // Only react to changes if observing is enabled
        if (this.enabled) {
          if (this.dirtyRangeIsEmpty || i < this.minDirtyRange) {
            this.dirtyRangeIsEmpty = false;
            this.minDirtyRange = i;
          }
          if (this.dirtyRangeIsEmpty || i > this.maxDirtyRange) {
            this.dirtyRangeIsEmpty = false;
            this.maxDirtyRange = i;
          }
        }
      });
    }
  }

  public reset(): void {
    this.minDirtyRange = 0;
    this.maxDirtyRange = 0;
    this.dirtyRangeIsEmpty = true;
    this.enabled = true;
  }

  public disable(): void {
    this.enabled = false;
  }

  public get minDirtyRange(): number { return this.dirtyRange[0]; }
  private set minDirtyRange(value: number) { this.dirtyRange[0] = value; }
  public get maxDirtyRange(): number { return this.dirtyRange[1]; }
  private set maxDirtyRange(value: number) { this.dirtyRange[1] = value; }
  public get dirtyRangeIsEmpty(): boolean { return this._dirtyRangeIsEmpty; }
  private set dirtyRangeIsEmpty(value: boolean) { this._dirtyRangeIsEmpty = value; }
}

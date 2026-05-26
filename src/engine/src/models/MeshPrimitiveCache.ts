import { Vector3 } from "@lofi/core/math";
import { Computed } from "@lofi/core/util/observable";
import type { TypedArray } from "@lofi/core/util/types";
import type { AttributeDefinition, Extents, MaterialDefinition, MeshPrimitiveDefinition, MeshPrimitiveMode } from "@lofi/engine/loaders/definitions";
import type { IEngine } from "@lofi/engine/Engine";
import { MaterialInstance } from "@lofi/engine/materials";

import { MeshPrimitive } from "./MeshPrimitive";

type MaterialCacheKey = string;

/**
 * Cache that holds {@linkcode MeshPrimitive} instances.
 * Since a {@linkcode MeshPrimitive}'s internal definition alters based on what properties are
 * enabled on the material it is drawn with, this cache ensures unique permutations of
 * {@linkcode MeshPrimitiveDefinition} + {@linkcode MaterialInstance} are cached and only regenerated when needed,
 * based on the unique structure of the {@linkcode MaterialInstance}.
 */
export class MeshPrimitiveCache { // @TODO Does this need a different name?
  private readonly engine: IEngine;
  private readonly cache: Map<MaterialCacheKey, MeshPrimitive>;
  public readonly geometry: MeshPrimitiveGeometry;

  public constructor(engine: IEngine, definition: MeshPrimitiveDefinition) {
    this.engine = engine;
    this.cache = new Map();
    this.geometry = new MeshPrimitiveGeometry(engine, definition);
  }

  /**
   * Get a {@link MeshPrimitive} instance from the cache for the material with
   * which it will be drawn.
   * @param materialInstance The material with which the primitive will be drawn.
   */
  public getOrCreate(materialInstance: MaterialInstance): MeshPrimitive {
    // Calculate "structural" key of material
    const materialStructuralCacheKey = this.createMaterialInstanceStructuralKey(materialInstance);

    const cachedResult = this.cache.get(materialStructuralCacheKey);
    if (cachedResult) {
      // Cache hit
      return cachedResult;
    } else {
      // Cache miss - create new instances and store in cache
      // console.log(`[${MeshPrimitiveCache.name}] (${this.getOrCreate.name}) Cache MISS with structural key ${materialStructuralCacheKey}`);

      const newInstance = MeshPrimitive.fromDefinition(this.engine, this.geometry, materialInstance);
      this.cache.set(materialStructuralCacheKey, newInstance);

      return newInstance;
    }
  }

  /**
   * Create a key for the cache that uniquely identifies a material instance based on its
   * structural properties (i.e. which features are enabled), rather than by reference or the
   * value of its properties. This ensures that {@linkcode MeshPrimitive} instances are only regenerated
   * when the material's structure changes.
   * @param materialInstance Material from which to create a key.
   * @returns A string cache key representing the structural configuration of the resolved material.
   */
  private createMaterialInstanceStructuralKey(materialInstance: MaterialInstance): MaterialCacheKey {
    const blendingModeType = materialInstance.blendingMode.type;
    const hasDiffuseColor = materialInstance.diffuseColor !== undefined;
    const hasDiffuseTexture = materialInstance.diffuseTexture !== undefined;
    const hasReflection = materialInstance.reflectionCubemap !== undefined;
    return `${blendingModeType}|${hasDiffuseColor}|${hasDiffuseTexture}|${hasReflection}`;
  }
}

export type Triangle = [aPos: Vector3, bPos: Vector3, cPos: Vector3];
export type TriangleIndices = [aIndex: number, bIndex: number, cIndex: number];
export type Edge = [startPos: Vector3, endPos: Vector3];
export type EdgeIndices = [aIndex: number, bIndex: number];
export type JointsIndices = [aIndex: number, bIndex: number, cIndex: number, dIndex: number];
export type JointsWeights = [aWeight: number, bWeight: number, cWeight: number, dWeight: number];

export class MeshPrimitiveGeometry {
  public readonly definition: MeshPrimitiveDefinition;

  /* Geometry */
  public readonly vertexPositions: Vector3[];
  public readonly vertexNormals: Vector3[];
  public readonly triangleIndices: TriangleIndices[];
  public readonly edgeIndices: EdgeIndices[];

  public readonly jointIndices?: JointsIndices[];
  public readonly jointWeights?: JointsWeights[];

  // @TODO Other vertex attributes
  // public readonly vertexColors: Color4[];
  // public readonly vertexTextureCoordinates: Vector2[];

  /* GL Data */
  private readonly _positionGLBuffer: Computed<WebGLBuffer>;
  private readonly _normalGLBuffer: Computed<WebGLBuffer>;
  private readonly _color0GLBuffer: Computed<WebGLBuffer>;
  private readonly _texCoord0GLBuffer: Computed<WebGLBuffer>;
  private readonly _joints0GLBuffer: Computed<WebGLBuffer>;
  private readonly _weights0GLBuffer: Computed<WebGLBuffer>;
  private readonly _indicesGLBuffer: Computed<WebGLBuffer>;

  public constructor(engine: IEngine, definition: MeshPrimitiveDefinition) {
    this.definition = definition;

    // ========
    // GEOMETRY
    // ========
    /* Vertex positions */
    this.vertexPositions = this.parseAttributeVector3(definition.positionData);

    /* Triangle indices */
    if (definition.indices) {
      // Triangles defined by vertex indices
      this.triangleIndices = this.parseAttributeTriangleIndices(definition.indices);
    } else {
      // Triangles assumed to be sequential
      this.triangleIndices = [];
      for (let i = 2; i < definition.positionData.buffer.length / 3; i += 3) {
        this.triangleIndices.push([
          i - 2,
          i - 1,
          i,
        ]);
      }
    }
    // @NOTE Sanity check triangle indices
    this.triangleIndices.forEach((triangle, triangleIndex) => {
      triangle.forEach((vertexIndex, i) => {
        if (this.vertexPositions[vertexIndex] === undefined) throw new Error(`Triangle ${triangleIndex} vertex ${i} is out of bounds: ${vertexIndex}`);
      });
    });

    /* Vertex normals */
    if (definition.normalData !== undefined) {
      // Normals provided by asset
      this.vertexNormals = this.parseAttributeVector3(definition.normalData);
    } else {
      // Normals MISSING from asset - generate normals
      // @TODO Move into the model loaders
      const triangleNormals = this.triangleIndices.map((triangle) => {
        const edge1 = this.vertexPositions[triangle[1]].subtract(this.vertexPositions[triangle[0]]);
        const edge2 = this.vertexPositions[triangle[2]].subtract(this.vertexPositions[triangle[0]]);
        return edge1.cross(edge2).normalizeSelf();
      });

      // Initialise normals to zero
      const normals = this.vertexPositions.map(() => Vector3.zero());

      this.triangleIndices.forEach((triangle, i) => {
        const triangleNormal = triangleNormals[i];
        // Add to each vertices' normal (will be normalized later)
        normals[triangle[0]].addSelf(triangleNormal);
        normals[triangle[1]].addSelf(triangleNormal);
        normals[triangle[2]].addSelf(triangleNormal);
      });

      // Normalize all vectors
      this.vertexNormals = normals.map((normal) => normal.normalizeSelf());
    }

    /* Edges */
    // Build up a set of all unique edge indices
    const edgeMap = new Map<string, EdgeIndices>();
    function addEdge(indexA: number, indexB: number): void {
      const edge: EdgeIndices = indexA < indexB ? [indexA, indexB] : [indexB, indexA];
      const edgeKey = `${edge[0]},${edge[1]}`;
      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, edge);
      }
    }
    this.triangleIndices.forEach((triangle) => {
      addEdge(triangle[0], triangle[1]);
      addEdge(triangle[1], triangle[2]);
      addEdge(triangle[2], triangle[0]);
    });

    this.edgeIndices = Array.from(edgeMap.values());

    /* Skin */
    if (definition.joints0Data) {
      this.jointIndices = this.parseAttributeJointsIndices(definition.joints0Data);
    }
    if (definition.weights0Data) {
      this.jointWeights = this.parseAttributeJointsWeights(definition.weights0Data);
    }


    // ==========
    // GL BUFFERS
    // ==========
    const { gl } = engine;
    // @TODO Low-level API. These probably aren't going to be Computed's.
    // They'll probably just be buffers that I mutate with `gl.bufferSubData()`
    // whenever a geometry value changes
    this._positionGLBuffer = new Computed(gl.createBuffer(), {
      dependencies: [], // @TODO
      recompute: (buffer) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.positionBuffer, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      },
    });
    this._normalGLBuffer = new Computed(gl.createBuffer(), {
      dependencies: [], // @TODO
      recompute: (buffer) => {
        const normalbuffer = this.normalBuffer;
        if (normalbuffer === undefined) {
          throw new Error(`Cannot calculate WebGLBuffer - mesh primitive has no normals`);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, normalbuffer, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      },
    });
    this._normalGLBuffer = new Computed(gl.createBuffer(), {
      dependencies: [], // @TODO
      recompute: (buffer) => {
        const normalbuffer = this.normalBuffer;
        if (normalbuffer === undefined) {
          throw new Error(`Cannot calculate WebGLBuffer - mesh primitive has no normals`);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, normalbuffer, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      },
    });
    this._color0GLBuffer = new Computed(gl.createBuffer(), {
      dependencies: [], // @TODO
      recompute: (buffer) => {
        const color0Buffer = this.color0Buffer;
        if (color0Buffer === undefined) {
          throw new Error(`Cannot calculate WebGLBuffer - mesh primitive has no colors`);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, color0Buffer, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      },
    });
    this._texCoord0GLBuffer = new Computed(gl.createBuffer(), {
      dependencies: [], // @TODO
      recompute: (buffer) => {
        const texCoord0Buffer = this.texCoord0Buffer;
        if (texCoord0Buffer === undefined) {
          throw new Error(`Cannot calculate WebGLBuffer - mesh primitive has no texture coordinates`);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoord0Buffer, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      },
    });
    this._joints0GLBuffer = new Computed(gl.createBuffer(), {
      dependencies: [], // @TODO
      recompute: (buffer) => {
        const joints0Buffer = this.joints0Buffer;
        if (joints0Buffer === undefined) {
          throw new Error(`Cannot calculate WebGLBuffer - mesh primitive has no skin joints`);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, joints0Buffer, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      },
    });
    this._weights0GLBuffer = new Computed(gl.createBuffer(), {
      dependencies: [], // @TODO
      recompute: (buffer) => {
        const weights0Buffer = this.weights0Buffer;
        if (weights0Buffer === undefined) {
          throw new Error(`Cannot calculate WebGLBuffer - mesh primitive has no skin weights`);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, weights0Buffer, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      },
    });
    this._indicesGLBuffer = new Computed(gl.createBuffer(), {
      dependencies: [], // @TODO
      recompute: (buffer) => {
        const indicesBuffer = this.indicesBuffer;
        if (indicesBuffer === undefined) {
          throw new Error(`Cannot calculate WebGLBuffer - mesh primitive has no indices`);
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      },
    });
  }

  private parseAttributeVector3(attribute: AttributeDefinition): Vector3[] {
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

  private parseAttributeTriangleIndices(attribute: AttributeDefinition): TriangleIndices[] {
    /*
      @NOTE Mesh primitive indices must be SCALAR and unsigned integer type.
      See: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#_mesh_primitive_indices
     */

    if (attribute.componentCount !== 1) {
      throw new Error(`Cannot parse attribute as Triangle Indices: component count is not 1 (componentCount='${attribute.componentCount}')`);
    }


    const result: TriangleIndices[] = [];

    for (let i = 2; i < attribute.buffer.length; i += 3) {
      result.push([
        attribute.buffer[i - 2],
        attribute.buffer[i - 1],
        attribute.buffer[i],
      ]);
    }

    return result;
  }

  public parseAttributeJointsIndices(attribute: AttributeDefinition): JointsIndices[] {
    /*
      @NOTE Mesh primitive joint indices attributes must be VEC4 and unsigned integer type.
      See: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview
     */

    if (attribute.componentCount !== 4) {
      throw new Error(`Cannot parse attribute as Joints Indices: component count is not 4 (componentCount='${attribute.componentCount}')`);
    }

    const result: JointsIndices[] = [];

    for (let i = 3; i < attribute.buffer.length; i += 4) {
      result.push([
        attribute.buffer[i - 3],
        attribute.buffer[i - 2],
        attribute.buffer[i - 1],
        attribute.buffer[i],
      ]);
    }

    return result;
  }
  public parseAttributeJointsWeights(attribute: AttributeDefinition): JointsIndices[] {
    /*
      @NOTE Mesh primitive joint weights attributes must be VEC4 and float or normalized unsigned integer type.
      See: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview
     */

    if (attribute.componentCount !== 4) {
      throw new Error(`Cannot parse attribute as Joints Weights: component count is not 4 (componentCount='${attribute.componentCount}')`);
    }

    const result: JointsIndices[] = [];

    for (let i = 3; i < attribute.buffer.length; i += 4) {
      result.push([
        this.normalizeValue(attribute.buffer[i - 3], attribute),
        this.normalizeValue(attribute.buffer[i - 2], attribute),
        this.normalizeValue(attribute.buffer[i - 1], attribute),
        this.normalizeValue(attribute.buffer[i], attribute),
      ]);
    }

    return result;
  }

  private normalizeValue(value: number, attributeDefinition: AttributeDefinition): number {
    if (attributeDefinition.normalized === false) {
      // Data does not need normalizing
      return value;
    } else {
      // Data needs to be normalized
      // @NOTE Slightly cursed normalization logic in GLTF specification.
      // Maximally negative values (like -128 for BYTE) are clamped to -1.
      // See: https://github.com/KhronosGroup/glTF/issues/1317
      switch (attributeDefinition.componentType) {
        case WebGL2RenderingContext['BYTE']:
          return Math.max(value / 0x7F, -1);
        case WebGL2RenderingContext['UNSIGNED_BYTE']:
          return value / 0xFF;
        case WebGL2RenderingContext['SHORT']:
          return Math.max(value / 0x7FFF, -1);
        case WebGL2RenderingContext['UNSIGNED_SHORT']:
          return value / 0xFFFF;

        // Unsigned int / float not valid to be normalized
        // See: https://github.com/KhronosGroup/glTF/blob/4ecfc3bd8c439a1c3feab04218212e6b9b222253/specification/2.0/schema/accessor.schema.json#L66
        case WebGL2RenderingContext['UNSIGNED_INT']:
          throw new Error(`Invalid accessor definition. Data specifies 'normalized' but is of type 'UNSIGNED_INT' (${WebGL2RenderingContext['UNSIGNED_INT']})`);
        case WebGL2RenderingContext['FLOAT']:
          throw new Error(`Invalid accessor definition. Data specifies 'normalized' but is of type 'FLOAT' (${WebGL2RenderingContext['FLOAT']})`);

        // Unimplemented / future values
        default:
          throw new Error(`Unimplemented attribute component type: ${attributeDefinition.componentType}`);
      }
    }
  }

  /* Mesh primitive attribute definitions */
  public get glMode(): MeshPrimitiveMode { return this.definition.mode; }
  public get extents(): Extents { return this.definition.extents; }
  public get positionData(): AttributeDefinition { return this.definition.positionData; }
  public get normalData(): AttributeDefinition | undefined { return this.definition.normalData; }
  public get color0Data(): AttributeDefinition | undefined { return this.definition.color0Data; }
  public get texCoord0Data(): AttributeDefinition | undefined { return this.definition.texCoord0Data; }
  public get joints0Data(): AttributeDefinition | undefined { return this.definition.joints0Data; }
  public get weights0Data(): AttributeDefinition | undefined { return this.definition.weights0Data; }
  public get indices(): AttributeDefinition | undefined { return this.definition.indices; }
  public get material(): MaterialDefinition | undefined { return this.definition.material; }

  /* Data buffers */
  // @TODO Low-level API we'll probably take copies of these buffers and mutate them
  private get positionBuffer(): TypedArray { return this.positionData.buffer; }
  private get normalBuffer(): TypedArray | undefined { return this.normalData?.buffer; }
  private get color0Buffer(): TypedArray | undefined { return this.color0Data?.buffer; }
  private get texCoord0Buffer(): TypedArray | undefined { return this.texCoord0Data?.buffer; }
  private get joints0Buffer(): TypedArray | undefined { return this.joints0Data?.buffer; }
  private get weights0Buffer(): TypedArray | undefined { return this.weights0Data?.buffer; }
  private get indicesBuffer(): TypedArray | undefined { return this.indices?.buffer; }

  /* GL Buffers */
  public get positionGLBuffer(): WebGLBuffer { return this._positionGLBuffer.value; }
  public get normalGLBuffer(): WebGLBuffer { return this._normalGLBuffer.value; }
  public get color0GLBuffer(): WebGLBuffer { return this._color0GLBuffer.value; }
  public get texCoord0GLBuffer(): WebGLBuffer { return this._texCoord0GLBuffer.value; }
  public get joints0GLBuffer(): WebGLBuffer { return this._joints0GLBuffer.value; }
  public get weights0GLBuffer(): WebGLBuffer { return this._weights0GLBuffer.value; }
  public get indicesGLBuffer(): WebGLBuffer { return this._indicesGLBuffer.value; }
}

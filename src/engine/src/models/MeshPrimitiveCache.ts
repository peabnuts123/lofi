import { Color4, Vector2, Vector3, type IReadonlyVector3 } from "@lofi/core/math";
import type { IEngine } from "@lofi/engine/Engine";
import type {
  AnyAttributeDefinition,
  AttributeDefinition,
  BaseAttributeDefinition,
  Extents,
  MaterialDefinition,
  MeshPrimitiveDefinition,
  MeshPrimitiveMode,
  VertexPositionAttributeDefinition,
  VertexNormalAttributeDefinition,
  VertexTextureCoordinateAttributeDefinition,
  VertexColorAttributeDefinition,
  VertexJointIndicesAttributeDefinition,
  VertexJointWeightsAttributeDefinition,
  TriangleIndicesAttributeDefinition,
} from "@lofi/engine/loaders/definitions";
import { MaterialInstance, ShaderBlendingModeTypeEnumValue } from "@lofi/engine/materials";
import { createBuffer } from "@lofi/engine/util/createBuffer";

import { MeshPrimitive } from "./MeshPrimitive";
import { Computed, Observable, type Mutable, type TypedArray } from "@lofi/core/util";

type MaterialCacheKey = number;

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
    this.geometry = new MeshPrimitiveGeometry({
      engine,
      definition,
    });
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
  private createMaterialInstanceStructuralKey(material: MaterialInstance): MaterialCacheKey {
    const blendingMode = ShaderBlendingModeTypeEnumValue[material.blendingMode.type];
    const hasDiffuseColor = material.diffuseColor !== undefined;
    const hasDiffuseTexture = material.diffuseTexture !== undefined && this.geometry.texCoord0Attribute !== undefined;
    // @NOTE @ASSUMPTION if skin attributes are defined then ModelPart has a skin defined
    const unlit = material.unlit;
    const hasReflection = material.reflectionCubemap !== undefined;

    // @TODO BYO shader will need to key off IShader.id or similar.

    return (
        // @NOTE Limited to 3 bits since `blendingMode.type` currently has <8 values
        /* bits 0-2 */ blendingMode |
        // @ts-expect-error Shifting a boolean is fine
        /* bit 3   */ (hasDiffuseColor << 3) |
        // @ts-expect-error Shifting a boolean is fine
        /* bit 4   */ (hasDiffuseTexture << 4) |
        // @ts-expect-error Shifting a boolean is fine
        /* bit 5   */ (unlit << 5) |
        // @ts-expect-error Shifting a boolean is fine
        /* bit 6   */ (hasReflection << 6)
    );
  }
}

export type Triangle = readonly [aPos: IReadonlyVector3, bPos: IReadonlyVector3, cPos: IReadonlyVector3];
export type Edge = readonly [startPos: IReadonlyVector3, endPos: IReadonlyVector3];
export type EdgeIndices = readonly [aIndex: number, bIndex: number];
// @TODO Move somewhere
export interface IReadonlyTriangleIndices {
  get aIndex(): number;
  get bIndex(): number;
  get cIndex(): number;
}
export class TriangleIndices extends Observable implements IReadonlyTriangleIndices {
  private _aIndex: number;
  private _bIndex: number;
  private _cIndex: number;

  public constructor(aIndex: number, bIndex: number, cIndex: number) {
    super();
    this._aIndex = Math.trunc(aIndex);
    this._bIndex = Math.trunc(bIndex);
    this._cIndex = Math.trunc(cIndex);
  }

  public setValue(a: number, b: number, c: number): void {
      this._aIndex = a;
      this._bIndex = b;
      this._cIndex = c;
      this.notifyOnChange();
  }

  public get aIndex(): number {
    return this._aIndex;
  }
  public set aIndex(value: number) {
    this._aIndex = Math.trunc(value);
    this.notifyOnChange();
  }
  public get bIndex(): number {
    return this._bIndex;
  }
  public set bIndex(value: number) {
    this._bIndex = Math.trunc(value);
    this.notifyOnChange();
  }
  public get cIndex(): number {
    return this._cIndex;
  }
  public set cIndex(value: number) {
    this._cIndex = Math.trunc(value);
    this.notifyOnChange();
  }
}
// @TODO REVIEW Rename singular
export type JointIndicesKey = 0 | 1 | 2 | 3;
export class JointsIndices extends Observable {
  private _0: number;
  private _1: number;
  private _2: number;
  private _3: number;

  public constructor(_0: number, _1: number, _2: number, _3: number) {
    super();
    this._0 = Math.trunc(_0);
    this._1 = Math.trunc(_1);
    this._2 = Math.trunc(_2);
    this._3 = Math.trunc(_3);
  }

  public get [0](): number {
    return this._0;
  }
  public set [0](value: number) {
    this._0 = Math.trunc(value);
    this.notifyOnChange();
  }
  public get [1](): number {
    return this._1;
  }
  public set [1](value: number) {
    this._1 = Math.trunc(value);
    this.notifyOnChange();
  }
  public get [2](): number {
    return this._2;
  }
  public set [2](value: number) {
    this._2 = Math.trunc(value);
    this.notifyOnChange();
  }
  public get [3](): number {
    return this._3;
  }
  public set [3](value: number) {
    this._3 = Math.trunc(value);
    this.notifyOnChange();
  }
}
// @TODO Rename this and other things to `JointWeights` (singular)
export type JointWeightsKey = 0 | 1 | 2 | 3;
export class JointsWeights extends Observable {
  private _0: number;
  private _1: number;
  private _2: number;
  private _3: number;

  public constructor(_0: number, _1: number, _2: number, _3: number) {
    super();
    this._0 = _0;
    this._1 = _1;
    this._2 = _2;
    this._3 = _3;
  }

  public get [0](): number {
    return this._0;
  }
  public set [0](value: number) {
    this._0 = value;
    this.notifyOnChange();
  }
  public get [1](): number {
    return this._1;
  }
  public set [1](value: number) {
    this._1 = value;
    this.notifyOnChange();
  }
  public get [2](): number {
    return this._2;
  }
  public set [2](value: number) {
    this._2 = value;
    this.notifyOnChange();
  }
  public get [3](): number {
    return this._3;
  }
  public set [3](value: number) {
    this._3 = value;
    this.notifyOnChange();
  }
}

export interface MeshPrimitiveGeometryArgs {
  engine: IEngine;
  definition: MeshPrimitiveDefinition;
}

/*
  @TODO Low level API work backlog
    // - Implement `clearPrimitiveCache`
    - Expose these types from a public place (i.e. iterating model => modelpart => meshprim)
    - Make Immutable geometry types and use them in parent Geometry classes (e.g. Model.geometry)
    // - Listen to observable callbacks on parsed geometry values (e.g. vertex position Vector3s) and
      // update buffers when they change
    // - Implement the rest of the attributes (e.g. color, texCoords)
    // - Implement public API to add/clear optional vertex attributes
    // - Probably we need to sort out this whole definition + parsed data + GL Buffer paired lists thing~
    // - Need to straighten out `indices` and its relationship to triangles (e.g. triangleIndices?)
    // - Make types like `TriangleIndices` and `JointsIndices` observable
    // - I GUESS make `EdgeIndices` and `Edge` immutable??
 */

export type BaseVertexDefinition<TAttributeDefinition extends AnyAttributeDefinition> =
  TAttributeDefinition extends AttributeDefinition<infer ComponentCount, infer ComponentType> ?
  // Common keys of `TAttributeDefinition` and `BaseAttributeDefinition`
  Pick<TAttributeDefinition,
    Extract<
      keyof TAttributeDefinition,
      keyof BaseAttributeDefinition<ComponentCount, ComponentType>
    >
  > : never;
export type AnyVertexAttribute = VertexAttribute<AnyAttributeDefinition>;
export type VertexAttribute<TAttributeDefinition extends AnyAttributeDefinition> =
  BaseVertexDefinition<TAttributeDefinition> & {
    glBuffer: WebGLBuffer;
  };
export type VertexPositionAttribute = VertexAttribute<VertexPositionAttributeDefinition>;
export type VertexNormalAttribute = VertexAttribute<VertexNormalAttributeDefinition>;
export type VertexTextureCoordinateAttribute = VertexAttribute<VertexTextureCoordinateAttributeDefinition>;
export type VertexColorAttribute = VertexAttribute<VertexColorAttributeDefinition>;
export type VertexJointIndicesAttribute = VertexAttribute<VertexJointIndicesAttributeDefinition>;
export type VertexJointWeightsAttribute = VertexAttribute<VertexJointWeightsAttributeDefinition>;
export type TriangleIndicesAttribute = VertexAttribute<TriangleIndicesAttributeDefinition>;

export class MeshPrimitiveGeometry {
  private readonly engine: IEngine;

  /* Mesh primitive */
  public readonly glMode: MeshPrimitiveMode;
  public readonly extents: Extents;
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
  public readonly vertexPositions: readonly Vector3[];
  public readonly vertexNormals: readonly Vector3[];
  public readonly triangleIndices: readonly TriangleIndices[];
  public readonly edgeIndices: Computed<readonly EdgeIndices[]>;
  public readonly jointIndices: readonly JointsIndices[] | undefined;
  public readonly jointWeights: readonly JointsWeights[] | undefined;
  public readonly vertexColors: readonly Color4[] | undefined;
  public readonly vertexTextureCoordinates: readonly Vector2[] | undefined;

  public constructor({ engine, definition }: MeshPrimitiveGeometryArgs) {
    this.engine = engine;

    this.glMode = definition.mode;
    this.extents = definition.extents;
    this.defaultMaterialDefinition = definition.material;

    const { gl } = engine;

    /* Vertex positions */
    // Parse data
    this.vertexPositions = Object.freeze(this.parsePositionNormalAttribute(definition.positionData));
    // Create GL buffer
    this.positionAttribute = this.createVertexAttribute(definition.positionData, gl.ARRAY_BUFFER);
    // Bind updates to GL buffer
    const tmp_updatedVertexPositionBuffer = this.createTmpBufferForVertexAttribute(this.positionAttribute);
    this.vertexPositions.forEach((vertexPosition, i) => {
      vertexPosition.onChange(() => {
        /* Update vertex position gl buffer */
        tmp_updatedVertexPositionBuffer[0] = vertexPosition.x;
        tmp_updatedVertexPositionBuffer[1] = vertexPosition.y;
        tmp_updatedVertexPositionBuffer[2] = vertexPosition.z;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionAttribute.glBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, i * this.positionAttribute.componentCount * this.positionAttribute.componentSize, tmp_updatedVertexPositionBuffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      });
    });

    /* Triangle indices */
    if (definition.indices) {
      // Triangles defined by vertex indices
      // Parse data
      this.triangleIndices = Object.freeze(this.parseIndicesAttribute(definition.indices));
      // Create GL buffer
      this.indicesAttribute = this.createVertexAttribute(definition.indices, gl.ELEMENT_ARRAY_BUFFER);
    } else {
      // Triangles assumed to be sequential
      // Generate data
      const triangleIndices: TriangleIndices[] = this.triangleIndices = [];
      const glBufferData = new Uint32Array(this.vertexPositions.length);
      for (let i = 2; i < this.vertexPositions.length; i += 3) {
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
        glBuffer: createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, glBufferData),
        componentCount: 1,
        componentSize: 4,
        componentType: gl.UNSIGNED_INT,
        normalized: false,
      };
    }
    // @NOTE Sanity check triangle indices
    this.triangleIndices.forEach((triangle, triangleIndex) => {
      for (const i of ['aIndex', 'bIndex', 'cIndex'] as const) {
        const vertexIndex = triangle[i];
        if (this.vertexPositions[vertexIndex] === undefined) {
          throw new Error(`Triangle ${triangleIndex} vertex ${i} is out of bounds: ${vertexIndex}`);
        }
      }
    });
    // Bind updates to GL buffer
    // @NOTE Need custom logic for tmp buffer for indices since spec says that
    // indices component count is 1, yet triangles need 3 indices.
    const IndicesBufferCustomLength = 3;
    let tmp_updatedVertexIndexBuffer: TypedArray;
    switch (this.indicesAttribute.componentType) {
      case WebGL2RenderingContext['UNSIGNED_BYTE']:
        tmp_updatedVertexIndexBuffer = new Uint8Array(IndicesBufferCustomLength);
        break;
      case WebGL2RenderingContext['UNSIGNED_SHORT']:
        tmp_updatedVertexIndexBuffer = new Uint16Array(IndicesBufferCustomLength);
        break;
      case WebGL2RenderingContext['UNSIGNED_INT']:
        tmp_updatedVertexIndexBuffer = new Uint32Array(IndicesBufferCustomLength);
        break;
      default:
        throw new Error(`Unimplemented indices attribute component type: ${(this.indicesAttribute as { componentType: number }).componentType}`);
    }
    this.triangleIndices.forEach((triangleIndices, i) => {
      triangleIndices.onChange(() => {
        /* Update triangle indices gl buffer */
        tmp_updatedVertexIndexBuffer[0] = triangleIndices["aIndex"];
        tmp_updatedVertexIndexBuffer[1] = triangleIndices["bIndex"];
        tmp_updatedVertexIndexBuffer[2] = triangleIndices["cIndex"];

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indicesAttribute.glBuffer);
        gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, i * IndicesBufferCustomLength * this.indicesAttribute.componentSize, tmp_updatedVertexIndexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      });
    });

    /* Vertex normals */
    if (definition.normalData !== undefined) {
      // Normals provided by asset
      // Parse data
      this.vertexNormals = Object.freeze(this.parsePositionNormalAttribute(definition.normalData));
      // Create GL buffer
      this.normalAttribute = this.createVertexAttribute(definition.normalData, gl.ARRAY_BUFFER);
    } else {
      // Normals MISSING from asset
      // Generate data
      this.vertexNormals = Object.freeze(this.vertexPositions.map(() => Vector3.zero()));
      this.recomputeVertexNormals();

      // Write data to GL buffer
      const glBufferData = new Float32Array(this.vertexNormals.length * 3);
      for (let i = 0; i < this.vertexNormals.length; i++) {
        const vertexNormal = this.vertexNormals[i];
        glBufferData[i * 3] = vertexNormal.x;
        glBufferData[i * 3 + 1] = vertexNormal.y;
        glBufferData[i * 3 + 2] = vertexNormal.z;
      }

      // Create GL buffer
      this.normalAttribute = {
        glBuffer: createBuffer(gl, gl.ARRAY_BUFFER, glBufferData),
        componentCount: 3,
        componentSize: 4,
        componentType: gl.FLOAT,
        normalized: false,
      };
    }
    // Bind updates to GL buffer
    const tmp_updatedVertexNormalBuffer = this.createTmpBufferForVertexAttribute(this.normalAttribute);
    this.vertexNormals.forEach((vertexNormal, i) => {
      vertexNormal.onChange(() => {
        /* Update vertex normal gl buffer */
        tmp_updatedVertexNormalBuffer[0] = vertexNormal.x;
        tmp_updatedVertexNormalBuffer[1] = vertexNormal.y;
        tmp_updatedVertexNormalBuffer[2] = vertexNormal.z;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalAttribute.glBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, i * this.normalAttribute.componentCount * this.normalAttribute.componentSize, tmp_updatedVertexNormalBuffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      });
    });

    /* Edges */
    // @NOTE Edges are entirely computed based on parsed geometry
    this.edgeIndices = new Computed<readonly EdgeIndices[]>([], {
      dependencies: this.triangleIndices,
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
        this.triangleIndices.forEach((triangle) => {
          addEdge(triangle['aIndex'], triangle['bIndex']);
          addEdge(triangle['bIndex'], triangle['cIndex']);
          addEdge(triangle['cIndex'], triangle['aIndex']);
        });

        for (const edge of edgeMap.values()) {
          self.push(edge);
        }
      },
    });

    /* Skin */
    if (definition.joints0Data && definition.weights0Data) {
      // Parse data
      this.jointIndices = Object.freeze(this.parseJointIndicesAttribute(definition.joints0Data));
      this.jointWeights = Object.freeze(this.parseJointWeightsAttribute(definition.weights0Data));
      // Create GL buffer
      this.joints0Attribute = this.createVertexAttribute(definition.joints0Data, gl.ARRAY_BUFFER);
      this.weights0Attribute = this.createVertexAttribute(definition.weights0Data, gl.ARRAY_BUFFER);
      // Bind updates to GL buffer
      const tmp_updatedJointIndicesBuffer = this.createTmpBufferForVertexAttribute(this.joints0Attribute);
      this.jointIndices.forEach((jointIndices, i) => {
        jointIndices.onChange(() => {
          /* Update joint indices gl buffer */
          tmp_updatedJointIndicesBuffer[0] = jointIndices[0];
          tmp_updatedJointIndicesBuffer[1] = jointIndices[1];
          tmp_updatedJointIndicesBuffer[2] = jointIndices[2];
          tmp_updatedJointIndicesBuffer[3] = jointIndices[3];
          gl.bindBuffer(gl.ARRAY_BUFFER, this.joints0Attribute!.glBuffer);
          gl.bufferSubData(gl.ARRAY_BUFFER, i * this.joints0Attribute!.componentCount * this.joints0Attribute!.componentSize, tmp_updatedJointIndicesBuffer);
          gl.bindBuffer(gl.ARRAY_BUFFER, null);
        });
      });
      const tmp_updatedJointWeightsBuffer = this.createTmpBufferForVertexAttribute(this.weights0Attribute);
      this.jointWeights.forEach((jointWeights, i) => {
        jointWeights.onChange(() => {
          /* Update joint weights gl buffer */
          tmp_updatedJointWeightsBuffer[0] = this.denormalizeValue(jointWeights[0], this.weights0Attribute!);
          tmp_updatedJointWeightsBuffer[1] = this.denormalizeValue(jointWeights[1], this.weights0Attribute!);
          tmp_updatedJointWeightsBuffer[2] = this.denormalizeValue(jointWeights[2], this.weights0Attribute!);
          tmp_updatedJointWeightsBuffer[3] = this.denormalizeValue(jointWeights[3], this.weights0Attribute!);
          gl.bindBuffer(gl.ARRAY_BUFFER, this.weights0Attribute!.glBuffer);
          gl.bufferSubData(gl.ARRAY_BUFFER, i * this.weights0Attribute!.componentCount * this.weights0Attribute!.componentSize, tmp_updatedJointWeightsBuffer);
          gl.bindBuffer(gl.ARRAY_BUFFER, null);
        });
      });
    }

    /* Colors */
    if (definition.color0Data) {
      // Parse data
      this.vertexColors = Object.freeze(this.parseVertexColorAttribute(definition.color0Data));
      // Create GL buffer
      this.color0Attribute = this.createVertexAttribute(definition.color0Data, gl.ARRAY_BUFFER);
      // Bind updates to GL buffer
      const tmp_updatedVertexColorBuffer = this.createTmpBufferForVertexAttribute(this.color0Attribute);
      this.vertexColors.forEach((vertexColor, i) => {
        vertexColor.onChange(() => {
          /* Update vertex color gl buffer */
          tmp_updatedVertexColorBuffer[0] = this.denormalizeValue(vertexColor.r / 0xFF, this.color0Attribute!);
          tmp_updatedVertexColorBuffer[1] = this.denormalizeValue(vertexColor.g / 0xFF, this.color0Attribute!);
          tmp_updatedVertexColorBuffer[2] = this.denormalizeValue(vertexColor.b / 0xFF, this.color0Attribute!);
          if (this.color0Attribute!.componentCount === 4) {
            tmp_updatedVertexColorBuffer[3] = this.denormalizeValue(vertexColor.a / 0xFF, this.color0Attribute!);
          }
          gl.bindBuffer(gl.ARRAY_BUFFER, this.color0Attribute!.glBuffer);
          gl.bufferSubData(gl.ARRAY_BUFFER, i * this.color0Attribute!.componentCount * this.color0Attribute!.componentSize, tmp_updatedVertexColorBuffer);
          gl.bindBuffer(gl.ARRAY_BUFFER, null);
        });
      });
    }

    /* Texture coordinates */
    if (definition.texCoord0Data) {
      // Parse data
      this.vertexTextureCoordinates = Object.freeze(this.parseVertexTextureCoordinatesAttribute(definition.texCoord0Data));
      // Create GL buffer
      this.texCoord0Attribute = this.createVertexAttribute(definition.texCoord0Data, gl.ARRAY_BUFFER);
      // Bind updates to GL buffer
      const tmp_updatedVertexTexCoordBuffer = this.createTmpBufferForVertexAttribute(this.texCoord0Attribute);
      this.vertexTextureCoordinates.forEach((vertexTexCoord, i) => {
        vertexTexCoord.onChange(() => {
          /* Update vertex texCoord gl buffer */
          tmp_updatedVertexTexCoordBuffer[0] = this.denormalizeValue(vertexTexCoord.x, this.texCoord0Attribute!);
          tmp_updatedVertexTexCoordBuffer[1] = this.denormalizeValue(vertexTexCoord.y, this.texCoord0Attribute!);
          gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoord0Attribute!.glBuffer);
          gl.bufferSubData(gl.ARRAY_BUFFER, i * this.texCoord0Attribute!.componentCount * this.texCoord0Attribute!.componentSize, tmp_updatedVertexTexCoordBuffer);
          gl.bindBuffer(gl.ARRAY_BUFFER, null);
        });
      });
    }
  }

  private tmp_recomputeVertexNormals_edgeA = Vector3.zero();
  private tmp_recomputeVertexNormals_edgeB = Vector3.zero();
  private tmp_recomputeVertexNormals_triangleNormal = Vector3.zero();
  private tmp_recomputeVertexNormals_normalBuffer: Vector3[] = [];
  public recomputeVertexNormals(): void {
    // Initialise temporary buffer
    if (this.tmp_recomputeVertexNormals_normalBuffer.length !== this.vertexPositions.length) {
      this.tmp_recomputeVertexNormals_normalBuffer = this.vertexPositions.map(() => Vector3.zero());
    } else {
      this.tmp_recomputeVertexNormals_normalBuffer.forEach((vertexNormal) => vertexNormal.setValue(0, 0, 0));
    }

    // For each triangle
    for (const triangleIndices of this.triangleIndices) {
      // Compute triangle normal from cross product of two edges
      const edge1 = this.tmp_recomputeVertexNormals_edgeA
        .setValue(this.vertexPositions[triangleIndices[`bIndex`]])
        .subtractSelf(this.vertexPositions[triangleIndices[`aIndex`]]);
      const edge2 = this.tmp_recomputeVertexNormals_edgeB
        .setValue(this.vertexPositions[triangleIndices[`cIndex`]])
        .subtractSelf(this.vertexPositions[triangleIndices[`aIndex`]]);
      const triangleNormal = this.tmp_recomputeVertexNormals_triangleNormal
        .setValue(edge1)
        .crossSelf(edge2)
        .normalizeSelf();

      // Add triangle normal to each vertices' normal
      this.tmp_recomputeVertexNormals_normalBuffer[triangleIndices[`aIndex`]].addSelf(triangleNormal);
      this.tmp_recomputeVertexNormals_normalBuffer[triangleIndices[`bIndex`]].addSelf(triangleNormal);
      this.tmp_recomputeVertexNormals_normalBuffer[triangleIndices[`cIndex`]].addSelf(triangleNormal);
    }

    // Normalise and assign normals (so that we only write each normal once)
    // this.vertexNormals.forEach((vertexNormal) => vertexNormal.normalizeSelf());
    this.tmp_recomputeVertexNormals_normalBuffer.forEach((vertexNormal, i) => {
      this.vertexNormals[i].setValue(vertexNormal.normalizeSelf());
    });
  }

  private createVertexAttribute<TAttributeDefinition extends AnyAttributeDefinition>(attributeDefinition: TAttributeDefinition, bufferType: GLenum = WebGL2RenderingContext.ARRAY_BUFFER): VertexAttribute<TAttributeDefinition> {
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

  private createTmpBufferForVertexAttribute(attribute: AnyVertexAttribute): TypedArray {
    switch (attribute.componentType) {
      case WebGL2RenderingContext['BYTE']:
        return new Int8Array(attribute.componentCount);
      case WebGL2RenderingContext['UNSIGNED_BYTE']:
        return new Uint8Array(attribute.componentCount);
      case WebGL2RenderingContext['SHORT']:
        return new Int16Array(attribute.componentCount);
      case WebGL2RenderingContext['UNSIGNED_SHORT']:
        return new Uint16Array(attribute.componentCount);
      // @NOTE Accessors under the GLTF specification cannot be signed INT
      case WebGL2RenderingContext['UNSIGNED_INT']:
        return new Uint32Array(attribute.componentCount);
      case WebGL2RenderingContext['FLOAT']:
        return new Float32Array(attribute.componentCount);
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

  private parseJointIndicesAttribute(attribute: VertexJointIndicesAttributeDefinition): JointsIndices[] {
    /*
      @NOTE Mesh primitive joint indices attributes must be VEC4 and unsigned integer type.
      See: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview
     */

    if (attribute.componentCount !== 4) {
      throw new Error(`Cannot parse attribute as Joints Indices: component count is not 4 (componentCount='${attribute.componentCount}')`);
    }

    const result: JointsIndices[] = [];

    for (let i = 3; i < attribute.buffer.length; i += 4) {
      result.push(new JointsIndices(
        attribute.buffer[i - 3],
        attribute.buffer[i - 2],
        attribute.buffer[i - 1],
        attribute.buffer[i],
      ));
    }

    return result;
  }

  private parseJointWeightsAttribute(attribute: VertexJointWeightsAttributeDefinition): JointsWeights[] {
    /*
      @NOTE Mesh primitive joint weights attributes must be VEC4 and float or normalized unsigned integer type.
      See: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview
     */

    if (attribute.componentCount !== 4) {
      throw new Error(`Cannot parse attribute as Joints Weights: component count is not 4 (componentCount='${attribute.componentCount}')`);
    }

    const result: JointsWeights[] = [];

    for (let i = 3; i < attribute.buffer.length; i += 4) {
      result.push(new JointsWeights(
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
        case WebGL2RenderingContext['BYTE']:
          return value * 0x7F;
        case WebGL2RenderingContext['UNSIGNED_BYTE']:
          return value * 0xFF;
        case WebGL2RenderingContext['SHORT']:
          return value * 0x7FFF;
        case WebGL2RenderingContext['UNSIGNED_SHORT']:
          return value * 0xFFFF;

        // Unsigned int / float not valid to be normalized
        // See: https://github.com/KhronosGroup/glTF/blob/4ecfc3bd8c439a1c3feab04218212e6b9b222253/specification/2.0/schema/accessor.schema.json#L66
        case WebGL2RenderingContext['UNSIGNED_INT']:
          throw new Error(`Invalid accessor definition. Data specifies 'normalized' but is of type 'UNSIGNED_INT' (${WebGL2RenderingContext['UNSIGNED_INT']})`);
        case WebGL2RenderingContext['FLOAT']:
          throw new Error(`Invalid accessor definition. Data specifies 'normalized' but is of type 'FLOAT' (${WebGL2RenderingContext['FLOAT']})`);

        // Unimplemented / future values
        default:
          throw new Error(`Unimplemented attribute component type: ${(attributeDefinition as { componentType: number }).componentType}`);
      }
    }
  }
}

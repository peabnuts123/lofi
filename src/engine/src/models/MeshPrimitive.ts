import { Vector3 } from "@lofi/core/math/vector";
import type { Matrix4 } from "@lofi/core/math/Matrix4";
import { IdPool } from "@lofi/core/util/IdPool";
import type { DrawTask, IEngine, OpaqueDrawTask, TransparentDrawTask } from "@lofi/engine/Engine";
import { ShaderCache, ShaderVariant, MaterialInstance } from "@lofi/engine/materials";
import type { AttributeDefinition } from "@lofi/engine/loaders/definitions";
import type { MeshPrimitiveGeometry } from "./MeshPrimitiveCache";

export interface MeshPrimitiveExtents {
  min: Vector3;
  max: Vector3;
  center: Vector3;
}

/**
 * A sub-piece of a mesh that is all drawn with one material.
 */
export class MeshPrimitive {
  private static readonly IdPool: IdPool = new IdPool();

  private readonly id: number;
  private readonly shader: ShaderVariant;
  private readonly extents: MeshPrimitiveExtents;
  private readonly drawTaskDrawFn: DrawTask['draw'];

  private readonly _cameraSpacePositionTmp: Vector3 = Vector3.zero();

  private constructor(
    shader: ShaderVariant,
    extents: MeshPrimitiveExtents,
    vao: WebGLVertexArrayObject,
    drawPrimitive: () => void,
  ) {
    this.id = MeshPrimitive.IdPool.createNew();
    this.shader = shader;
    this.extents = extents;

    this.drawTaskDrawFn = {
      id: this.id,
      init: ({ gl }) => {
        gl.bindVertexArray(vao);
      },
      exec: drawPrimitive,
    };
  }

  public draw(
    drawQueue: DrawTask[],
    renderLayer: number,
    modelViewMatrix: Matrix4,
    material: MaterialInstance,
    uniforms: DrawTask['uniforms'],
  ): void {
    const materialBlendingMode = material.blendingMode.type;
    const isMaterialTransparent = materialBlendingMode === 'Additive' ||
      materialBlendingMode === 'AlphaBlend' ||
      materialBlendingMode === 'Average' ||
      materialBlendingMode === 'Subtractive';

    if (isMaterialTransparent) {
      // Transform local-space extents to world camera space
      // for depth sorting
      this._cameraSpacePositionTmp
        .setValue(this.extents.center)
        .multiplySelf(modelViewMatrix);

      drawQueue.push({
        renderLayer,
        isTransparent: isMaterialTransparent,
        depth: this._cameraSpacePositionTmp.z,
        shaderVariant: this.shader,
        material,
        uniforms,
        draw: this.drawTaskDrawFn,
      } satisfies TransparentDrawTask);
    } else {
      drawQueue.push({
        renderLayer,
        isTransparent: isMaterialTransparent,
        shaderVariant: this.shader,
        material,
        uniforms,
        draw: this.drawTaskDrawFn,
      } satisfies OpaqueDrawTask);
    }
  }

  public static fromDefinition(
    engine: IEngine,
    primitive: MeshPrimitiveGeometry,
    material: MaterialInstance,
  ): MeshPrimitive {
    const { gl } = engine;

    const shader = ShaderCache.getOrCreate(engine, primitive, material);

    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error('Failed to create VAO');
    }

    /**
     * @NOTE TO FUTURE:
     * When low-level APIs land and the ability to edit mesh geometry is possible,
     * we needn't rebuild or edit the VAO. Because it binds a shader attribute (e.g. vertexPosition)
     * to a buffer in memory, editing the buffer still maintains that binding.
     * So we can call gl.bufferData (or possibly more attractive: gl.bufferSubData) on
     * a buffer to edit it in-place and everything should work fine.
     * Future implementation note: We can theoretically write an abstraction
     * around mesh geometry which internally stores (parsed geometry + buffers) and exposes
     * methods for mutating it (e.g. set position) OR creates the parsed geometry as observable.
     * Then when modifying (or reacting to an observed modification) the data, we can just pull
     * the relevant buffer and mutate it with `gl.bufferSubData()` to get realtime efficient
     * edits to this data.
     */

    gl.bindVertexArray(vao);

    /* Vertex positions */
    {
      const vertexPositionAttribute = shader.getAttribute('vertexPosition');
      if (vertexPositionAttribute === undefined) {
        throw new Error(`Could not find vertex attribute 'vertexPosition' in shader. Cannot render mesh primitive with no vertex position data.`);
      }
      gl.enableVertexAttribArray(vertexPositionAttribute);
      gl.bindBuffer(gl.ARRAY_BUFFER, primitive.positionGLBuffer);
      gl.vertexAttribPointer(
        vertexPositionAttribute,
        primitive.positionData.componentCount,
        primitive.positionData.componentType,
        primitive.positionData.normalized,
        primitive.positionData.componentCount * primitive.positionData.componentSize,
        0,
      );
    }

    /* Vertex normals */
    // @TODO generate normals somewhere
    const vertexNormalAttribute = shader.getAttribute('vertexNormal');
    if (vertexNormalAttribute) {
      if (primitive.normalData) {
        gl.enableVertexAttribArray(vertexNormalAttribute);
        gl.bindBuffer(gl.ARRAY_BUFFER, primitive.normalGLBuffer);
        gl.vertexAttribPointer(
          vertexNormalAttribute,
          primitive.normalData.componentCount,
          primitive.normalData.componentType,
          primitive.normalData.normalized,
          primitive.normalData.componentCount * primitive.normalData.componentSize,
          0,
        );
      } else {
        throw new Error(`Missing normals - we must generate them`);
      }
    }


    /* Vertex colors */
    const vertexColorAttribute = shader.getAttribute('vertexColor');
    if (vertexColorAttribute && primitive.color0Data) {
      gl.enableVertexAttribArray(vertexColorAttribute);
      gl.bindBuffer(gl.ARRAY_BUFFER, primitive.color0GLBuffer);
      gl.vertexAttribPointer(
        vertexColorAttribute,
        primitive.color0Data.componentCount,
        primitive.color0Data.componentType,
        primitive.color0Data.normalized,
        primitive.color0Data.componentCount * primitive.color0Data.componentSize,
        0,
      );
    }
    const texCoordIndex = primitive.material?.diffuseTexture?.texCoord;
    const textureCoordAttribute = shader.getAttribute('textureCoord');
    if (textureCoordAttribute && texCoordIndex !== undefined) {
      const textureCoordAttributeData = primitive[`texCoord${texCoordIndex}Data` as keyof MeshPrimitiveGeometry] as (AttributeDefinition | undefined);
      if (textureCoordAttributeData) {
        gl.enableVertexAttribArray(textureCoordAttribute);
        gl.bindBuffer(gl.ARRAY_BUFFER, primitive[`texCoord${texCoordIndex}GLBuffer` as keyof MeshPrimitiveGeometry] as WebGLBuffer);
        gl.vertexAttribPointer(
          textureCoordAttribute,
          textureCoordAttributeData.componentCount,
          textureCoordAttributeData.componentType,
          textureCoordAttributeData.normalized,
          textureCoordAttributeData.componentCount * textureCoordAttributeData.componentSize,
          0,
        );
      }
    }

    /* Joint indices */
    const vertexJointsAttribute = shader.getAttribute('vertexJoints');
    if (vertexJointsAttribute && primitive.joints0Data) {
      gl.enableVertexAttribArray(vertexJointsAttribute);
      gl.bindBuffer(gl.ARRAY_BUFFER, primitive.joints0GLBuffer);
      gl.vertexAttribPointer(
        vertexJointsAttribute,
        primitive.joints0Data.componentCount,
        primitive.joints0Data.componentType,
        primitive.joints0Data.normalized,
        primitive.joints0Data.componentCount * primitive.joints0Data.componentSize,
        0,
      );
    }
    /* Joint weights */
    const vertexWeightsAttribute = shader.getAttribute('vertexWeights');
    if (vertexWeightsAttribute && primitive.weights0Data) {
      gl.enableVertexAttribArray(vertexWeightsAttribute);
      gl.bindBuffer(gl.ARRAY_BUFFER, primitive.weights0GLBuffer);
      gl.vertexAttribPointer(
        vertexWeightsAttribute,
        primitive.weights0Data.componentCount,
        primitive.weights0Data.componentType,
        primitive.weights0Data.normalized,
        primitive.weights0Data.componentCount * primitive.weights0Data.componentSize,
        0,
      );
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    /* Indexed geometry */
    if (primitive.indices) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.indicesGLBuffer);
    }

    gl.bindVertexArray(null);

    const meshExtents: MeshPrimitiveExtents = {
      min: primitive.extents.min,
      max: primitive.extents.max,
      center: primitive.extents.min.add(primitive.extents.max).divideSelf(2),
    };

    let drawPrimitive: () => void;
    if (primitive.indices) {
      // Indexed geometry
      const mode = primitive.glMode;
      const elementCount = primitive.indices.buffer.length;
      const elementType = primitive.indices.componentType;
      drawPrimitive = () => {
        gl.drawElements(mode, elementCount, elementType, 0);
      };
    } else {
      const count = primitive.positionData.buffer.length / primitive.positionData.componentCount;
      drawPrimitive = () => {
        gl.drawArrays(primitive.glMode, 0, count);
      };
    }

    return new MeshPrimitive(
      shader,
      meshExtents,
      vao,
      drawPrimitive,
    );
  }
}

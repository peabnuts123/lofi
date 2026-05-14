import { Vector3 } from "@lofi/core/math/vector";
import type { Matrix4 } from "@lofi/core/math/Matrix4";
import { IdPool } from "@lofi/core/util/IdPool";
import { createBuffer } from "@lofi/engine/util/createBuffer";
import type { DrawTask, IEngine, OpaqueDrawTask, TransparentDrawTask } from "@lofi/engine/Engine";
import { ShaderCache, ShaderVariant, MaterialInstance } from "@lofi/engine/materials";
import type { AttributeDefinition, MeshPrimitiveDefinition } from "@lofi/engine/loaders/definitions";

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
  private readonly vao: WebGLVertexArrayObject;
  private readonly shader: ShaderVariant;
  private readonly extents: MeshPrimitiveExtents;
  private readonly drawPrimitive: () => void;

  private readonly _cameraSpacePositionTmp: Vector3 = Vector3.zero();

  private constructor(
    vao: WebGLVertexArrayObject,
    shader: ShaderVariant,
    extents: MeshPrimitiveExtents,
    drawPrimitive: () => void,
  ) {
    this.id = MeshPrimitive.IdPool.createNew();
    this.vao = vao;
    this.shader = shader;
    this.extents = extents;
    this.drawPrimitive = drawPrimitive;
  }

  public draw(
    engine: IEngine,
    drawQueue: DrawTask[],
    renderLayer: number,
    modelViewMatrix: Matrix4,
    worldMatrix: Matrix4,
    jointMatrices: Matrix4[] | undefined,
    material: MaterialInstance,
  ): void {
    // Joint matrices
    let jointMatricesBytes: Float32Array | undefined = undefined;
    if (jointMatrices) {
      jointMatricesBytes = new Float32Array(engine.config.models.maxBones * 16); // @TODO Don't allocate every frame
      if (jointMatrices.length > engine.config.models.maxBones) {
        console.warn(`Model skin has more than the max number of bones (${engine.config.models.maxBones})! Skin will not work correctly`);
      }
      jointMatrices.forEach((jointMatrix, index) => {
        if (index < engine.config.models.maxBones) {
          jointMatricesBytes!.set(jointMatrix.toArray(), index * 16);
        }
      });
    }

    const materialBlendingMode = material.blendingMode.type;
    const isMaterialTransparent = materialBlendingMode === 'Additive' ||
      materialBlendingMode === 'AlphaBlend' ||
      materialBlendingMode === 'Average' ||
      materialBlendingMode === 'Subtractive';

    const drawTaskUniforms: DrawTask['uniforms'] = {
      worldMatrix: worldMatrix,
      skinWeights: jointMatricesBytes,
    };
    const drawTaskDrawFn: DrawTask['draw'] = {
      id: this.id,
      init: ({ gl }) => {
        gl.bindVertexArray(this.vao);
      },
      exec: this.drawPrimitive,
    };

    if (isMaterialTransparent) {
      // Transform local-space extents to world camera space
      // for depth sorting
      this._cameraSpacePositionTmp
        .setValue(this.extents.center)
        .multiplySelf(modelViewMatrix);

      drawQueue.push({
        renderLayer,
        isTransparent: true,
        depth: this._cameraSpacePositionTmp.z,
        shaderVariant: this.shader,
        material,
        uniforms: drawTaskUniforms,
        draw: drawTaskDrawFn,
      } satisfies TransparentDrawTask);
    } else {
      drawQueue.push({
        renderLayer,
        isTransparent: false,
        shaderVariant: this.shader,
        material,
        uniforms: drawTaskUniforms,
        draw: drawTaskDrawFn,
      } satisfies OpaqueDrawTask);
    }
  }

  public static fromDefinition(
    engine: IEngine,
    primitive: MeshPrimitiveDefinition,
    material: MaterialInstance,
  ): MeshPrimitive {
    const { gl } = engine;

    const shader = ShaderCache.getOrCreate(engine, primitive, material);

    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error('Failed to create VAO');
    }

    gl.bindVertexArray(vao);

    /* Vertex positions */
    // @TODO can probably make a function that calls all of this for a given Attribute + AttributeDefinition
    {
      const vertexPositionAttribute = shader.getAttribute('vertexPosition');
      if (vertexPositionAttribute === undefined) {
        throw new Error(`Could not find vertex attribute 'vertexPosition' in shader. Cannot render mesh primitive with no vertex position data.`);
      }
      gl.enableVertexAttribArray(vertexPositionAttribute);
      const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, primitive.positionData.buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
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
        const normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, primitive.normalData.buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
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
      const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, primitive.color0Data.buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
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
      const textureCoordAttributeData = primitive[`texCoord${texCoordIndex}Data` as keyof MeshPrimitiveDefinition] as (AttributeDefinition | undefined);
      if (textureCoordAttributeData) {
        gl.enableVertexAttribArray(textureCoordAttribute);
        const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, textureCoordAttributeData.buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
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
      const jointsBuffer = createBuffer(gl, gl.ARRAY_BUFFER, primitive.joints0Data.buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, jointsBuffer);
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
      const weightsBuffer = createBuffer(gl, gl.ARRAY_BUFFER, primitive.weights0Data.buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, weightsBuffer);
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
      const indicesBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, primitive.indices.buffer);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);
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
      const mode = primitive.mode;
      const elementCount = primitive.indices.buffer.length;
      const elementType = primitive.indices.componentType;
      drawPrimitive = () => {
        gl.drawElements(mode, elementCount, elementType, 0);
      };
    } else {
      const count = primitive.positionData.buffer.length / primitive.positionData.componentCount;
      drawPrimitive = () => {
        gl.drawArrays(primitive.mode, 0, count);
      };
    }

    return new MeshPrimitive(
      vao,
      shader,
      meshExtents,
      drawPrimitive,
    );
  }
}

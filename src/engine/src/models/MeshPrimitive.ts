import { Vector3 } from "@lofi/core/math/vector";
import type { Matrix4 } from "@lofi/core/math/Matrix4";
import { IdPool } from "@lofi/core/util/IdPool";
import { type DrawTask, type IEngine, type OpaqueDrawTask, type TransparentDrawTask } from "@lofi/engine/Engine";
import { ShaderCache, ShaderVariant, MaterialInstance } from "@lofi/engine/materials";
import { BufferType } from "@lofi/engine/util/createBuffer";
import type { MeshPrimitiveGeometry, VertexTextureCoordinateAttribute } from "./geometry";

export interface MeshPrimitiveExtents {
  min: Vector3;
  max: Vector3;
  center: Vector3;
}

/**
 * A sub-piece of a mesh that is all drawn with one material.
 */
// @TODO I think we need to use a finalizer to clean these up
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
      // Transform local-space extents to world camera space for depth sorting
      this._cameraSpacePositionTmp.setValue(this.extents.center);
      modelViewMatrix.transformPointInPlace(this._cameraSpacePositionTmp);

      drawQueue.push({
        renderLayer,
        isTransparent: isMaterialTransparent,
        depth: this._cameraSpacePositionTmp.y,
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

    gl.bindVertexArray(vao);

    /* Vertex positions */
    {
      const vertexPositionAttribute = shader.getAttribute('vertexPosition');
      if (vertexPositionAttribute === undefined) {
        throw new Error(`Could not find vertex attribute 'vertexPosition' in shader. Cannot render mesh primitive with no vertex position data.`);
      }
      gl.enableVertexAttribArray(vertexPositionAttribute);
      gl.bindBuffer(BufferType.ARRAY_BUFFER, primitive.positionAttribute.glBuffer);
      gl.vertexAttribPointer(
        vertexPositionAttribute,
        primitive.positionAttribute.componentCount,
        primitive.positionAttribute.componentType,
        primitive.positionAttribute.normalized,
        primitive.positionAttribute.componentCount * primitive.positionAttribute.componentSize,
        0,
      );
    }

    /* Vertex normals */
    const vertexNormalAttribute = shader.getAttribute('vertexNormal');
    if (vertexNormalAttribute !== undefined) {
      if (primitive.normalAttribute) {
        gl.enableVertexAttribArray(vertexNormalAttribute);
        gl.bindBuffer(BufferType.ARRAY_BUFFER, primitive.normalAttribute.glBuffer);
        gl.vertexAttribPointer(
          vertexNormalAttribute,
          primitive.normalAttribute.componentCount,
          primitive.normalAttribute.componentType,
          primitive.normalAttribute.normalized,
          primitive.normalAttribute.componentCount * primitive.normalAttribute.componentSize,
          0,
        );
      }
    }


    /* Vertex colors */
    const vertexColorAttribute = shader.getAttribute('vertexColor');
    if (vertexColorAttribute !== undefined && primitive.colorAttribute) {
      gl.enableVertexAttribArray(vertexColorAttribute);
      gl.bindBuffer(BufferType.ARRAY_BUFFER, primitive.colorAttribute.glBuffer);
      gl.vertexAttribPointer(
        vertexColorAttribute,
        primitive.colorAttribute.componentCount,
        primitive.colorAttribute.componentType,
        primitive.colorAttribute.normalized,
        primitive.colorAttribute.componentCount * primitive.colorAttribute.componentSize,
        0,
      );
    }
    const texCoordIndex = primitive.defaultMaterialDefinition?.diffuseTexture?.texCoord;
    const textureCoordAttribute = shader.getAttribute('textureCoord');
    if (textureCoordAttribute !== undefined && texCoordIndex !== undefined) {
      const textureCoordAttributeData = primitive[`texCoord${texCoordIndex}Attribute` as keyof MeshPrimitiveGeometry] as (VertexTextureCoordinateAttribute | undefined);
      if (textureCoordAttributeData) {
        gl.enableVertexAttribArray(textureCoordAttribute);
        gl.bindBuffer(BufferType.ARRAY_BUFFER, textureCoordAttributeData.glBuffer);
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
    if (vertexJointsAttribute !== undefined && primitive.jointIndicesAttribute) {
      gl.enableVertexAttribArray(vertexJointsAttribute);
      gl.bindBuffer(BufferType.ARRAY_BUFFER, primitive.jointIndicesAttribute.glBuffer);
      gl.vertexAttribPointer(
        vertexJointsAttribute,
        primitive.jointIndicesAttribute.componentCount,
        primitive.jointIndicesAttribute.componentType,
        primitive.jointIndicesAttribute.normalized,
        primitive.jointIndicesAttribute.componentCount * primitive.jointIndicesAttribute.componentSize,
        0,
      );
    }
    /* Joint weights */
    const vertexWeightsAttribute = shader.getAttribute('vertexWeights');
    if (vertexWeightsAttribute !== undefined && primitive.jointWeightsAttribute) {
      gl.enableVertexAttribArray(vertexWeightsAttribute);
      gl.bindBuffer(BufferType.ARRAY_BUFFER, primitive.jointWeightsAttribute.glBuffer);
      gl.vertexAttribPointer(
        vertexWeightsAttribute,
        primitive.jointWeightsAttribute.componentCount,
        primitive.jointWeightsAttribute.componentType,
        primitive.jointWeightsAttribute.normalized,
        primitive.jointWeightsAttribute.componentCount * primitive.jointWeightsAttribute.componentSize,
        0,
      );
    }

    gl.bindBuffer(BufferType.ARRAY_BUFFER, null);

    /* Indexed geometry */
    if (primitive.indicesAttribute) {
      gl.bindBuffer(BufferType.ELEMENT_ARRAY_BUFFER, primitive.indicesAttribute.glBuffer);
    }

    gl.bindVertexArray(null);

    /* Extents */
    const extentsMin = primitive.extents.getMin();
    const extentsMax = primitive.extents.getMax();
    const meshExtents: MeshPrimitiveExtents = {
      min: extentsMin,
      max: extentsMax,
      center: extentsMin.add(extentsMax).scaleSelf(0.5),
    };

    // @NOTE Since `primitive.indicesAttribute` is not-nullable
    // all geometry is indexed geometry.
    const mode = primitive.glMode;
    const elementCount = primitive.triangleIndices.length * 3;
    const elementType = primitive.indicesAttribute.componentType;
    const drawPrimitive = (): void => {
      gl.drawElements(mode, elementCount, elementType, 0);
    };

    return new MeshPrimitive(
      shader,
      meshExtents,
      vao,
      drawPrimitive,
    );
  }
}

import { mat3, mat4 } from "gl-matrix";

import { Material, type MaterialDefinition } from "@polyzone/engine/materials/Material";
import type { Color3Definition } from "@polyzone/engine/util/Color3";
import { Vector3, type Vector3Definition } from "@polyzone/engine/util/vector";
import { createBuffer } from "@polyzone/engine/util/createBuffer";
import type { Engine } from "@polyzone/engine/Engine";
import { ShaderBlendingMode } from "@polyzone/engine/materials";

export interface TextureCoordinate {
  u: number;
  v: number;
}

export interface SubMeshDefinition {
  geometry: GeometryDefinition;
  material: MaterialDefinition;
}

export interface GeometryDefinition {
  vertexPositions: Vector3Definition[];
  vertexColors?: Color3Definition[];
  vertexNormals?: Vector3Definition[];
  textureCoordinates?: TextureCoordinate[];
  triangles: number[][];
}

export class SubMesh {
  private vao: WebGLVertexArrayObject;
  private definition: GeometryDefinition;
  public material: Material;
  public readonly extents: {
    min: Vector3;
    center: Vector3;
    max: Vector3;
  };

  private _normalTmp = mat3.create();

  public constructor(engine: Engine, geometry: GeometryDefinition, material: Material) {
    const { gl } = engine;

    const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(geometry.vertexPositions.flatMap(v => [v.x, v.y, v.z])));
    const faceIndexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.triangles.flat()));
    const vertexColorData = geometry.vertexColors ?? geometry.vertexPositions.map(() => ({ r: 0xFF, g: 0xFF, b: 0xFF } satisfies Color3Definition));
    const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Uint8Array(vertexColorData.flatMap(c => [c.r, c.g, c.b, 0xFF])));
    // @TODO If lacking normals, generate some sensible default
    const vertexNormalData = geometry.vertexNormals ?? geometry.vertexPositions.map(() => ({ x: 0, y: 0, z: 0 } satisfies Vector3Definition));
    const normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(vertexNormalData.flatMap((n) => [n.x, n.y, n.z])));
    const vertexTextureCoordinateData = geometry.textureCoordinates ?? geometry.vertexPositions.map(() => ({ u: 0, v: 0 } as TextureCoordinate));
    const textureCoordinateBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(vertexTextureCoordinateData.flatMap((t) => [t.u, t.v])));

    this.vao = gl.createVertexArray();
    if (!this.vao) {
      throw new Error('Failed to create VAO');
    }

    gl.bindVertexArray(this.vao);

    gl.enableVertexAttribArray(material.shader.vertexPositionAttribute);
    gl.enableVertexAttribArray(material.shader.vertexColorAttribute);
    gl.enableVertexAttribArray(material.shader.vertexNormalAttribute);
    gl.enableVertexAttribArray(material.shader.vertexTextureCoordinateAttribute);

    // Vertex positions
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(
      material.shader.vertexPositionAttribute,
      3,
      gl.FLOAT,
      false,
      3 * Float32Array.BYTES_PER_ELEMENT,
      0,
    );

    // Vertex colors
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(
      material.shader.vertexColorAttribute,
      4,
      gl.UNSIGNED_BYTE,
      true,
      4 * Uint8Array.BYTES_PER_ELEMENT,
      0,
    );

    // Vertex normals
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(
      material.shader.vertexNormalAttribute,
      3,
      gl.FLOAT,
      false,
      3 * Float32Array.BYTES_PER_ELEMENT,
      0,
    );

    // Vertex texture coordinates
    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordinateBuffer);
    gl.vertexAttribPointer(
      material.shader.vertexTextureCoordinateAttribute,
      2,
      gl.FLOAT,
      false,
      2 * Float32Array.BYTES_PER_ELEMENT,
      0,
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // Face indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, faceIndexBuffer);
    gl.bindVertexArray(null);

    this.definition = geometry;
    this.material = material;

    // Calculate submesh extents
    if (geometry.vertexPositions.length === 0) {
      this.extents = {
        min: Vector3.zero(),
        max: Vector3.zero(),
        center: Vector3.zero(),
      };
    } else {
      const vertexExtentsMin = new Vector3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
      const vertexExtentsMax = new Vector3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
      for (const vertex of geometry.vertexPositions) {
        if (vertex.x < vertexExtentsMin.x) vertexExtentsMin.x = vertex.x;
        if (vertex.x > vertexExtentsMax.x) vertexExtentsMax.x = vertex.x;

        if (vertex.y < vertexExtentsMin.y) vertexExtentsMin.y = vertex.y;
        if (vertex.y > vertexExtentsMax.y) vertexExtentsMax.y = vertex.y;

        if (vertex.z < vertexExtentsMin.z) vertexExtentsMin.z = vertex.z;
        if (vertex.z > vertexExtentsMax.z) vertexExtentsMax.z = vertex.z;
      }

      this.extents = {
        min: vertexExtentsMin,
        max: vertexExtentsMax,
        center: new Vector3(
          (vertexExtentsMin.x + vertexExtentsMax.x) / 2,
          (vertexExtentsMin.y + vertexExtentsMax.y) / 2,
          (vertexExtentsMin.z + vertexExtentsMax.z) / 2,
        ),
      };
    }
  }

  public static async fromDefinition(engine: Engine, definition: SubMeshDefinition): Promise<SubMesh> {
    const material = await Material.fromDefinition(engine, definition.material);
    return new SubMesh(engine, definition.geometry, material);
  }

  public draw(
    engine: Engine,
    worldMatrix: mat4,
  ): void {
    const { gl } = engine;

    gl.useProgram(this.material.shader.program);
    // World matrix
    gl.uniformMatrix4fv(this.material.shader.worldMatrixUniform, false, worldMatrix);

    // Material
    gl.uniform4fv(this.material.shader.diffuseColorUniform, new Float32Array([
      this.material.diffuseColor.r / 255,
      this.material.diffuseColor.g / 255,
      this.material.diffuseColor.b / 255,
      this.material.diffuseColor.a / 255,
    ]));

    switch (this.material.shader.blendingMode) {
      case ShaderBlendingMode.None:
        // No blending. No-op.
        break;
      case ShaderBlendingMode.Average:
        // Average blending:
        //   Transparent pixel (alpha = 0.5):   0.5 * src + 0.5 * dest
        //   Opaque pixel (alpha = 1):          1 * src + 0 * dest
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        break;
      case ShaderBlendingMode.Additive:
        // Additive blending:
        //   Transparent pixel (alpha = 0):     1 * src + 1 * dest
        //   Opaque pixel (alpha = 1):          1 * src + 0 * dest
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        break;
      case ShaderBlendingMode.Subtractive:
        // Subtractive blending:
        //   Transparent pixel (alpha = 0):     1 * src - 1 * dest
        //   Opaque pixel (alpha = 1):          1 * src - 0 * dest
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        break;
      case ShaderBlendingMode.SourceAlpha:
        // "Source alpha" blending:
        //   Transparent pixel (alpha = X):     X * src + (1-X) * dest
        //   Opaque pixel (alpha = 1):          1 * src + 0 * dest
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        break;
    }

    // Texture
    if (this.material.diffuseTexture) {
      const textureIndex = 0;
      gl.activeTexture(gl.TEXTURE0 + textureIndex);
      gl.bindTexture(gl.TEXTURE_2D, this.material.diffuseTexture.texture);
      gl.uniform1i(this.material.shader.textureSamplerUniform!, textureIndex);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // Lighting
    mat3.normalFromMat4(this._normalTmp, worldMatrix);
    gl.uniformMatrix3fv(this.material.shader.normalMatrixUniform, false, this._normalTmp);

    // Draw
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.definition.triangles.length * 3, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);

    gl.disable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.depthMask(true);
  }
}

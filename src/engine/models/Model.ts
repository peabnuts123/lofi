import type { IEngine } from "@polyzone/engine/Engine";
import type { DrawTask } from "@polyzone/engine/scene";
import { Vector3 } from "@polyzone/engine/util/vector";
import type { Matrix4 } from "@polyzone/engine/util/Matrix4";
import type { Color4 } from "@polyzone/engine/util/Color4";
import { Lazy } from "@polyzone/engine/util/Lazy";

import { SubMesh, type SubMeshDefinition } from "./SubMesh";
import type { Edge, EdgeIndices, TextureCoordinate, Triangle, TriangleIndices } from "./MeshGeometry";

export interface ModelDefinition {
  subMeshes: SubMeshDefinition[];
}

export class Model {
  public readonly subMeshes: SubMesh[];
  private readonly _cameraSpacePositionTmp: Vector3 = Vector3.zero();

  private constructor(subMeshes: SubMesh[]) {
    this.subMeshes = subMeshes;
  }

  public getDrawTasks(engine: IEngine, viewModelMatrix: Matrix4, worldMatrix: Matrix4): DrawTask[] {
    const drawTasks: DrawTask[] = [];
    for (let i = 0; i < this.subMeshes.length; i++) {
      const subMesh = this.subMeshes[i];

      if (!subMesh.material.isTransparent) {
        drawTasks.push({
          draw: () => subMesh.draw(engine, worldMatrix),
          layer: 0,
        });
      } else {
        // Material is transparent, sort, and draw in second render pass
        this._cameraSpacePositionTmp
          .setValue(subMesh.extents.center)
          .multiplySelf(viewModelMatrix);

        drawTasks.push({
          draw: () => subMesh.draw(engine, worldMatrix),
          layer: 5,
          order: this._cameraSpacePositionTmp.z,
        });
      }
    }

    return drawTasks;
  }

  public static async fromDefinition(engine: IEngine, definition: ModelDefinition): Promise<Model> {
    const subMeshes = await Promise.all(definition.subMeshes.map((subMeshDefinition) =>
      SubMesh.fromDefinition(engine, subMeshDefinition),
    ));
    return new Model(subMeshes);
  }

  /* @NOTE These properties cached since editing geometry is currently not possible */
  public get allVertexPositions(): Vector3[] { return this._allVertexPositions.value; }
  private _allVertexPositions = new Lazy(() => {
    return this.subMeshes.flatMap((subMesh) => subMesh.geometry.vertexPositions);
  });
  public get allVertexNormals(): Vector3[] { return this._allVertexNormals.value; }
  public _allVertexNormals = new Lazy(() => {
    return this.subMeshes.flatMap((subMesh) => subMesh.geometry.vertexNormals);
  });
  public get allTriangles(): Triangle[] { return this._allTriangles.value; }
  public _allTriangles = new Lazy(() => {
    return this.subMeshes.flatMap((subMesh) => subMesh.geometry.triangles);
  });
  public get allTriangleIndices(): TriangleIndices[] { return this._allTriangleIndices.value; }
  public _allTriangleIndices = new Lazy(() => {
    let totalVertices = 0;
    return this.subMeshes.flatMap((subMesh) => {
      const result = subMesh.geometry.triangleIndices.map((triangleIndices) => [
        triangleIndices[0] + totalVertices,
        triangleIndices[1] + totalVertices,
        triangleIndices[2] + totalVertices,
      ] satisfies TriangleIndices);

      totalVertices += subMesh.geometry.vertexPositions.length;

      return result;
    });
  });
  public get allTriangleNormals(): Vector3[] { return this._allTriangleNormals.value; }
  public _allTriangleNormals = new Lazy(() => {
    return this.subMeshes.flatMap((subMesh) => subMesh.geometry.triangleNormals);
  });
  public get allEdges(): Edge[] { return this._allEdges.value; }
  public _allEdges = new Lazy(() => {
    return this.subMeshes.flatMap((subMesh) => subMesh.geometry.edges);
  });
  public get allEdgeIndices(): EdgeIndices[] { return this._allEdgeIndices.value; }
  public _allEdgeIndices = new Lazy(() => {
    let totalVertices = 0;
    return this.subMeshes.flatMap((subMesh) => {
      const result = subMesh.geometry.edgeIndices.map((edgeIndices) => [
        edgeIndices[0] + totalVertices,
        edgeIndices[1] + totalVertices,
      ] satisfies EdgeIndices);

      totalVertices += subMesh.geometry.vertexPositions.length;

      return result;
    });
  });
  public get allVertexColors(): Color4[] { return this._allVertexColors.value; }
  public _allVertexColors = new Lazy(() => {
    return this.subMeshes.flatMap((subMesh) => subMesh.geometry.vertexColors || []);
  });
  public get allTextureCoordinates(): TextureCoordinate[] { return this._allTextureCoordinates.value; }
  public _allTextureCoordinates = new Lazy(() => {
    return this.subMeshes.flatMap((subMesh) => subMesh.geometry.textureCoordinates || []);
  });
}

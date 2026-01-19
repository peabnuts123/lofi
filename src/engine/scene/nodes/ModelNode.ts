import { DrawableSceneNode, type IScene, type DrawTask } from "@polyzone/engine/scene";
import type { IEngine } from "@polyzone/engine/Engine";
import type { Model, Triangle } from "@polyzone/engine/models";
import { Matrix4 } from "@polyzone/engine/util/Matrix4";
import { AxisAlignedBoundingBox } from "@polyzone/engine/collision";
import { Vector3 } from "@polyzone/engine/util/vector";

export class ModelNode extends DrawableSceneNode {
  public model: Model;
  private _viewModelMatrixTmp: Matrix4 = new Matrix4();
  private _verticesWorldSpaceTmp: Vector3[];

  public constructor(scene: IScene, name: string, model: Model) {
    super(scene, name);
    this.model = model;
    this._verticesWorldSpaceTmp = model.allVertexPositions.map(() => Vector3.zero());
  }

  public getDrawTasks(engine: IEngine): DrawTask[] {
    const viewMatrix = engine.activeScene?.activeCamera?.viewMatrix;
    if (viewMatrix === undefined) {
      // No scene or no camera = no draw tasks
      return [];
    }
    this._viewModelMatrixTmp
      .setValue(viewMatrix)
      .multiplySelf(this.worldMatrix);
    return this.model.getDrawTasks(engine, this._viewModelMatrixTmp, this.worldMatrix);
  }

  public getAABB(): AxisAlignedBoundingBox {
    const verticesWorldSpace = this.getVerticesWorldSpace();
    const min = new Vector3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    const max = new Vector3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);

    for (const vertex of verticesWorldSpace) {
      if (vertex.x < min.x) min.x = vertex.x;
      if (vertex.x > max.x) max.x = vertex.x;
      if (vertex.y < min.y) min.y = vertex.y;
      if (vertex.y > max.y) max.y = vertex.y;
      if (vertex.z < min.z) min.z = vertex.z;
      if (vertex.z > max.z) max.z = vertex.z;
    }

    return new AxisAlignedBoundingBox({
      xMin: min.x,
      xMax: max.x,
      yMin: min.y,
      yMax: max.y,
      zMin: min.z,
      zMax: max.z,
    });
  }

  public getWireframeFaces(): Vector3[][] {
    const vertices = this.getVerticesWorldSpace();
    return this.model.allTriangleIndices.map((triangle) => ([
      vertices[triangle[0]],
      vertices[triangle[1]],
      vertices[triangle[2]],
    ]) satisfies Triangle);
  }

  // @TODO If we could observe worldMatrixDirty we could cache this
  public getVerticesWorldSpace(offset: Vector3 = Vector3.zero()): Vector3[] {
    this.model.allVertexPositions.forEach((vertexPosition, i) => {
      this._verticesWorldSpaceTmp[i]
        .setValue(vertexPosition)
        .multiplySelf(this.worldMatrix)
        .addSelf(offset);
    });

    return this._verticesWorldSpaceTmp;
  }
}

import type { IEngine } from "@polyzone/engine/Engine";
import type { DrawTask } from "@polyzone/engine/scene";
import { Vector3 } from "@polyzone/engine/util/vector";
import type { Matrix4 } from "@polyzone/engine/util/Matrix4";

import { SubMesh, type SubMeshDefinition } from "./SubMesh";

export interface ModelDefinition {
  subMeshes: SubMeshDefinition[];
}

export class Model {
  private subMeshes: SubMesh[];
  private _cameraSpacePositionTmp: Vector3 = Vector3.zero();

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

  public debug_getSubmesh(index: number): SubMesh {
    if (index < 0 || index >= this.subMeshes.length) {
      throw new Error(`Submesh ${index} is out of bounds`);
    }
    return this.subMeshes[index];
  }
}

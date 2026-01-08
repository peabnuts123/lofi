import { mat4, vec3 } from "gl-matrix";
import type { IEngine } from "@polyzone/engine/Engine";
import type { DrawTask } from "@polyzone/engine/scene";

import { SubMesh, type SubMeshDefinition } from "./SubMesh";

export interface ModelDefinition {
  subMeshes: SubMeshDefinition[];
}

export class Model {
  private subMeshes: SubMesh[];
  private _submeshCenterPositionTmp: vec3 = vec3.create();
  private _cameraSpacePositionTmp: vec3 = vec3.create();

  private constructor(subMeshes: SubMesh[]) {
    this.subMeshes = subMeshes;
  }

  public getDrawTasks(engine: IEngine, viewModelMatrix: mat4, worldMatrix: mat4, debug_name: string): DrawTask[] {
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
        vec3.set(this._submeshCenterPositionTmp, subMesh.extents.center.x, subMesh.extents.center.y, subMesh.extents.center.z);
        vec3.transformMat4(this._cameraSpacePositionTmp, this._submeshCenterPositionTmp, viewModelMatrix);

        drawTasks.push({
          draw: () => subMesh.draw(engine, worldMatrix),
          layer: 5,
          order: this._cameraSpacePositionTmp[2],
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
}

import { mat4 } from "gl-matrix";

import { DrawableSceneNode, type IScene, type DrawTask } from "@polyzone/engine/scene";
import type { IEngine } from "@polyzone/engine/Engine";
import type { Model } from "@polyzone/engine/models";

export class ModelNode extends DrawableSceneNode {
  public model: Model;
  private _viewModelMatrixTmp: mat4 = mat4.create();

  public constructor(scene: IScene, name: string, model: Model) {
    super(scene, name);
    this.model = model;
  }

  public getDrawTasks(engine: IEngine): DrawTask[] {
    const viewMatrix = engine.activeScene?.activeCamera?.viewMatrix;
    if (viewMatrix === undefined) {
      // No scene or no camera = no draw tasks
      return [];
    }
    const viewModelMatrix = mat4.multiply(this._viewModelMatrixTmp, viewMatrix, this.worldMatrix);
    return this.model.getDrawTasks(engine, viewModelMatrix, this.worldMatrix);
  }
}

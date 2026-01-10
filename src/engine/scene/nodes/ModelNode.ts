import { DrawableSceneNode, type IScene, type DrawTask } from "@polyzone/engine/scene";
import type { IEngine } from "@polyzone/engine/Engine";
import type { Model } from "@polyzone/engine/models";
import { Matrix4 } from "@polyzone/engine/util/Matrix4";

export class ModelNode extends DrawableSceneNode {
  public model: Model;
  private _viewModelMatrixTmp: Matrix4 = new Matrix4();

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
    this._viewModelMatrixTmp
      .setValue(viewMatrix)
      .multiplySelf(this.worldMatrix);
    return this.model.getDrawTasks(engine, this._viewModelMatrixTmp, this.worldMatrix);
  }
}

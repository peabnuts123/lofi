import { DrawableSceneNode, Scene } from "@polyzone/engine/scene";
import type { Engine } from "@polyzone/engine/Engine";
import type { Model } from "@polyzone/engine/models";

export class ModelNode extends DrawableSceneNode {
  private model: Model;

  public constructor(scene: Scene, name: string, model: Model) {
    super(scene, name);
    this.model = model;
  }

  public draw(engine: Engine): void {
    this.model.draw(engine, this.worldMatrix);
  }
}

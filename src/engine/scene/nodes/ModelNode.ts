import { DrawableSceneNode } from "@polyzone/engine/scene";
import type { Engine } from "@polyzone/engine/Engine";
import type { Model } from "@polyzone/engine/models";

export class ModelNode extends DrawableSceneNode {
  private model: Model;

  public constructor(name: string, model: Model) {
    super(name);
    this.model = model;
  }

  public draw(engine: Engine): void {
    this.model.draw(engine, this.position, this.rotation, this.scale);
  }
}

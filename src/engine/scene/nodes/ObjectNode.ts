import { type IScene, SceneNode } from "@polyzone/engine/scene";

export class ObjectNode extends SceneNode {
  public constructor(scene: IScene, name: string) {
    super(scene, name);
  }
}

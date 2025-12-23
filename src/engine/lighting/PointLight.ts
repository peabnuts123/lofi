import type { Vector3 } from "@polyzone/engine/util/vector";
import type { Color3 } from "@polyzone/engine/util/color";
import { SceneNode, type ISceneNodeWithPosition } from "@polyzone/engine/scene";

export class PointLight extends SceneNode implements ISceneNodeWithPosition {
  public position: Vector3;
  public color: Color3;

  public constructor(name: string, position: Vector3, color: Color3) {
    super(name);
    this.position = position;
    this.color = color;
  }
}

import type { Color3 } from "@polyzone/engine/util/color";
import { SceneNode } from "@polyzone/engine/scene";

export class PointLightNode extends SceneNode {
  public color: Color3;

  public constructor(name: string, color: Color3) {
    super(name);
    this.color = color;
  }
}

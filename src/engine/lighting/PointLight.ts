import type { Vector3 } from "@polyzone/engine/util/vector";
import type { Color3 } from "@polyzone/engine/util/color";

export class PointLight {
  public position: Vector3;
  public color: Color3;

  public constructor(position: Vector3, color: Color3) {
    this.position = position;
    this.color = color;
  }
}

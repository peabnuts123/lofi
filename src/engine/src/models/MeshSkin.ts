import type { Matrix4 } from "@lofi/core/math/Matrix4";
import type { ModelPart } from "./ModelPart";

export class MeshSkin {
  public readonly skeleton: ModelPart[];
  public readonly inverseBindMatrices: Matrix4[];

  public constructor(skeleton: ModelPart[], inverseBindMatrices: Matrix4[]) {
    this.skeleton = skeleton;
    this.inverseBindMatrices = inverseBindMatrices;
  }
}

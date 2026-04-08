import type { Matrix4 } from "@lofi/core/math/Matrix4";
import type { MeshNode } from "./MeshNode";

export class MeshSkin {
  public readonly skeleton: MeshNode[];
  public readonly inverseBindMatrices: Matrix4[];

  public constructor(skeleton: MeshNode[], inverseBindMatrices: Matrix4[]) {
    this.skeleton = skeleton;
    this.inverseBindMatrices = inverseBindMatrices;
  }
}

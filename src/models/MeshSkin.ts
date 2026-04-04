import type { Matrix4 } from "@polyzone/engine/util/Matrix4";
import type { MeshNode } from "./MeshNode";

export class MeshSkin {
  public readonly skeleton: MeshNode[];
  public readonly inverseBindMatrices: Matrix4[];

  public constructor(skeleton: MeshNode[], inverseBindMatrices: Matrix4[]) {
    this.skeleton = skeleton;
    this.inverseBindMatrices = inverseBindMatrices;
  }
}

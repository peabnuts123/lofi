import type { Mesh } from "@polyzone/engine/models/SubMesh";
import type { Vector3 } from "@polyzone/engine/util/vector";

export class GameObject {
  private mesh: Mesh;

  public position: Vector3 = { x: 0, y: 0, z: 0 };
  public rotation: Vector3 = { x: 0, y: 0, z: 0 };
  public scale: Vector3 = { x: 1, y: 1, z: 1 };

  public constructor(mesh: Mesh) {
    this.mesh = mesh;
  }

  public draw(gl: WebGL2RenderingContext): void {
    this.mesh.draw(gl, this.position, this.rotation, this.scale);
  }
}

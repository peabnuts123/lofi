import { Vector3 } from "@polyzone/engine/util/vector";
import type { Ubo } from "@polyzone/engine/materials/Ubo";
import { Quaternion } from "@polyzone/engine/util/quaternion";
import { DegreesToRadians } from "@polyzone/engine/util/math";
import { Matrix4 } from "@polyzone/engine/util/Matrix4";
import { SceneNode } from "@polyzone/engine/scene/SceneNode";
import type { IScene } from "@polyzone/engine/scene/Scene";

export const CameraUboPropertyNames = ['viewProjectionMatrix'] as const;
export type CameraUboPropertyName = (typeof CameraUboPropertyNames)[number];
export type CameraUbo = Ubo<CameraUboPropertyName>;
export const CameraUboName = 'Camera';
export const CameraUboIndex = 1;

export class CameraNode extends SceneNode {
  public fov: number;
  public aspectRatio: number;
  public near: number = 0.1;
  public far: number = 100;

  public readonly viewProjectionMatrix = new Matrix4();
  public readonly viewMatrix = new Matrix4();
  public readonly projectionMatrix = new Matrix4();

  public constructor(scene: IScene, name: string, fov: number, aspectRatio: number) {
    super(scene, name);
    this.fov = fov;
    this.aspectRatio = aspectRatio;

    // Always switch to new camera
    scene.activeCamera = this;
  }

  public bindToUbo(gl: WebGL2RenderingContext, ubo: CameraUbo): void {
    ubo.setProperty(gl, 'viewProjectionMatrix', this.viewProjectionMatrix.toArray());
  }

  public override onUpdate(dt: number): void {
    super.onUpdate(dt);
    this.recalculateViewProjectionMatrix();
  }

  public pointAt(target: Vector3): void {
    const direction = this.absolutePosition.subtract(target).normalizeSelf();
    const right = direction.cross(Vector3.up());
    const up = right.cross(direction);
    this.absoluteRotation.set(Quaternion.fromLookDirection(direction, up));
  }

  private recalculateViewProjectionMatrix(): void {
    this.viewMatrix
      .setValue(this.worldMatrix)
      .invertSelf();

    // @TODO cache this matrix
    this.projectionMatrix.perspectiveSelf(
      this.fov * DegreesToRadians,
      this.aspectRatio,
      this.near,
      this.far,
    );

    this.viewProjectionMatrix
      .setValue(this.projectionMatrix)
      .multiplySelf(this.viewMatrix);
  }
}

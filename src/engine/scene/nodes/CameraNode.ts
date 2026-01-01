import { mat4 } from "gl-matrix";

import { Vector3 } from "@polyzone/engine/util/vector";
import { Scene, SceneNode } from "@polyzone/engine/scene";
import type { Ubo } from "@polyzone/engine/materials/Ubo";
import { Quaternion } from "@polyzone/engine/util/quaternion";
import { DegreesToRadians } from "@polyzone/engine/util/math";

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

  public readonly viewProjectionMatrix = mat4.create();
  public readonly viewMatrix = mat4.create();
  public readonly projectionMatrix = mat4.create();

  public constructor(scene: Scene, name: string, fov: number, aspectRatio: number) {
    super(scene, name);
    this.fov = fov;
    this.aspectRatio = aspectRatio;

    // Always switch to new camera
    scene.activeCamera = this;
  }

  public bindToUbo(gl: WebGL2RenderingContext, ubo: CameraUbo): void {
    ubo.setProperty(gl, 'viewProjectionMatrix', new Float32Array(this.viewProjectionMatrix));
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
    mat4.invert(
      this.viewMatrix,
      this.worldMatrix,
    );

    // @TODO cache this matrix
    mat4.perspective(
      this.projectionMatrix,
      this.fov * DegreesToRadians,
      this.aspectRatio,
      this.near,
      this.far,
    );

    mat4.multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);
  }
}

import { Vector3 } from "@lofi/core/math/vector";
import { DegreesToRadians } from "@lofi/core/math/util";
import { Matrix4 } from "@lofi/core/math/Matrix4";
import type { Ubo } from "@lofi/engine/materials/Ubo";
import { SceneNode } from "@lofi/engine/scene/SceneNode";
import type { IScene } from "@lofi/engine/scene/Scene";

export const CameraUboPropertyNames = [
  'viewProjectionMatrix',
  'cameraPosition',
] as const;
export type CameraUboPropertyName = (typeof CameraUboPropertyNames)[number];
export type CameraUbo = Ubo<CameraUboPropertyName>;
export const CameraUboName = 'Camera';
export const CameraUboIndex = 1;

/**
 * Transform to convert world "+Z up" coordinates into
 * native WebGL "+Y up" coordinates for rendering.
 */
export const ZUpViewMatrixTransform = new Matrix4([
  1, 0, 0, 0,
  0, 0, -1, 0,
  0, 1, 0, 0,
  0, 0, 0, 1,
]);

export class CameraNode extends SceneNode {
  public fov: number;
  public aspectRatio: number; // @TODO remove, derive from canvas
  public near: number = 0.1;
  public far: number = 100;

  public readonly viewProjectionMatrix = new Matrix4();
  public readonly viewMatrix = new Matrix4();
  public readonly projectionMatrix = new Matrix4();


  private uboCameraPositionData_tmp = new Float32Array(3);

  public constructor(scene: IScene, name: string, fov: number, aspectRatio: number, parent?: SceneNode) {
    super(scene, name, parent);
    this.fov = fov;
    this.aspectRatio = aspectRatio;

    // Always switch to new camera
    scene.activeCamera = this;
  }

  private tmp_bindToUbo_viewProjectionMatrixBuffer = new Float32Array(16);
  public bindToUbo(gl: WebGL2RenderingContext, ubo: CameraUbo): void {
    this.viewProjectionMatrix.writeTo(this.tmp_bindToUbo_viewProjectionMatrixBuffer);
    ubo.setProperty(gl, 'viewProjectionMatrix', this.tmp_bindToUbo_viewProjectionMatrixBuffer);

    const absolutePosition = this.absolutePosition;
    this.uboCameraPositionData_tmp[0] = absolutePosition.x;
    this.uboCameraPositionData_tmp[1] = absolutePosition.y;
    this.uboCameraPositionData_tmp[2] = absolutePosition.z;
    ubo.setProperty(gl, 'cameraPosition', this.uboCameraPositionData_tmp);
  }

  public override onUpdate(dt: number, time: number): void {
    super.onUpdate(dt, time);
    this.recalculateViewProjectionMatrix();
  }

  private tmp_pointAt = Vector3.zero();
  public pointAt(target: Vector3): void {
    this.tmp_pointAt
      .setValue(target)
      .subtractSelf(this.absolutePosition);
    this.absoluteRotation.q.fromLookDirectionSelf(this.tmp_pointAt);
  }

  private recalculateViewProjectionMatrix(): void {
    this.viewMatrix
      .setValue(this.worldMatrix)
      .invertSelf()
      .reverseMultiplySelf(ZUpViewMatrixTransform);

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

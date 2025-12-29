import { glMatrix, mat4, quat, vec3 } from "gl-matrix";

import { Vector3 } from "@polyzone/engine/util/vector";
import { Scene, SceneNode } from "@polyzone/engine/scene";
import type { Ubo } from "@polyzone/engine/materials/Ubo";
import { Flags } from "src/util/constants";
import { Quaternion } from "@polyzone/engine/util/quaternion";

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

  private readonly viewProjectionMatrix = mat4.create();
  private readonly _positionTmp = vec3.create();
  private readonly _rotationTmp = quat.create();
  private readonly _viewMatrixTmp = mat4.create();
  private readonly _projectionMatrixTmp = mat4.create();

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
    const direction = this.position.subtract(target).normalizeSelf();
    const right = direction.cross(Vector3.up());
    const up = right.cross(direction);
    this.rotation.set(Quaternion.fromLookDirection(direction, up));
  }

  private recalculateViewProjectionMatrix(): void {
    if (Flags.UseEulernion) {
      quat.set(
        this._rotationTmp,
        this.rotation.q.x,
        this.rotation.q.y,
        this.rotation.q.z,
        this.rotation.q.w,
      );
    } else {
      quat.fromEuler(
        this._rotationTmp,
        this.rotation.x,
        this.rotation.y,
        this.rotation.z,
      );
    }
    vec3.set(this._positionTmp, this.position.x, this.position.y, this.position.z);
    mat4.fromRotationTranslation(
      this._viewMatrixTmp,
      this._rotationTmp,
      this._positionTmp,
    );
    mat4.invert(this._viewMatrixTmp, this._viewMatrixTmp);

    mat4.perspective(
      this._projectionMatrixTmp,
      glMatrix.toRadian(this.fov),
      this.aspectRatio,
      this.near,
      this.far,
    );

    mat4.multiply(this.viewProjectionMatrix, this._projectionMatrixTmp, this._viewMatrixTmp);
  }
}

import { glMatrix, mat4, quat, vec3 } from "gl-matrix";

import type { Vector3 } from "@polyzone/engine/util/vector";
import type { Ubo } from "@polyzone/engine/materials/Ubo";

export const CameraUboPropertyNames = ['viewProjectionMatrix'] as const;
export type CameraUboPropertyName = (typeof CameraUboPropertyNames)[number];
export const CameraUboIndex = 1;

export class Camera {
  public fov: number;
  public aspectRatio: number;
  public position: Vector3 = { x: 0, y: 0, z: 0 };
  public rotation: Vector3 = { x: 0, y: 0, z: 0 };
  public near: number = 0.1;
  public far: number = 100;
  public readonly ubo: Ubo<CameraUboPropertyName>;

  public constructor(fov: number, aspectRatio: number, ubo: Ubo<CameraUboPropertyName>) {
    this.fov = fov;
    this.aspectRatio = aspectRatio;
    this.ubo = ubo;
  }

  public readonly viewProjectionMatrix = mat4.create();
  private readonly _positionTmp = vec3.create();
  private readonly _rotationTmp = quat.create();
  private readonly _viewMatrixTmp = mat4.create();
  private readonly _projectionMatrixTmp = mat4.create();

  public recalculateViewProjectionMatrix(gl: WebGL2RenderingContext): void {
    quat.fromEuler(
      this._rotationTmp,
      this.rotation.x,
      this.rotation.y,
      this.rotation.z,
    );
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
    this.ubo.setProperty(gl, 'viewProjectionMatrix', new Float32Array(this.viewProjectionMatrix));
  }

  public pointAt(target: Vector3): void {
    const dir = vec3.create();
    vec3.subtract(dir, vec3.fromValues(this.position.x, this.position.y, this.position.z), vec3.fromValues(target.x, target.y, target.z));
    vec3.normalize(dir, dir);

    const pitch = Math.atan2(-dir[1], Math.sqrt(dir[0] * dir[0] + dir[2] * dir[2]));
    const yaw = Math.atan2(dir[0], dir[2]);

    this.rotation.x = glMatrix.toDegree(pitch);
    this.rotation.y = glMatrix.toDegree(yaw);
  }
}

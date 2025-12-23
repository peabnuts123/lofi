import { glMatrix, mat4, quat, vec3 } from "gl-matrix";

import type { Vector3 } from "@polyzone/engine/util/vector";
import { SceneNode } from "@polyzone/engine/scene";
import type { Ubo } from "@polyzone/engine/materials/Ubo";

export const CameraUboPropertyNames = ['viewProjectionMatrix'] as const;
export type CameraUboPropertyName = (typeof CameraUboPropertyNames)[number];
export type CameraUbo = Ubo<CameraUboPropertyName>;
export const CameraUboName = 'Camera';
export const CameraUboIndex = 1;

export class CameraNode extends SceneNode  {
  public fov: number;
  public aspectRatio: number;
  public near: number = 0.1;
  public far: number = 100;

  private readonly viewProjectionMatrix = mat4.create();
  private readonly _positionTmp = vec3.create();
  private readonly _rotationTmp = quat.create();
  private readonly _viewMatrixTmp = mat4.create();
  private readonly _projectionMatrixTmp = mat4.create();

  public constructor(name: string, fov: number, aspectRatio: number) {
    super(name);
    this.fov = fov;
    this.aspectRatio = aspectRatio;
  }

  public bindToUbo(gl: WebGL2RenderingContext, ubo: CameraUbo): void {
    ubo.setProperty(gl, 'viewProjectionMatrix', new Float32Array(this.viewProjectionMatrix));
  }

  public override onUpdate(dt: number): void {
    super.onUpdate(dt);
    this.recalculateViewProjectionMatrix();
  }

  public pointAt(target: Vector3): void {
    // @TODO use Vector3 API
    const direction = vec3.create();
    vec3.subtract(direction, vec3.fromValues(this.position.x, this.position.y, this.position.z), vec3.fromValues(target.x, target.y, target.z));
    vec3.normalize(direction, direction);

    const pitch = Math.atan2(-direction[1], Math.sqrt(direction[0] * direction[0] + direction[2] * direction[2]));
    const yaw = Math.atan2(direction[0], direction[2]);

    this.rotation.x = glMatrix.toDegree(pitch);
    this.rotation.y = glMatrix.toDegree(yaw);
  }

  private recalculateViewProjectionMatrix(): void {
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
  }
}

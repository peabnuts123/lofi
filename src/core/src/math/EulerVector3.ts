import  { Observable } from "@lopoly/core/util/Observable";

import { Quaternion } from "./Quaternion";
import { RadiansToDegrees } from "./util";
import type { Vector2Like } from "./Vector2";
import type { AnyVectorLike, Vector3Like } from "./Vector3";

class EulerVector3InternalBuffer {
  public static readonly BufferSize: number = 3;
  public readonly buffer: Float64Array = new Float64Array(EulerVector3InternalBuffer.BufferSize);
  public get x(): number { return this.buffer[0]; }
  public set x(value: number) { this.buffer[0] = value % 360; }
  public get y(): number { return this.buffer[1]; }
  public set y(value: number) { this.buffer[1] = value % 360; }
  public get z(): number { return this.buffer[2]; }
  public set z(value: number) { this.buffer[2] = value % 360; }
}

/**
 * A vector specifically for expressing Euler rotation angles,
 * where all xyz components are always wrapped between -360 and 360.
 */
export class EulerVector3 extends Observable {
  protected internal: EulerVector3InternalBuffer;

  public constructor(
    x: number,
    y: number,
    z: number,
  ) {
    super();
    this.internal = new EulerVector3InternalBuffer();
    this.internal.x = x;
    this.internal.y = y;
    this.internal.z = z;
  }

  public setValue(x: number, y: number, z: number): this;
  public setValue(vector: Vector3Like): this;
  public setValue(quaternion: Quaternion): this;
  public setValue(vectorOrQuaternionOrX: Vector3Like | Quaternion | number, maybeY?: number, maybeZ?: number): this {
    let valueChanged: boolean;
    if (typeof vectorOrQuaternionOrX === 'number') {
      valueChanged = this.setValueXYZ(vectorOrQuaternionOrX, maybeY as number, maybeZ as number);
    } else if (vectorOrQuaternionOrX instanceof Quaternion) {
      valueChanged = this.setValueQuaternion(vectorOrQuaternionOrX);
    } else {
      valueChanged = this.setValueVector(vectorOrQuaternionOrX);
    }
    if (valueChanged) {
      this.notifyOnChange();
    }
    return this;
  }
  private setValueXYZ(x: number, y: number, z: number): boolean {
    if (this.internal.x === x && this.internal.y === y && this.internal.z === z) {
      // @NOTE Write is not changing the value
      return false;
    }
    this.internal.x = x;
    this.internal.y = y;
    this.internal.z = z;
    return true;
  }
  private setValueQuaternion(quat: Quaternion): boolean {
    // From: https://github.com/BabylonJS/Babylon.js/blob/86bda66b6f61e482374c1a0597f1f504cd75837d/packages/dev/core/src/Maths/math.vector.ts#L5217
    const { x, y, z, w } = quat;

    // Early check for identity to produce nice Vector3 without -0
    if (
      x === 0 &&
      y === 0 &&
      z === 0 &&
      w === 1
    ) {
      this.internal.x = 0;
      this.internal.y = 0;
      this.internal.z = 0;
    }

    /*
      @NOTE Rotation order is ZXY where:
      Z = Yaw, X = Pitch, Y = Roll

      Equations derived from:
      https://www.euclideanspace.com/maths/geometry/rotations/conversions/quaternionToEuler/index.htm
      with reference to (angle formulas):
      https://en.wikipedia.org/wiki/Euler_angles#Rotation_matrix
     */

    const test = y * z + x * w;
    const limit = 0.4999999;

    let resultX: number, resultY: number, resultZ: number;

    if (test > limit) {
      resultX = Math.PI / 2;
      resultY = 0;
      resultZ = 2 * Math.atan2(z, w);
    } else if (test < -limit) {
      resultX = -Math.PI / 2;
      resultY = 0;
      resultZ = -2 * Math.atan2(z, w);
    } else {
      const xSquared = x * x;
      const ySquared = y * y;
      const zSquared = z * z;
      resultX = Math.asin(2 * test);
      resultZ = Math.atan2(2 * (z * w - x * y), 1 - 2 * (xSquared + zSquared));
      resultY = Math.atan2(2 * (y * w - x * z), 1 - 2 * (xSquared + ySquared));
    }

    // Convert to degrees
    resultX *= RadiansToDegrees;
    resultY *= RadiansToDegrees;
    resultZ *= RadiansToDegrees;

    if (this.internal.x === resultX && this.internal.y === resultY && this.internal.z === resultZ) {
      // @NOTE Write is not changing the value
      return false;
    }
    this.internal.x = resultX;
    this.internal.y = resultY;
    this.internal.z = resultZ;
    return true;
  }
  private setValueVector(value: Vector3Like): boolean {
    if (this.internal.x === value.x && this.internal.y === value.y && this.internal.z === value.z) {
      // @NOTE Write is not changing the value
      return false;
    }
    this.internal.x = value.x;
    this.internal.y = value.y;
    this.internal.z = value.z;
    return true;
  }

  public addSelf(value: AnyVectorLike): this {
    if ('z' in value) {
      this.addSelfVector3(value);
    } else {
      this.addSelfVector2(value);
    }
    this.notifyOnChange();
    return this;
  }
  private addSelfVector2(value: Vector2Like): void {
    this.internal.x += value.x;
    this.internal.y += value.y;
  }
  private addSelfVector3(value: Vector3Like): void {
    this.internal.x += value.x;
    this.internal.y += value.y;
    this.internal.z += value.z;
  }
  public add(value: AnyVectorLike): EulerVector3 {
    return this.clone().addSelf(value);
  }

  public subtractSelf(value: AnyVectorLike): this {
    if ('z' in value) {
      this.subtractSelfVector3(value);
    } else {
      this.subtractSelfVector2(value);
    }
    this.notifyOnChange();
    return this;
  }
  private subtractSelfVector2(value: Vector2Like): void {
    this.internal.x -= value.x;
    this.internal.y -= value.y;
  }
  private subtractSelfVector3(value: Vector3Like): void {
    this.internal.x -= value.x;
    this.internal.y -= value.y;
    this.internal.z -= value.z;
  }
  public subtract(value: AnyVectorLike): EulerVector3 {
    return this.clone().subtractSelf(value);
  }

  public clone(): EulerVector3 {
    return new EulerVector3(this.x, this.y, this.z);
  }

  public setX(value: number): this {
    this.x = value;
    return this;
  }
  public withX(value: number): EulerVector3 {
    return this.clone().setX(value);
  }

  public setY(value: number): this {
    this.y = value;
    return this;
  }
  public withY(value: number): EulerVector3 {
    return this.clone().setY(value);
  }

  public setZ(value: number): this {
    this.z = value;
    return this;
  }
  public withZ(value: number): EulerVector3 {
    return this.clone().setZ(value);
  }

  public toString(): string {
    return `${EulerVector3.name}(${this.x}, ${this.y}, ${this.z})`;
  }
  public get x(): number { return this.internal.x; }
  public set x(value: number) {
    if (this.internal.x !== value) {
      this.internal.x = value;
      this.notifyOnChange();
    }
  }

  public get y(): number { return this.internal.y; }
  public set y(value: number) {
    if (this.internal.y !== value) {
      this.internal.y = value;
      this.notifyOnChange();
    }
  }

  public get z(): number { return this.internal.z; }
  public set z(value: number) {
    if (this.internal.z !== value) {
      this.internal.z = value;
      this.notifyOnChange();
    }
  }

  public static zero(): EulerVector3 { return new EulerVector3(0, 0, 0); }
}

import { Observable } from "@lofi/core/util/Observable";

import { DegreesToRadians } from "./util";
import { Vector3, type Vector3Like } from "./Vector3";
import { EulerVector3 } from "./EulerVector3";

export interface IReadOnlyQuaternion {
  toEuler(): EulerVector3;
  multiply(q: IReadOnlyQuaternion): IReadOnlyQuaternion;
  rotateVectorInPlace(vector: Vector3): Vector3;
  rotateVector(vector: Vector3): Vector3;
  slerp(right: IReadOnlyQuaternion, t: number): IReadOnlyQuaternion;
  invert(): IReadOnlyQuaternion;
  normalize(): IReadOnlyQuaternion;
  clone(): IReadOnlyQuaternion;
  toString(): string;
  get x(): number;
  get y(): number;
  get z(): number;
  get w(): number;
}

class QuaternionInternalBuffer {
  public static readonly BufferSize: number = 4;
  public readonly buffer: Float64Array = new Float64Array(QuaternionInternalBuffer.BufferSize);
  public get x(): number { return this.buffer[0]; }
  public set x(value: number) { this.buffer[0] = value; }
  public get y(): number { return this.buffer[1]; }
  public set y(value: number) { this.buffer[1] = value; }
  public get z(): number { return this.buffer[2]; }
  public set z(value: number) { this.buffer[2] = value; }
  public get w(): number { return this.buffer[3]; }
  public set w(value: number) { this.buffer[3] = value; }
}

export class Quaternion extends Observable implements IReadOnlyQuaternion {
  // @NOTE Raw values encapsulated in annoying object type to prevent
  // accidental direct access. Always use `this.{x,y,z,w}` getters/setters,
  // so that possible subclasses etc. always pick up correct side effects.
  private readonly internal: QuaternionInternalBuffer;

  public constructor(x: number, y: number, z: number, w: number) {
    super();
    this.internal = new QuaternionInternalBuffer();
    this.internal.x = x;
    this.internal.y = y;
    this.internal.z = z;
    this.internal.w = w;
  }

  /**
   * Convert the quaternion to Euler angles (in degrees).
   */
  public toEuler(): EulerVector3 {
    return EulerVector3.zero().setValue(this);
  }

  public multiplySelf(q: IReadOnlyQuaternion): this {
    const { x, y, z, w } = this;
    this.internal.x = w * q.x + x * q.w + y * q.z - z * q.y;
    this.internal.y = w * q.y - x * q.z + y * q.w + z * q.x;
    this.internal.z = w * q.z + x * q.y - y * q.x + z * q.w;
    this.internal.w = w * q.w - x * q.x - y * q.y - z * q.z;
    this.notifyOnChange();
    return this;
  }
  public multiply(q: IReadOnlyQuaternion): Quaternion {
    return this.clone().multiplySelf(q);
  }

  public slerpSelf(right: IReadOnlyQuaternion, t: number): this {
    // Sanitise
    t = Math.min(1, Math.max(t, 0));

    // From: https://github.com/BabylonJS/Babylon.js/blob/86bda66b6f61e482374c1a0597f1f504cd75837d/packages/dev/core/src/Maths/math.vector.ts#L5826
    let num2;
    let num3;
    let num4 = this.x * right.x + this.y * right.y + this.z * right.z + this.w * right.w;
    let flag = false;

    if (num4 < 0) {
      flag = true;
      num4 = -num4;
    }

    if (num4 > 0.999999) {
      num3 = 1 - t;
      num2 = flag ? -t : t;
    } else {
      const num5 = Math.acos(num4);
      const num6 = 1.0 / Math.sin(num5);
      num3 = Math.sin((1.0 - t) * num5) * num6;
      num2 = flag ? -Math.sin(t * num5) * num6 : Math.sin(t * num5) * num6;
    }

    this.internal.x = num3 * this.x + num2 * right.x;
    this.internal.y = num3 * this.y + num2 * right.y;
    this.internal.z = num3 * this.z + num2 * right.z;
    this.internal.w = num3 * this.w + num2 * right.w;
    this.notifyOnChange();

    return this;
  }
  public slerp(right: IReadOnlyQuaternion, t: number): Quaternion {
    return this.clone().slerpSelf(right, t);
  }

  public invertSelf(): this {
    this.internal.x = -this.x;
    this.internal.y = -this.y;
    this.internal.z = -this.z;
    // @NOTE w remains unchanged.
    this.notifyOnChange();
    return this;
  }
  public invert(): Quaternion {
    return this.clone().invertSelf();
  }

  public normalizeSelf(): this {
    const n = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
    if (n === 0) {
      this.internal.x = this.internal.y = this.internal.z = 0;
      this.internal.w = 1;
    } else {
      this.internal.x /= n;
      this.internal.y /= n;
      this.internal.z /= n;
      this.internal.w /= n;
    }
    this.notifyOnChange();

    return this;
  }
  public normalize(): Quaternion {
    return this.clone().normalizeSelf();
  }

  public setValue(x: number, y: number, z: number, w: number): this;
  public setValue(value: IReadOnlyQuaternion): this;
  public setValue(xOrValue: number | IReadOnlyQuaternion, maybeY?: number, maybeZ?: number, maybeW?: number): this {
    let valueChanged: boolean;
    if (typeof xOrValue === 'number') {
      valueChanged = this.setValueXYZW(xOrValue, maybeY as number, maybeZ as number, maybeW as number);
    } else {
      valueChanged = this.setValueQuaternion(xOrValue);
    }
    if (valueChanged) {
      this.notifyOnChange();
    }
    return this;
  }
  private setValueXYZW(x: number, y: number, z: number, w: number): boolean {
    if (this.internal.x === x && this.internal.y === y && this.internal.z === z && this.internal.w === w) {
      // @NOTE Write is not changing the value
      return false;
    }
    this.internal.x = x;
    this.internal.y = y;
    this.internal.z = z;
    this.internal.w = w;
    return true;
  }
  private setValueQuaternion(value: IReadOnlyQuaternion): boolean {
    if (this.internal.x === value.x && this.internal.y === value.y && this.internal.z === value.z && this.internal.w === value.w) {
      // @NOTE Write is not changing the value
      return false;
    }
    this.internal.x = value.x;
    this.internal.y = value.y;
    this.internal.z = value.z;
    this.internal.w = value.w;
    return true;
  }

  public rotateVectorInPlace(vector: Vector3): Vector3 {
    // Fast Vector Rotation using Quaternions by Robert Eisele
    // https://raw.org/proof/vector-rotation-using-quaternions/
    const { x, y, z } = vector;

    // v = this.{x,y,z}
    // u = vector.{x,y,z}

    // t = 2v x u (expressed as `2 * (v x u)`)
    const tx = 2 * (this.y * z - this.z * y);
    const ty = 2 * (this.z * x - this.x * z);
    const tz = 2 * (this.x * y - this.y * x);

    // u + w t + v x t
    return vector.setValue(
      x + this.w * tx + this.y * tz - this.z * ty,
      y + this.w * ty + this.z * tx - this.x * tz,
      z + this.w * tz + this.x * ty - this.y * tx,
    );
  }

  public rotateVector(vector: Vector3): Vector3 {
    return this.rotateVectorInPlace(vector.clone());
  }

  public clone(): Quaternion {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }

  public toString(): string {
    return `${Quaternion.name}(x=${this.x}, y=${this.y}, z=${this.z}, w=${this.w})`;
  }

  public identitySelf(): this {
    this.internal.x = 0;
    this.internal.y = 0;
    this.internal.z = 0;
    this.internal.w = 1;
    this.notifyOnChange();
    return this;
  }
  /**
   * Create a quaternion that represents no rotation.
   */
  public static identity(): Quaternion {
    return new Quaternion(0, 0, 0, 1);
  }

  private static tmp_fromAxisAngle: Vector3 | undefined;
  public fromAxisAngleSelf(axis: Vector3, angle: number): this {
    const halfAngle = angle * DegreesToRadians * 0.5;
    const s = Math.sin(halfAngle);

    // Lazily initialise static Vector instance
    Quaternion.tmp_fromAxisAngle ??= Vector3.zero();

    // Assign to reusable static instance
    axis = Quaternion.tmp_fromAxisAngle
      .setValue(axis)
      .normalizeSelf();

    this.internal.x = axis.x * s;
    this.internal.y = axis.y * s;
    this.internal.z = axis.z * s;
    this.internal.w = Math.cos(halfAngle);
    this.notifyOnChange();
    return this;
  }
  /**
   * Creates a quaternion from an axis and angle (in degrees).
   * @param axis The axis of rotation.
   * @param angle The angle in degrees.
   */
  public static fromAxisAngle(axis: Vector3, angle: number): Quaternion {
    return Quaternion.identity().fromAxisAngleSelf(axis, angle);
  }

  public fromEulerSelf(x: number, y: number, z: number): this;
  public fromEulerSelf(vector: Vector3Like): this;
  public fromEulerSelf(xOrVector: number | Vector3Like, y?: number, z?: number): this {
    if (typeof xOrVector === 'number') {
      this.fromEulerSelfXYZ(xOrVector, y as number, z as number);
    } else {
      this.fromEulerSelfVector(xOrVector);
    }
    this.notifyOnChange();
    return this;

  }
  private fromEulerSelfXYZ(x: number, y: number, z: number): void {
    this.__fromEulerInner(
      x * DegreesToRadians,
      y * DegreesToRadians,
      z * DegreesToRadians,
    );
  }
  private fromEulerSelfVector(vector: Vector3Like): void {
    this.__fromEulerInner(
      vector.x * DegreesToRadians,
      vector.y * DegreesToRadians,
      vector.z * DegreesToRadians,
    );
  }
  private __fromEulerInner(x: number, y: number, z: number): void {
    /*
      @NOTE Rotation order is ZXY where:
      Z = Yaw, X = Pitch, Y = Roll

      Equations are equivalent to:

      ```
      const qx = Quaternion.fromAxisAngle(new Vector3(1, 0, 0), xValue * RadiansToDegrees);
      const qy = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), yValue * RadiansToDegrees);
      const qz = Quaternion.fromAxisAngle(new Vector3(0, 0, 1), zValue * RadiansToDegrees);
      return qz.multiply(qx).multiply(qy);
      ```

      Equations can be derived by fully expanding the above and simplifying.
     */

    const halfYaw = z * 0.5;
    const halfPitch = x * 0.5;
    const halfRoll = y * 0.5;
    const sinRoll = Math.sin(halfRoll);
    const cosRoll = Math.cos(halfRoll);
    const sinPitch = Math.sin(halfPitch);
    const cosPitch = Math.cos(halfPitch);
    const sinYaw = Math.sin(halfYaw);
    const cosYaw = Math.cos(halfYaw);

    this.internal.x = cosYaw * sinPitch * cosRoll - sinYaw * cosPitch * sinRoll;
    this.internal.y = cosYaw * cosPitch * sinRoll + sinYaw * sinPitch * cosRoll;
    this.internal.z = cosYaw * sinPitch * sinRoll + sinYaw * cosPitch * cosRoll;
    this.internal.w = cosYaw * cosPitch * cosRoll - sinYaw * sinPitch * sinRoll;
  }

  /**
     * Creates a quaternion from Euler angles (in degrees).
     * @param x Rotation around X axis in degrees.
     * @param y Rotation around Y axis in degrees.
     * @param z Rotation around Z axis in degrees.
     */
  public static fromEuler(vector: Vector3Like): Quaternion;
  public static fromEuler(x: number, y: number, z: number): Quaternion;
  public static fromEuler(xOrVector: number | Vector3Like, y?: number, z?: number): Quaternion {
    // @NOTE TypeScript is too dumb to figure this one out
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return Quaternion.identity().fromEulerSelf(xOrVector as any, y as any, z as any);
  }

  /** Reusable static values for `fromLookDirectionSelf()` */
  private static tmp_fromLookDirectionSelf_forward: Vector3 | undefined;
  private static tmp_fromLookDirectionSelf_up: Vector3 | undefined;
  private static tmp_fromLookDirectionSelf_right: Vector3 | undefined;
  private static tmp_fromLookDirectionSelf_DefaultUp: Vector3 | undefined;
  public fromLookDirectionSelf(forward: Vector3Like, up?: Vector3Like): this {
    // Param defaults
    up ??= (Quaternion.tmp_fromLookDirectionSelf_DefaultUp ??= Vector3.up());

    // Lazily initialise static Vector instances
    Quaternion.tmp_fromLookDirectionSelf_forward ??= Vector3.zero();
    Quaternion.tmp_fromLookDirectionSelf_up ??= Vector3.zero();
    Quaternion.tmp_fromLookDirectionSelf_right ??= Vector3.zero();

    // Calculate strictly orthogonal basis vectors
    // using reusable static instances
    const right = Quaternion.tmp_fromLookDirectionSelf_right
      .setValue(forward)
      .crossSelf(up)
      .normalizeSelf();
    up = Quaternion.tmp_fromLookDirectionSelf_up
      .setValue(forward)
      .normalizeSelf();
    forward = Quaternion.tmp_fromLookDirectionSelf_forward
      .setValue(right)
      .crossSelf(forward)
      .normalizeSelf();

    // Mostly inspired from: https://github.com/BabylonJS/Babylon.js/blob/86bda66b6f61e482374c1a0597f1f504cd75837d/packages/dev/core/src/Maths/math.vector.ts#L5335
    const trace = right.x + up.y + forward.z;

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      this.internal.x = (up.z - forward.y) * s;
      this.internal.y = (forward.x - right.z) * s;
      this.internal.z = (right.y - up.x) * s;
      this.internal.w = 0.25 / s;
    } else if (right.x > up.y && right.x > forward.z) {
      const s = 2.0 * Math.sqrt(1.0 + right.x - up.y - forward.z);
      this.internal.x = 0.25 * s;
      this.internal.y = (up.x + right.y) / s;
      this.internal.z = (forward.x + right.z) / s;
      this.internal.w = (up.z - forward.y) / s;
    } else if (up.y > forward.z) {
      const s = 2.0 * Math.sqrt(1.0 + up.y - right.x - forward.z);
      this.internal.x = (up.x + right.y) / s;
      this.internal.y = 0.25 * s;
      this.internal.z = (forward.y + up.z) / s;
      this.internal.w = (forward.x - right.z) / s;
    } else {
      const s = 2.0 * Math.sqrt(1.0 + forward.z - right.x - up.y);
      this.internal.x = (forward.x + right.z) / s;
      this.internal.y = (forward.y + up.z) / s;
      this.internal.z = 0.25 * s;
      this.internal.w = (right.y - up.x) / s;
    }
    this.notifyOnChange();
    return this;
  }

  /**
   * Construct a Quaternion from a direction + optional "up" (i.e. "roll") vector.
   * `up` does not have to be strictly orthogonal to `forward`.
   * If `up` is not provided, `Vector3.up()` is used as the default value.
   * @param forward Direction to convert into a Quaternion.
   * @param up (Optional) Up vector determining the roll of the resulting Quaternion.
   */
  public static fromLookDirection(forward: Vector3Like, up?: Vector3Like): Quaternion {
    return Quaternion.identity().fromLookDirectionSelf(forward, up);
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

  public get w(): number { return this.internal.w; }
  public set w(value: number) {
    if (this.internal.w !== value) {
      this.internal.w = value;
      this.notifyOnChange();
    }
  }
}

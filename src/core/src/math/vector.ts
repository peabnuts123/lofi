import { Observable } from "@lofi/core/util/observable";

import { Matrix4 } from "./Matrix4";
import { type IReadOnlyQuaternion } from "./Quaternion";

// @TODO Split into separate files Vector2, Vector3, etc.

export type AnyVector = Vector3 | Vector2;
export type AnyReadonlyVector = IReadonlyVector3 | IReadonlyVector2;

// @TODO Rename to `Vector3Like`  (Or what about we rename `Vector2Like` to definition?)
export interface Vector3Definition {
  x: number;
  y: number;
  z: number;
}
export interface Vector2Like {
  x: number;
  y: number;
}

export interface IReadonlyVector2 {
  add(value: IReadonlyVector2): Vector2;
  subtract(value: IReadonlyVector2): Vector2;
  multiply(factor: number): Vector2;
  multiply(other: IReadonlyVector2): Vector2;
  divide(factor: number): Vector2;
  divide(other: IReadonlyVector2): Vector2;
  length(): number;
  lengthSquared(): number;
  normalize(): Vector2;
  perpendicular(): Vector2;
  dot(other: Vector2): number;
  isNormalized(): boolean;
  clone(): Vector2;
  withX(value: number): Vector2;
  withY(value: number): Vector2;
  toString(): string;
  get x(): number;
  get y(): number;
}

class Vector2InternalBuffer {
  public static readonly BufferSize: number = 2;
  public readonly buffer: Float64Array<ArrayBuffer> = new Float64Array(Vector2InternalBuffer.BufferSize);
  public get x(): number { return this.buffer[0]; }
  public set x(value: number) { this.buffer[0] = value; }
  public get y(): number { return this.buffer[1]; }
  public set y(value: number) { this.buffer[1] = value; }
}

export class Vector2 extends Observable implements IReadonlyVector2 {
  private readonly internal: Vector2InternalBuffer;

  public constructor(x: number, y: number) {
    super();
    this.internal = new Vector2InternalBuffer();
    this.internal.x = x;
    this.internal.y = y;
  }

  public setValue(x: number, y: number): this;
  public setValue(value: Vector2Like): this;
  public setValue(valueOrX: Vector2Like | number, maybeY: boolean | number = true): this {
    if (typeof valueOrX === 'number' && typeof maybeY === 'number') {
      this.internal.x = valueOrX;
      this.internal.y = maybeY;
    } else if (typeof valueOrX === 'object') {
      this.internal.x = valueOrX.x;
      this.internal.y = valueOrX.y;
    } else {
      throw new Error(`Unrecognised arguments to 'setValue()'`);
    }
    this.notifyOnChange();
    return this;
  }

  public addSelf(value: IReadonlyVector2): this {
    this.internal.x += value.x;
    this.internal.y += value.y;
    this.notifyOnChange();
    return this;
  }
  public add(value: IReadonlyVector2): Vector2 {
    return this.clone().addSelf(value);
  }

  public subtractSelf(value: IReadonlyVector2): this {
    this.internal.x -= value.x;
    this.internal.y -= value.y;
    this.notifyOnChange();
    return this;
  }
  public subtract(value: IReadonlyVector2): Vector2 {
    return this.clone().subtractSelf(value);
  }

  public multiplySelf(factor: number): this;
  public multiplySelf(other: IReadonlyVector2): this;
  public multiplySelf(operand: number | IReadonlyVector2): this {
    if (typeof operand === 'number') {
      return this.multiplyNumberSelf(operand);
    } else {
      return this.multiplyVector2Self(operand);
    }
  }
  private multiplyVector2Self(other: IReadonlyVector2): this {
    this.internal.x *= other.x;
    this.internal.y *= other.y;
    this.notifyOnChange();
    return this;
  }
  private multiplyNumberSelf(factor: number): this {
    this.internal.x *= factor;
    this.internal.y *= factor;
    this.notifyOnChange();
    return this;
  }


  public multiply(factor: number): Vector2;
  public multiply(other: IReadonlyVector2): Vector2;
  public multiply(operand: number | IReadonlyVector2): Vector2 {
    if (typeof operand === 'number') {
      return this.clone().multiplySelf(operand);
    } else {
      return this.clone().multiplySelf(operand);
    }
  }

  public divideSelf(factor: number): this;
  public divideSelf(other: IReadonlyVector2): this;
  public divideSelf(operand: number | IReadonlyVector2): this {
    if (typeof operand === 'number') {
      if (operand === 0) {
        throw new Error(`Cannot divide Vector2 by 0`);
      }
      this.internal.x /= operand;
      this.internal.y /= operand;
    } else {
      if (operand.x === 0 || operand.y === 0) {
        throw new Error(`Cannot divide Vector2 by 0: ${operand}`);
      }
      this.internal.x /= operand.x;
      this.internal.y /= operand.y;
    }
    this.notifyOnChange();
    return this;
  }
  public divide(factor: number): Vector2;
  public divide(other: IReadonlyVector2): Vector2;
  public divide(operand: number | IReadonlyVector2): Vector2 {
    if (typeof operand === 'number') {
      return this.clone().divideSelf(operand);
    } else {
      return this.clone().divideSelf(operand);
    }
  }

  public length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  public lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * Scale this vector such that it has length 1.
   * It's efficient to call this if you aren't sure whether
   * a vector is normalized i.e. there is no performance benefit
   * to checking first:
   * ```
   * // Unnecessary, `normalizeSelf()` already checks this
   * if (vector.isNormalized()) {
   *   vector.normalizeSelf();
   * }
   * ```
   */
  public normalizeSelf(): this {
    const lengthSqr = this.lengthSquared();
    if (lengthSqr === 1 || lengthSqr === 0) {
      return this;
    }
    const length = Math.sqrt(lengthSqr);
    this.internal.x /= length;
    this.internal.y /= length;
    this.notifyOnChange();
    return this;
  }
  public normalize(): Vector2 {
    const length = this.length();
    if (length === 0) {
      return Vector2.zero();
    }
    return this.divide(length);
  }

  public perpendicularSelf(): this {
    const x = this.y;
    const y = -this.x;
    this.internal.x = x;
    this.internal.y = y;
    this.notifyOnChange();
    return this;
  }
  public perpendicular(): Vector2 {
    return this.clone().perpendicularSelf();
  }

  public dot(other: Vector2): number {
    return this.x * other.x + this.y * other.y;
  }

  public isNormalized(): boolean {
    return this.lengthSquared() === 1.0;
  }

  public clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  public setX(value: number): this {
    this.x = value;
    return this;
  }
  public withX(value: number): Vector2 {
    return this.clone().setX(value);
  }

  public setY(value: number): this {
    this.y = value;
    return this;
  }
  public withY(value: number): Vector2 {
    return this.clone().setY(value);
  }

  public toString(): string {
    return `Vector2(${this.x}, ${this.y})`;
  }

  public get x(): number { return this.internal.x; }
  public set x(value: number) {
    this.internal.x = value;
    this.notifyOnChange();
  }
  public get y(): number { return this.internal.y; }
  public set y(value: number) {
    this.internal.y = value;
    this.notifyOnChange();
  }

  public static zero(): Vector2 { return new Vector2(0, 0); }
  public static one(): Vector2 { return new Vector2(1, 1); }

  public static up(): Vector2 { return new Vector2(0, 1); }
  public static down(): Vector2 { return new Vector2(0, -1); }
  public static right(): Vector2 { return new Vector2(1, 0); }
  public static left(): Vector2 { return new Vector2(-1, 0); }
}

export interface IReadonlyVector3 {
  add(value: AnyReadonlyVector): Vector3;
  subtract(value: AnyReadonlyVector): Vector3;
  multiply(factor: number): Vector3;
  multiply(other: IReadonlyVector3): Vector3;
  multiply(quaternion: IReadOnlyQuaternion): Vector3;
  multiply(matrix: Matrix4): Vector3;
  divide(factor: number): Vector3;
  divide(other: IReadonlyVector3): Vector3;
  length(): number;
  lengthSquared(): number;
  normalize(): IReadonlyVector3;
  cross(other: IReadonlyVector3): Vector3;
  dot(other: IReadonlyVector3): number;
  isNormalized(): boolean;
  clone(): Vector3;
  withX(value: number): Vector3;
  withY(value: number): Vector3;
  withZ(value: number): Vector3;
  toString(): string;
  get x(): number;
  get y(): number;
  get z(): number;
}

class Vector3InternalBuffer {
  public static readonly BufferSize: number = 3;
  public readonly buffer: Float64Array<ArrayBuffer> = new Float64Array(Vector3InternalBuffer.BufferSize);
  public get x(): number { return this.buffer[0]; }
  public set x(value: number) { this.buffer[0] = value; }
  public get y(): number { return this.buffer[1]; }
  public set y(value: number) { this.buffer[1] = value; }
  public get z(): number { return this.buffer[2]; }
  public set z(value: number) { this.buffer[2] = value; }
}
export class Vector3 extends Observable implements IReadonlyVector3 {
  private readonly internal: Vector3InternalBuffer;

  public constructor(x: number, y: number, z: number) {
    super();
    this.internal = new Vector3InternalBuffer();
    this.internal.x = x;
    this.internal.y = y;
    this.internal.z = z;
  }

  public setValue(x: number, y: number, z: number): this;
  public setValue(value: Vector3Definition): this;
  public setValue(valueOrX: Vector3Definition | number, maybeY: boolean | number = true, maybeZ?: number): this {
    /* Wow sorry for this completely cursed method signature */
    if (typeof valueOrX === 'number' && typeof maybeY === 'number' && typeof maybeZ === 'number') {
      this.internal.x = valueOrX;
      this.internal.y = maybeY;
      this.internal.z = maybeZ;
    } else if (typeof valueOrX === 'object') {
      this.internal.x = valueOrX.x;
      this.internal.y = valueOrX.y;
      this.internal.z = valueOrX.z;
    } else {
      throw new Error(`Unrecognised arguments to 'setValue()'`);
    }
    this.notifyOnChange();

    return this;
  }

  public addSelf(value: AnyReadonlyVector): this {
    this.internal.x += value.x;
    this.internal.y += value.y;
    if ('z' in value) {
      this.internal.z += value.z;
    }
    this.notifyOnChange();
    return this;
  }
  public add(value: AnyReadonlyVector): Vector3 {
    return this.clone().addSelf(value);
  }

  public subtractSelf(value: AnyReadonlyVector): this {
    this.internal.x -= value.x;
    this.internal.y -= value.y;
    if ('z' in value) {
      this.internal.z -= value.z;
    }
    this.notifyOnChange();
    return this;
  }
  public subtract(value: AnyReadonlyVector): Vector3 {
    return this.clone().subtractSelf(value);
  }

  public multiplySelf(factor: number): this;
  public multiplySelf(other: IReadonlyVector3): this;
  public multiplySelf(quaternion: IReadOnlyQuaternion): this;
  public multiplySelf(matrix: Matrix4): this;
  public multiplySelf(operand: number | IReadonlyVector3 | IReadOnlyQuaternion | Matrix4): this {
    if (typeof operand === 'number') {
      return this.multiplyNumberSelf(operand);
    } else if (operand instanceof Matrix4) {
      return this.multiplyMatrix4Self(operand);
    } else if ('w' in operand) {
      return this.multiplyQuaternionSelf(operand);
    } else {
      return this.multiplyVector3Self(operand);
    }
  }
  private multiplyNumberSelf(factor: number): this {
    this.internal.x *= factor;
    this.internal.y *= factor;
    this.internal.z *= factor;
    this.notifyOnChange();
    return this;
  }
  private multiplyQuaternionSelf(quat: IReadOnlyQuaternion): this {
    // Fast Vector Rotation using Quaternions by Robert Eisele
    // https://raw.org/proof/vector-rotation-using-quaternions/
    const { x, y, z } = this;

    // v = quat.{x,y,z}
    // u = this.{x,y,z}

    // t = 2v x u (expressed as `2 * (v x u)`)
    const tx = 2 * (quat.y * z - quat.z * y);
    const ty = 2 * (quat.z * x - quat.x * z);
    const tz = 2 * (quat.x * y - quat.y * x);

    // u + w t + v x t
    this.internal.x = x + quat.w * tx + quat.y * tz - quat.z * ty;
    this.internal.y = y + quat.w * ty + quat.z * tx - quat.x * tz;
    this.internal.z = z + quat.w * tz + quat.x * ty - quat.y * tx;

    this.notifyOnChange();

    return this;
  }
  private multiplyMatrix4Self(matrix: Matrix4): this {
    const { x, y, z } = this;
    const w = matrix.m30 * this.x + matrix.m31 * this.y + matrix.m32 * this.z + matrix.m33 || 1.0;
    this.internal.x = (matrix.m00 * x + matrix.m01 * y + matrix.m02 * z + matrix.m03) / w;
    this.internal.y = (matrix.m10 * x + matrix.m11 * y + matrix.m12 * z + matrix.m13) / w;
    this.internal.z = (matrix.m20 * x + matrix.m21 * y + matrix.m22 * z + matrix.m23) / w;
    this.notifyOnChange();
    return this;
  }
  private multiplyVector3Self(other: IReadonlyVector3): this {
    this.internal.x *= other.x;
    this.internal.y *= other.y;
    this.internal.z *= other.z;
    this.notifyOnChange();
    return this;
  }

  public multiply(factor: number): Vector3;
  public multiply(other: IReadonlyVector3): Vector3;
  public multiply(quaternion: IReadOnlyQuaternion): Vector3;
  public multiply(matrix: Matrix4): Vector3;
  public multiply(operand: number | IReadonlyVector3 | IReadOnlyQuaternion | Matrix4): Vector3 {
    if (typeof operand === 'number') {
      return this.clone().multiplySelf(operand);
    } else if (operand instanceof Matrix4) {
      return this.clone().multiplySelf(operand);
    } else if ('w' in operand) {
      return this.clone().multiplySelf(operand);
    } else {
      return this.clone().multiplySelf(operand);
    }
  }

  public divideSelf(factor: number): this;
  public divideSelf(other: IReadonlyVector3): this;
  public divideSelf(operand: number | IReadonlyVector3): this {
    if (typeof operand === 'number') {
      if (operand === 0) {
        throw new Error(`Cannot divide Vector3 by 0`);
      }
      this.internal.x /= operand;
      this.internal.y /= operand;
      this.internal.z /= operand;
    } else {
      if (operand.x === 0 || operand.y === 0 || operand.z === 0) {
        throw new Error(`Cannot divide Vector3 by 0: ${operand}`);
      }
      this.internal.x /= operand.x;
      this.internal.y /= operand.y;
      this.internal.z /= operand.z;
    }
    this.notifyOnChange();
    return this;
  }
  public divide(factor: number): Vector3;
  public divide(other: IReadonlyVector3): Vector3;
  public divide(operand: number | IReadonlyVector3): Vector3 {
    if (typeof operand === 'number') {
      return this.clone().divideSelf(operand);
    } else {
      return this.clone().divideSelf(operand);
    }
  }

  public length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  public lengthSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  /**
   * Scale this vector such that it has length 1.
   * It's efficient to call this if you aren't sure whether
   * a vector is normalized i.e. there is no performance benefit
   * to checking first:
   * ```
   * // Unnecessary, `normalizeSelf()` already checks this
   * if (vector.isNormalized()) {
   *   vector.normalizeSelf();
   * }
   * ```
   */
  public normalizeSelf(): this {
    const lengthSqr = this.lengthSquared();
    if (lengthSqr === 1 || lengthSqr === 0) {
      return this;
    }
    const length = Math.sqrt(lengthSqr);
    this.internal.x /= length;
    this.internal.y /= length;
    this.internal.z /= length;
    this.notifyOnChange();
    return this;
  }
  public normalize(): Vector3 {
    return this.clone().normalizeSelf();
  }

  public crossSelf(other: IReadonlyVector3): this {
    // @NOTE Compute all three values first. We need all
    // components x/y/z in each calculation so modification
    // would produce the wrong result.
    const x = this.y * other.z - this.z * other.y;
    const y = this.z * other.x - this.x * other.z;
    const z = this.x * other.y - this.y * other.x;
    this.internal.x = x;
    this.internal.y = y;
    this.internal.z = z;
    this.notifyOnChange();
    return this;
  }
  public cross(other: IReadonlyVector3): Vector3 {
    return this.clone().crossSelf(other);
  }

  public dot(other: IReadonlyVector3): number {
    /*
      @NOTE to self
        (a·b) / a.lengthSqr = project b onto a
        (a·b) / b.lengthSqr = project a onto b
     */
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  public isNormalized(): boolean {
    return this.lengthSquared() === 1.0;
  }

  public clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  public setX(value: number): this {
    this.x = value;
    return this;
  }
  public withX(value: number): Vector3 {
    return this.clone().setX(value);
  }

  public setY(value: number): this {
    this.y = value;
    return this;
  }
  public withY(value: number): Vector3 {
    return this.clone().setY(value);
  }

  public setZ(value: number): this {
    this.z = value;
    return this;
  }
  public withZ(value: number): Vector3 {
    return this.clone().setZ(value);
  }

  public toString(): string {
    return `Vector3(${this.x}, ${this.y}, ${this.z})`;
  }

  public get x(): number { return this.internal.x; }
  public set x(value: number) {
    this.internal.x = value;
    this.notifyOnChange();
  }

  public get y(): number { return this.internal.y; }
  public set y(value: number) {
    this.internal.y = value;
    this.notifyOnChange();
  }

  public get z(): number { return this.internal.z; }
  public set z(value: number) {
    this.internal.z = value;
    this.notifyOnChange();
  }

  public static zero(): Vector3 { return new Vector3(0, 0, 0); }
  public static one(): Vector3 { return new Vector3(1, 1, 1); }

  public static up(): Vector3 { return new Vector3(0, 0, 1); }
  public static down(): Vector3 { return new Vector3(0, 0, -1); }
  public static right(): Vector3 { return new Vector3(1, 0, 0); }
  public static left(): Vector3 { return new Vector3(-1, 0, 0); }
  public static forward(): Vector3 { return new Vector3(0, 1, 0); }
  public static back(): Vector3 { return new Vector3(0, -1, 0); }
}

class EulerVector3InternalBuffer extends Vector3InternalBuffer {
  public get x(): number { return this.buffer[0]; }
  public set x(value: number) { this.buffer[0] = value % 360; }
  public get y(): number { return this.buffer[1]; }
  public set y(value: number) { this.buffer[1] = value % 360; }
  public get z(): number { return this.buffer[2]; }
  public set z(value: number) { this.buffer[2] = value % 360; }
}

/**
 * A Vector3 specifically for expressing Euler rotation angles,
 * where all xyz components are always wrapped between -360 and 360.
 */
export class EulerVector3 extends Vector3 {
  public constructor(
    x: number,
    y: number,
    z: number,
  ) {
    super(
      x % 360,
      y % 360,
      z % 360,
    );
    // @NOTE Override internal buffer with euler-based implementation
    Object.assign(this, { internal: new EulerVector3InternalBuffer() });
    this['internal'].x = x;
    this['internal'].y = y;
    this['internal'].z = z;
  }

  public override get x(): number { return super.x; }
  public override set x(value: number) {
    super.x = value % 360;
  }

  public override get y(): number { return super.y; }
  public override set y(value: number) {
    super.y = value % 360;
  }

  public override get z(): number { return super.z; }
  public override set z(value: number) {
    super.z = value % 360;
  }
}

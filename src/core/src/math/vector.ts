import { Observable } from "@lofi/core/util/observable";

import { Matrix4 } from "./Matrix4";
import { Quaternion, type IReadOnlyQuaternion } from "./Quaternion";
import { RadiansToDegrees } from "./util";

// @TODO Split into separate files Vector2, Vector3, etc.

export type AnyVector = Vector3 | Vector2;
export type AnyReadonlyVector = IReadonlyVector3 | IReadonlyVector2;
export type AnyVectorLike = Vector2Like | Vector3Definition;

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
  add(value: Vector2Like): Vector2;
  subtract(value: Vector2Like): Vector2;
  multiply(factor: number): Vector2;
  multiply(other: Vector2Like): Vector2;
  divide(factor: number): Vector2;
  divide(other: Vector2Like): Vector2;
  length(): number;
  lengthSquared(): number;
  normalize(): Vector2;
  perpendicular(): Vector2;
  dot(other: Vector2Like): number;
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
  public setValue(valueOrX: Vector2Like | number, maybeY?: number): this {
    if (typeof valueOrX === 'number') {
      this.setValueXY(valueOrX, maybeY as number);
    } else {
      this.setValueVector(valueOrX);
    }
    this.notifyOnChange();
    return this;
  }
  private setValueXY(x: number, y: number): void {
    this.internal.x = x;
    this.internal.y = y;
  }
  private setValueVector(vector: Vector2Like): void {
    this.internal.x = vector.x;
    this.internal.y = vector.y;
  }

  public addSelf(value: Vector2Like): this {
    this.internal.x += value.x;
    this.internal.y += value.y;
    this.notifyOnChange();
    return this;
  }
  public add(value: Vector2Like): Vector2 {
    return this.clone().addSelf(value);
  }

  public subtractSelf(value: Vector2Like): this {
    this.internal.x -= value.x;
    this.internal.y -= value.y;
    this.notifyOnChange();
    return this;
  }
  public subtract(value: Vector2Like): Vector2 {
    return this.clone().subtractSelf(value);
  }

  public multiplySelf(factor: number): this;
  public multiplySelf(other: Vector2Like): this;
  public multiplySelf(operand: number | Vector2Like): this {
    if (typeof operand === 'number') {
      return this.multiplySelfNumber(operand);
    } else {
      return this.multiplySelfVector(operand);
    }
  }
  private multiplySelfVector(other: Vector2Like): this {
    this.internal.x *= other.x;
    this.internal.y *= other.y;
    this.notifyOnChange();
    return this;
  }
  private multiplySelfNumber(factor: number): this {
    this.internal.x *= factor;
    this.internal.y *= factor;
    this.notifyOnChange();
    return this;
  }

  public multiply(factor: number): Vector2;
  public multiply(other: Vector2Like): Vector2;
  public multiply(operand: number | Vector2Like): Vector2 {
    // @NOTE TypeScript is too dumb to figure this one out
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.clone().multiplySelf(operand as any);
  }

  public divideSelf(factor: number): this;
  public divideSelf(other: Vector2Like): this;
  public divideSelf(operand: number | Vector2Like): this {
    if (typeof operand === 'number') {
      this.divideSelfNumber(operand);
    } else {
      this.divideSelfVector(operand);
    }
    this.notifyOnChange();
    return this;
  }
  private divideSelfNumber(factor: number): void {
    if (factor === 0) {
      throw new Error(`Cannot divide Vector2 by 0`);
    }
    this.internal.x /= factor;
    this.internal.y /= factor;
  }
  private divideSelfVector(other: Vector2Like): void {
    if (other.x === 0 || other.y === 0) {
      throw new Error(`Cannot divide Vector2 by 0: ${JSON.stringify({ x: other.x, y: other.y })}`);
    }
    this.internal.x /= other.x;
    this.internal.y /= other.y;
  }

  public divide(factor: number): Vector2;
  public divide(other: Vector2Like): Vector2;
  public divide(operand: number | Vector2Like): Vector2 {
    // @NOTE TypeScript is too dumb to figure this one out
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.clone().divideSelf(operand as any);
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
  add(value: AnyVectorLike): Vector3;
  subtract(value: AnyVectorLike): Vector3;
  multiply(factor: number): Vector3;
  multiply(other: Vector3Definition): Vector3;
  multiply(quaternion: IReadOnlyQuaternion): Vector3;
  multiply(matrix: Matrix4): Vector3;
  divide(factor: number): Vector3;
  divide(other: Vector3Definition): Vector3;
  length(): number;
  lengthSquared(): number;
  normalize(): Vector3;
  cross(other: Vector3Definition): Vector3;
  dot(other: Vector3Definition): number;
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
  protected internal: Vector3InternalBuffer;

  public constructor(x: number, y: number, z: number) {
    super();
    this.internal = new Vector3InternalBuffer();
    this.internal.x = x;
    this.internal.y = y;
    this.internal.z = z;
  }

  public setValue(x: number, y: number, z: number): this;
  public setValue(value: Vector3Definition): this;
  public setValue(valueOrX: Vector3Definition | number, maybeY?: number, maybeZ?: number): this {
    if (typeof valueOrX === 'number') {
      this.setValueXYZ(valueOrX, maybeY as number, maybeZ as number);
    } else {
      this.setValueVector(valueOrX);
    }
    this.notifyOnChange();
    return this;
  }
  private setValueXYZ(x: number, y: number, z: number): void {
    this.internal.x = x;
    this.internal.y = y;
    this.internal.z = z;
  }
  private setValueVector(value: Vector3Definition): void {
    this.internal.x = value.x;
    this.internal.y = value.y;
    this.internal.z = value.z;
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
  private addSelfVector3(value: Vector3Definition): void {
    this.internal.x += value.x;
    this.internal.y += value.y;
    this.internal.z += value.z;
  }
  public add(value: AnyVectorLike): Vector3 {
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
  private subtractSelfVector3(value: Vector3Definition): void {
    this.internal.x -= value.x;
    this.internal.y -= value.y;
    this.internal.z -= value.z;
  }
  public subtract(value: AnyVectorLike): Vector3 {
    return this.clone().subtractSelf(value);
  }

  public multiplySelf(factor: number): this;
  public multiplySelf(other: Vector3Definition): this;
  public multiplySelf(quaternion: IReadOnlyQuaternion): this;
  public multiplySelf(matrix: Matrix4): this;
  public multiplySelf(operand: number | Vector3Definition | IReadOnlyQuaternion | Matrix4): this {
    if (typeof operand === 'number') {
      this.multiplySelfNumber(operand);
    } else if (operand instanceof Matrix4) {
      this.multiplySelfMatrix4(operand);
    } else if ('w' in operand) {
      this.multiplySelfQuaternion(operand);
    } else {
      this.multiplySelfVector3(operand);
    }
    this.notifyOnChange();
    return this;
  }
  private multiplySelfNumber(factor: number): void {
    this.internal.x *= factor;
    this.internal.y *= factor;
    this.internal.z *= factor;
  }
  private multiplySelfMatrix4(matrix: Matrix4): void {
    const { x, y, z } = this;
    const w = matrix.m30 * this.x + matrix.m31 * this.y + matrix.m32 * this.z + matrix.m33 || 1.0;
    this.internal.x = (matrix.m00 * x + matrix.m01 * y + matrix.m02 * z + matrix.m03) / w;
    this.internal.y = (matrix.m10 * x + matrix.m11 * y + matrix.m12 * z + matrix.m13) / w;
    this.internal.z = (matrix.m20 * x + matrix.m21 * y + matrix.m22 * z + matrix.m23) / w;
  }
  private multiplySelfQuaternion(quat: IReadOnlyQuaternion): void {
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
  }
  private multiplySelfVector3(other: Vector3Definition): void {
    this.internal.x *= other.x;
    this.internal.y *= other.y;
    this.internal.z *= other.z;
  }

  public multiply(factor: number): Vector3;
  public multiply(other: Vector3Definition): Vector3;
  public multiply(quaternion: IReadOnlyQuaternion): Vector3;
  public multiply(matrix: Matrix4): Vector3;
  public multiply(operand: number | Vector3Definition | IReadOnlyQuaternion | Matrix4): Vector3 {
    // @NOTE TypeScript is too dumb to figure this one out
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.clone().multiplySelf(operand as any);
  }

  public divideSelf(factor: number): this;
  public divideSelf(other: Vector3Definition): this;
  public divideSelf(operand: number | Vector3Definition): this {
    if (typeof operand === 'number') {
      this.divideSelfNumber(operand);
    } else {
      this.divideSelfVector(operand);
    }
    this.notifyOnChange();
    return this;
  }
  private divideSelfNumber(factor: number): void {
    if (factor === 0) {
      throw new Error(`Cannot divide Vector3 by 0`);
    }
    this.internal.x /= factor;
    this.internal.y /= factor;
    this.internal.z /= factor;
  }
  private divideSelfVector(other: Vector3Definition): void {
    if (other.x === 0 || other.y === 0 || other.z === 0) {
      throw new Error(`Cannot divide Vector3 by 0: ${JSON.stringify({ x: other.x, y: other.y, z: other.z })}`);
    }
    this.internal.x /= other.x;
    this.internal.y /= other.y;
    this.internal.z /= other.z;
  }
  public divide(factor: number): Vector3;
  public divide(other: Vector3Definition): Vector3;
  public divide(operand: number | Vector3Definition): Vector3 {
    // @NOTE TypeScript is too dumb to figure this one out
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.clone().divideSelf(operand as any);
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

  public crossSelf(other: Vector3Definition): this {
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
  public cross(other: Vector3Definition): Vector3 {
    return this.clone().crossSelf(other);
  }

  public dot(other: Vector3Definition): number {
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

class EulerVector3InternalBuffer {
  public static readonly BufferSize: number = 3;
  public readonly buffer: Float64Array<ArrayBuffer> = new Float64Array(EulerVector3InternalBuffer.BufferSize);
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
  public setValue(vector: Vector3Definition): this;
  public setValue(quaternion: Quaternion): this;
  public setValue(vectorOrQuaternionOrX: Vector3Definition | Quaternion | number, maybeY?: number, maybeZ?: number): this {
    if (typeof vectorOrQuaternionOrX === 'number') {
      this.setValueXYZ(vectorOrQuaternionOrX, maybeY as number, maybeZ as number);
    } else if (vectorOrQuaternionOrX instanceof Quaternion) {
      this.setValueQuaternion(vectorOrQuaternionOrX);
    } else {
      this.setValueVector(vectorOrQuaternionOrX);
    }
    this.notifyOnChange();
    return this;
  }
  private setValueXYZ(x: number, y: number, z: number): void {
    this.internal.x = x;
    this.internal.y = y;
    this.internal.z = z;
  }
  private setValueQuaternion(quat: Quaternion): void {
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
    this.internal.x = resultX * RadiansToDegrees;
    this.internal.y = resultY * RadiansToDegrees;
    this.internal.z = resultZ * RadiansToDegrees;
  }
  private setValueVector(value: Vector3Definition): void {
    this.internal.x = value.x;
    this.internal.y = value.y;
    this.internal.z = value.z;
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
  private addSelfVector3(value: Vector3Definition): void {
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
  private subtractSelfVector3(value: Vector3Definition): void {
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

  public static zero(): EulerVector3 { return new EulerVector3(0, 0, 0); }
}

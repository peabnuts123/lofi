import { Observable } from "@lofi/core/util/observable";

import type { IReadonlyVector2, Vector2, Vector2Like } from "./Vector2";

export type AnyVector = Vector3 | Vector2;
export type AnyReadonlyVector = IReadonlyVector3 | IReadonlyVector2;
export type AnyVectorLike = Vector2Like | Vector3Like;

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface IReadonlyVector3 {
  add(value: AnyVectorLike): Vector3;
  subtract(value: AnyVectorLike): Vector3;
  scale(scalar: number): Vector3;
  length(): number;
  lengthSquared(): number;
  normalize(): Vector3;
  cross(other: Vector3Like): Vector3;
  dot(other: Vector3Like): number;
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
  public readonly buffer: Float64Array = new Float64Array(Vector3InternalBuffer.BufferSize);
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
  public setValue(value: Vector3Like): this;
  public setValue(valueOrX: Vector3Like | number, maybeY?: number, maybeZ?: number): this {
    let valueChanged: boolean;
    if (typeof valueOrX === 'number') {
      valueChanged = this.setValueXYZ(valueOrX, maybeY as number, maybeZ as number);
    } else {
      valueChanged = this.setValueVector(valueOrX);
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
  private subtractSelfVector3(value: Vector3Like): void {
    this.internal.x -= value.x;
    this.internal.y -= value.y;
    this.internal.z -= value.z;
  }
  public subtract(value: AnyVectorLike): Vector3 {
    return this.clone().subtractSelf(value);
  }

  public scaleSelf(scalar: number): this;
  public scaleSelf(other: Vector3Like): this;
  public scaleSelf(operand: number | Vector3Like): this {
    if (typeof operand === 'number') {
      return this.scaleSelfNumber(operand);
    } else {
      return this.scaleSelfVector(operand);
    }
  }
  private scaleSelfNumber(scalar: number): this {
    this.internal.x *= scalar;
    this.internal.y *= scalar;
    this.internal.z *= scalar;
    this.notifyOnChange();
    return this;
  }
  private scaleSelfVector(other: Vector3Like): this {
    this.internal.x *= other.x;
    this.internal.y *= other.y;
    this.internal.z *= other.z;
    this.notifyOnChange();
    return this;
  }

  public scale(scalar: number): Vector3;
  public scale(other: Vector3): Vector3;
  public scale(operand: number | Vector3): Vector3 {
    // @NOTE TypeScript is too dumb to figure this one out
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.clone().scaleSelf(operand as any);
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

  public crossSelf(other: Vector3Like): this {
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
  public cross(other: Vector3Like): Vector3 {
    return this.clone().crossSelf(other);
  }

  public dot(other: Vector3Like): number {
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

  public static zero(): Vector3 { return new Vector3(0, 0, 0); }
  public static one(): Vector3 { return new Vector3(1, 1, 1); }

  public static up(): Vector3 { return new Vector3(0, 0, 1); }
  public static down(): Vector3 { return new Vector3(0, 0, -1); }
  public static right(): Vector3 { return new Vector3(1, 0, 0); }
  public static left(): Vector3 { return new Vector3(-1, 0, 0); }
  public static forward(): Vector3 { return new Vector3(0, 1, 0); }
  public static back(): Vector3 { return new Vector3(0, -1, 0); }
}

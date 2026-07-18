import { Observable } from "@lofi/core/util/Observable";

export interface Vector2Like {
  x: number;
  y: number;
}

export interface IReadonlyVector2 {
  add(value: Vector2Like): Vector2;
  subtract(value: Vector2Like): Vector2;
  scale(scalar: number): Vector2;
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
  public readonly buffer: Float64Array = new Float64Array(Vector2InternalBuffer.BufferSize);
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
    let valueChanged: boolean;
    if (typeof valueOrX === 'number') {
      valueChanged = this.setValueXY(valueOrX, maybeY as number);
    } else {
      valueChanged = this.setValueVector(valueOrX);
    }
    if (valueChanged) {
      this.notifyOnChange();
    }
    return this;
  }
  private setValueXY(x: number, y: number): boolean {
    if (this.internal.x === x && this.internal.y === y) {
      // @NOTE Write is not changing the value
      return false;
    }
    this.internal.x = x;
    this.internal.y = y;
    return true;
  }
  private setValueVector(vector: Vector2Like): boolean {
    if (this.internal.x === vector.x && this.internal.y === vector.y) {
      // @NOTE Write is not changing the value
      return false;
    }
    this.internal.x = vector.x;
    this.internal.y = vector.y;
    return true;
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

  public scaleSelf(scalar: number): this;
  public scaleSelf(other: Vector2Like): this;
  public scaleSelf(operand: number | Vector2Like): this {
    if (typeof operand === 'number') {
      return this.scaleSelfNumber(operand);
    } else {
      return this.scaleSelfVector(operand);
    }
  }
  private scaleSelfNumber(scalar: number): this {
    this.internal.x *= scalar;
    this.internal.y *= scalar;
    this.notifyOnChange();
    return this;
  }
  private scaleSelfVector(other: Vector2Like): this {
    this.internal.x *= other.x;
    this.internal.y *= other.y;
    this.notifyOnChange();
    return this;
  }

  public scale(scalar: number): Vector2;
  public scale(other: Vector2): Vector2;
  public scale(operand: number | Vector2): Vector2 {
    // @NOTE TypeScript is too dumb to figure this one out
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.clone().scaleSelf(operand as any);
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
    return this.scale(1 / length);
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

  public static zero(): Vector2 { return new Vector2(0, 0); }
  public static one(): Vector2 { return new Vector2(1, 1); }

  public static up(): Vector2 { return new Vector2(0, 1); }
  public static down(): Vector2 { return new Vector2(0, -1); }
  public static right(): Vector2 { return new Vector2(1, 0); }
  public static left(): Vector2 { return new Vector2(-1, 0); }
}

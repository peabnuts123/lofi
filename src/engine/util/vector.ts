import { betterModulus } from "./math";
import { Matrix4 } from "./Matrix4";
import { Quaternion } from "./quaternion";

type AnyVector = Vector3;

// @TODO Rename to `Vector3Like`
export interface Vector3Definition {
  x: number;
  y: number;
  z: number;
}
export interface Vector2Like {
  x: number;
  y: number;
}

export class Vector2 {
  protected _x: number;
  protected _y: number;

  public constructor(x: number, y: number) {
    this._x = x;
    this._y = y;
  }

  public setValue(x: number, y: number): this;
  public setValue(value: Vector2Like): this;
  public setValue(valueOrX: Vector2Like | number, maybeY: boolean | number = true): this {
    if (typeof valueOrX === 'number' && typeof maybeY === 'number') {
      this.x = valueOrX;
      this.y = maybeY;
    } else if (typeof valueOrX === 'object') {
      this.x = valueOrX.x;
      this.y = valueOrX.y;
    } else {
      throw new Error(`Unrecognised arguments to 'setValue()'`);
    }
    return this;
  }

  public addSelf(value: Vector2): this {
    this.x += value.x;
    this.y += value.y;
    return this;
  }
  public add(value: Vector2): Vector2 {
    return new Vector2(
      this.x + value.x,
      this.y + value.y,
    );
  }

  public subtractSelf(value: Vector2): this {
    this.x -= value.x;
    this.y -= value.y;
    return this;
  }
  public subtract(value: Vector2): Vector2 {
    return new Vector2(
      this.x - value.x,
      this.y - value.y,
    );
  }

  public multiplySelf(factor: number): this;
  public multiplySelf(other: Vector2): this;
  public multiplySelf(operand: number | Vector2): this {
    if (operand instanceof Vector2) {
      return this.multiplyVector2Self(operand);
    } else {
      return this.multiplyNumberSelf(operand);
    }
  }
  private multiplyVector2Self(other: Vector2): this {
    this.x *= other.x;
    this.y *= other.y;
    return this;
  }
  private multiplyNumberSelf(factor: number): this {
    this.x *= factor;
    this.y *= factor;
    return this;
  }


  public multiply(factor: number): Vector2;
  public multiply(other: Vector2): Vector2;
  public multiply(operand: number | Vector2): Vector2 {
    if (operand instanceof Vector2) {
      return this.multiplyVector2(operand);
    } else {
      return this.multiplyNumber(operand);
    }
  }
  private multiplyVector2(other: Vector2): Vector2 {
    return new Vector2(
      this.x * other.x,
      this.y * other.y,
    );
  }
  private multiplyNumber(factor: number): Vector2 {
    return new Vector2(
      this.x * factor,
      this.y * factor,
    );
  }

  public divideSelf(factor: number): this;
  public divideSelf(other: Vector2): this;
  public divideSelf(operand: number | Vector2): this {
    if (operand instanceof Vector2) {
      if (operand.x === 0 || operand.y === 0) {
        throw new Error(`Cannot divide Vector2 by 0: ${operand}`);
      }
      this.x /= operand.x;
      this.y /= operand.y;
    } else {
      if (operand === 0) {
        throw new Error(`Cannot divide Vector2 by 0`);
      }
      this.x /= operand;
      this.y /= operand;
    }
    return this;
  }
  public divide(factor: number): Vector2;
  public divide(other: Vector2): Vector2;
  public divide(operand: number | Vector2): Vector2 {
    if (operand instanceof Vector2) {
      if (operand.x === 0 || operand.y === 0) {
        throw new Error(`Cannot divide Vector2 by 0: ${operand}`);
      }
      return new Vector2(
        this.x / operand.x,
        this.y / operand.y,
      );
    } else {
      if (operand === 0) {
        throw new Error(`Cannot divide Vector2 by 0`);
      }
      return new Vector2(
        this.x / operand,
        this.y / operand,
      );
    }
  }

  public length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  public lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  public normalizeSelf(): this {
    const length = this.length();
    if (length === 0) {
      this.x = this.y = 0;
    } else {
      this.x /= length;
      this.y /= length;
    }
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
    this.x = x;
    this.y = y;
    return this;
  }
  public perpendicular(): Vector2 {
    return new Vector2(
      this.y,
      -this.x,
    );
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

  public withX(value: number): Vector2 {
    return new Vector2(value, this.y);
  }

  public withY(value: number): Vector2 {
    return new Vector2(this.x, value);
  }


  public toString(): string {
    return `Vector2(${this.x}, ${this.y})`;
  }

  public get x(): number { return this._x; }
  public set x(value: number) { this._x = value; }

  public get y(): number { return this._y; }
  public set y(value: number) { this._y = value; }

  public static zero(): Vector2 { return new Vector2(0, 0); }
  public static one(): Vector2 { return new Vector2(1, 1); }

  public static up(): Vector2 { return new Vector2(0, 1); }
  public static down(): Vector2 { return new Vector2(0, -1); }
  public static right(): Vector2 { return new Vector2(1, 0); }
  public static left(): Vector2 { return new Vector2(-1, 0); }
}
export class Vector3 {
  protected _x: number;
  protected _y: number;
  protected _z: number;

  public constructor(x: number, y: number, z: number) {
    this._x = x;
    this._y = y;
    this._z = z;
  }

  public setValue(x: number, y: number, z: number): this;
  public setValue(value: Vector3Definition): this;
  public setValue(valueOrX: Vector3Definition | number, maybeY: boolean | number = true, maybeZ?: number): this {
    /* Wow sorry for this completely cursed method signature */
    if (typeof valueOrX === 'number' && typeof maybeY === 'number' && typeof maybeZ === 'number') {
      this.x = valueOrX;
      this.y = maybeY;
      this.z = maybeZ;
    } else if (typeof valueOrX === 'object') {
      this.x = valueOrX.x;
      this.y = valueOrX.y;
      this.z = valueOrX.z;
    } else {
      throw new Error(`Unrecognised arguments to 'setValue()'`);
    }
    return this;
  }

  public addSelf(value: AnyVector): this {
    this.x += value.x;
    this.y += value.y;
    if ('z' in value) {
      this.z += value.z;
    }
    return this;
  }
  public add(value: AnyVector): Vector3 {
    let zValue = 0;
    if ('z' in value) {
      zValue = value.z;
    }
    return new Vector3(
      this.x + value.x,
      this.y + value.y,
      this.z + zValue,
    );
  }

  public subtractSelf(value: AnyVector): this {
    this.x -= value.x;
    this.y -= value.y;
    if ('z' in value) {
      this.z -= value.z;
    }
    return this;
  }
  public subtract(value: AnyVector): Vector3 {
    let zValue = 0;
    if ('z' in value) {
      zValue = value.z;
    }
    return new Vector3(
      this.x - value.x,
      this.y - value.y,
      this.z - zValue,
    );
  }

  public multiplySelf(factor: number): this;
  public multiplySelf(other: Vector3): this;
  public multiplySelf(quaternion: Quaternion): this;
  public multiplySelf(matrix: Matrix4): this;
  public multiplySelf(operand: number | Vector3 | Quaternion | Matrix4): this {
    if (operand instanceof Vector3) {
      return this.multiplyVector3Self(operand);
    } else if (operand instanceof Quaternion) {
      return this.multiplyQuaternionSelf(operand);
    } else if (operand instanceof Matrix4) {
      return this.multiplyMatrix4Self(operand);
    } else {
      return this.multiplyNumberSelf(operand);
    }
  }
  private multiplyVector3Self(other: Vector3): this {
    this.x *= other.x;
    this.y *= other.y;
    this.z *= other.z;
    return this;
  }
  private multiplyQuaternionSelf(quat: Quaternion): this {
    // Fast Vector Rotation using Quaternions by Robert Eisele
    // https://raw.org/proof/vector-rotation-using-quaternions/
    const { x, y, z } = this;

    // t = q x v
    let tx = quat.y * z - quat.z * y;
    let ty = quat.z * x - quat.x * z;
    let tz = quat.x * y - quat.y * x;

    // t = 2t
    tx = tx + tx;
    ty = ty + ty;
    tz = tz + tz;

    // v + w t + q x t
    this.y = y + quat.w * ty + quat.z * tx - quat.x * tz;
    this.x = x + quat.w * tx + quat.y * tz - quat.z * ty;
    this.z = z + quat.w * tz + quat.x * ty - quat.y * tx;
    return this;
  }
  private multiplyMatrix4Self(matrix: Matrix4): this {
    const { x, y, z } = this;
    const w = matrix["m03"] * this.x + matrix["m13"] * this.y + matrix["m23"] * this.z + matrix["m33"] || 1.0;
    this.x = (matrix["m00"] * x + matrix["m10"] * y + matrix["m20"] * z + matrix["m30"]) / w;
    this.y = (matrix["m01"] * x + matrix["m11"] * y + matrix["m21"] * z + matrix["m31"]) / w;
    this.z = (matrix["m02"] * x + matrix["m12"] * y + matrix["m22"] * z + matrix["m32"]) / w;
    return this;
  }
  private multiplyNumberSelf(factor: number): this {
    this.x *= factor;
    this.y *= factor;
    this.z *= factor;
    return this;
  }


  public multiply(factor: number): Vector3;
  public multiply(other: Vector3): Vector3;
  public multiply(quaternion: Quaternion): Vector3;
  public multiply(matrix: Matrix4): Vector3;
  public multiply(operand: number | Vector3 | Quaternion | Matrix4): Vector3 {
    if (operand instanceof Vector3) {
      return this.multiplyVector3(operand);
    } else if (operand instanceof Quaternion) {
      return this.multiplyQuaternion(operand);
    } else if (operand instanceof Matrix4) {
      return this.multiplyMatrix4(operand);
    } else {
      return this.multiplyNumber(operand);
    }
  }
  private multiplyVector3(other: Vector3): Vector3 {
    return new Vector3(
      this.x * other.x,
      this.y * other.y,
      this.z * other.z,
    );
  }
  private multiplyQuaternion(quat: Quaternion): Vector3 {
    // Fast Vector Rotation using Quaternions by Robert Eisele
    // https://raw.org/proof/vector-rotation-using-quaternions/

    // t = q x v
    let tx = quat.y * this.z - quat.z * this.y;
    let ty = quat.z * this.x - quat.x * this.z;
    let tz = quat.x * this.y - quat.y * this.x;

    // t = 2t
    tx = tx + tx;
    ty = ty + ty;
    tz = tz + tz;

    // v + w t + q x t
    return new Vector3(
      this.y + quat.w * ty + quat.z * tx - quat.x * tz,
      this.x + quat.w * tx + quat.y * tz - quat.z * ty,
      this.z + quat.w * tz + quat.x * ty - quat.y * tx,
    );
  }
  private multiplyMatrix4(matrix: Matrix4): Vector3 {
    const w = matrix["m03"] * this.x + matrix["m13"] * this.y + matrix["m23"] * this.z + matrix["m33"] || 1.0;
    return new Vector3(
      (matrix["m00"] * this.x + matrix["m10"] * this.y + matrix["m20"] * this.z + matrix["m30"]) / w,
      (matrix["m01"] * this.x + matrix["m11"] * this.y + matrix["m21"] * this.z + matrix["m31"]) / w,
      (matrix["m02"] * this.x + matrix["m12"] * this.y + matrix["m22"] * this.z + matrix["m32"]) / w,
    );
  }
  private multiplyNumber(factor: number): Vector3 {
    return new Vector3(
      this.x * factor,
      this.y * factor,
      this.z * factor,
    );
  }

  public divideSelf(factor: number): this;
  public divideSelf(other: Vector3): this;
  public divideSelf(operand: number | Vector3): this {
    if (operand instanceof Vector3) {
      if (operand.x === 0 || operand.y === 0 || operand.z === 0) {
        throw new Error(`Cannot divide Vector3 by 0: ${operand}`);
      }
      this.x /= operand.x;
      this.y /= operand.y;
      this.z /= operand.z;
    } else {
      if (operand === 0) {
        throw new Error(`Cannot divide Vector3 by 0`);
      }
      this.x /= operand;
      this.y /= operand;
      this.z /= operand;
    }
    return this;
  }
  public divide(factor: number): Vector3;
  public divide(other: Vector3): Vector3;
  public divide(operand: number | Vector3): Vector3 {
    if (operand instanceof Vector3) {
      if (operand.x === 0 || operand.y === 0 || operand.z === 0) {
        throw new Error(`Cannot divide Vector3 by 0: ${operand}`);
      }
      return new Vector3(
        this.x / operand.x,
        this.y / operand.y,
        this.z / operand.z,
      );
    } else {
      if (operand === 0) {
        throw new Error(`Cannot divide Vector3 by 0`);
      }
      return new Vector3(
        this.x / operand,
        this.y / operand,
        this.z / operand,
      );
    }
  }

  public length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  public lengthSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  public normalizeSelf(): this {
    const length = this.length();
    if (length === 0) {
      this.x = this.y = this.z = 0;
    } else {
      this.x /= length;
      this.y /= length;
      this.z /= length;
    }
    return this;
  }
  public normalize(): Vector3 {
    const length = this.length();
    if (length === 0) {
      return Vector3.zero();
    }
    return this.divide(length);
  }

  public crossSelf(other: Vector3): this {
    const x = this.y * other.z - this.z * other.y;
    const y = this.z * other.x - this.x * other.z;
    const z = this.x * other.y - this.y * other.x;
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  public cross(other: Vector3): Vector3 {
    return new Vector3(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x,
    );
  }

  public dot(other: Vector3): number {
    /*
      @NOTE
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

  public withX(value: number): Vector3 {
    return new Vector3(value, this.y, this.z);
  }

  public withY(value: number): Vector3 {
    return new Vector3(this.x, value, this.z);
  }

  public withZ(value: number): Vector3 {
    return new Vector3(this.x, this.y, value);
  }

  public toString(): string {
    return `Vector3(${this.x}, ${this.y}, ${this.z})`;
  }

  public get x(): number { return this._x; }
  public set x(value: number) { this._x = value; }

  public get y(): number { return this._y; }
  public set y(value: number) { this._y = value; }

  public get z(): number { return this._z; }
  public set z(value: number) { this._z = value; }

  public static zero(): Vector3 { return new Vector3(0, 0, 0); }
  public static one(): Vector3 { return new Vector3(1, 1, 1); }

  public static up(): Vector3 { return new Vector3(0, 1, 0); }
  public static down(): Vector3 { return new Vector3(0, -1, 0); }
  public static right(): Vector3 { return new Vector3(1, 0, 0); }
  public static left(): Vector3 { return new Vector3(-1, 0, 0); }
  public static forward(): Vector3 { return new Vector3(0, 0, 1); }
  public static back(): Vector3 { return new Vector3(0, 0, -1); }
}

/**
 * A Vector3 with a callback that is fired whenever
 * its value changes.
 */
export class ObservedVector3 extends Vector3 {
  private isOnChangeSuspended: boolean = false;
  protected onChange: () => void;

  public constructor(x: number, y: number, z: number, onChange: () => void) {
    super(x, y, z);
    this.onChange = () => {
      if (!this.isOnChangeSuspended) {
        onChange();
      }
    };
  }

  private mutate<TResult>(notify: boolean, mutator: () => TResult): TResult {
    this.isOnChangeSuspended = true;
    const result = mutator();
    this.isOnChangeSuspended = false;
    if (notify) {
      this.onChange();
    }
    return result;
  }

  // =============
  // Optimised versions of functions to only call `onChange()` once.
  // =============
  public override setValue(x: number, y: number, z: number, notify?: boolean): this;
  public override setValue(value: Vector3Definition, notify?: boolean): this;
  public override setValue(valueOrX: Vector3Definition | number, notifyOrY: boolean | number = true, maybeZ?: number, maybeNotify: boolean = true): this {
    /* Wow sorry for this completely cursed method signature */
    if (typeof valueOrX === 'number' && typeof notifyOrY === 'number' && typeof maybeZ === 'number' && typeof maybeNotify === 'boolean') {
      return this.mutate(maybeNotify, () =>
        super.setValue(valueOrX, notifyOrY, maybeZ),
      );
    } else if (typeof valueOrX === 'object' && typeof notifyOrY === 'boolean') {
      return this.mutate(notifyOrY, () =>
        super.setValue(valueOrX),
      );
    } else {
      throw new Error(`Unrecognised arguments to 'setValue()'`);
    }
  }
  public override addSelf(value: AnyVector, notify: boolean = true): this {
    return this.mutate(notify, () =>
      super.addSelf(value),
    );
  }
  public override subtractSelf(value: AnyVector, notify: boolean = true): this {
    return this.mutate(notify, () =>
      super.subtractSelf(value),
    );
  }
  public override multiplySelf(factor: number, notify?: boolean): this;
  public override multiplySelf(other: Vector3, notify?: boolean): this;
  public override multiplySelf(quaternion: Quaternion, notify?: boolean): this;
  public override multiplySelf(matrix: Matrix4, notify?: boolean): this;
  public override multiplySelf(operand: number | Vector3 | Quaternion | Matrix4, notify: boolean = true): this {
    return this.mutate(notify, () => {
      // TypeScript why are you like this
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      return super.multiplySelf(operand);
    });
  }
  public override divideSelf(factor: number, notify?: boolean): this;
  public override divideSelf(other: Vector3, notify?: boolean): this;
  public override divideSelf(operand: number | Vector3, notify: boolean = true): this {
    return this.mutate(notify, () => {
      // TypeScript why are you like this
      if (operand instanceof Vector3) {
        return super.divideSelf(operand);
      } else {
        return super.divideSelf(operand);
      }
    });
  }
  public override normalizeSelf(notify: boolean = true): this {
    return this.mutate(notify, () =>
      super.normalizeSelf(),
    );
  }
  public override crossSelf(other: Vector3, notify: boolean = true): this {
    return this.mutate(notify, () =>
      super.crossSelf(other),
    );
  }

  public override get x(): number { return super.x; }
  public override set x(value: number) {
    super.x = value;
    this.onChange();
  }
  public override get y(): number { return super.y; }
  public override set y(value: number) {
    super.y = value;
    this.onChange();
  }
  public override get z(): number { return super.z; }
  public override set z(value: number) {
    super.z = value;
    this.onChange();
  }
}

/**
 * An ObservedVector3 that also has a `dirty` flag that refreshes
 * its value from an external source any time its dirty
 * flag is set.
 */
export class DirtyVector3 extends ObservedVector3 {
  private isDirty: () => boolean;
  private refreshValue: () => void;

  public constructor(
    x: number,
    y: number,
    z: number,
    isDirty: () => boolean,
    refreshValue: () => void,
    onChange: () => void,
  ) {
    super(x, y, z, onChange);
    this.isDirty = isDirty;
    this.refreshValue = refreshValue;
  }

  public get x(): number {
    if (this.isDirty()) {
      this.refreshValue();
    }
    return super.x;
  }
  public set x(value: number) { super.x = value; }

  public get y(): number {
    if (this.isDirty()) {
      this.refreshValue();
    }
    return super.y;
  }
  public set y(value: number) { super.y = value; }

  public get z(): number {
    if (this.isDirty()) {
      this.refreshValue();
    }
    return super.z;
  }
  public set z(value: number) { super.z = value; }
}

/**
 * A Vector3 specifically for expressing Euler rotation angles,
 * where all xyz components are always wrapped between 0 and 360.
 */
export class EulerVector3 extends DirtyVector3 {
  public constructor(
    x: number,
    y: number,
    z: number,
    isDirty: () => boolean,
    refreshValue: () => void,
    onChange: () => void,
  ) {
    super(x, y, z, isDirty, refreshValue, onChange);
    this._x = betterModulus(x, 360);
    this._y = betterModulus(y, 360);
    this._z = betterModulus(z, 360);
  }

  public override get x(): number { return super.x; }
  public override set x(value: number) {
    super.x = betterModulus(value, 360);
  }

  public override get y(): number { return super.y; }
  public override set y(value: number) {
    super.y = betterModulus(value, 360);
  }

  public override get z(): number { return super.z; }
  public override set z(value: number) {
    super.z = betterModulus(value, 360);
  }
}

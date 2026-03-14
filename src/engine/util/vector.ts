import { betterModulus } from "./math";
import { Matrix4 } from "./Matrix4";
import { PlainObservable } from "./observable";
import { Quaternion } from "./quaternion";

type AnyVector = Vector3 | Vector2;

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

export class Vector2 extends PlainObservable {
  // @NOTE Raw values encapsulated in annoying object type to prevent
  // accidental direct access. Always use `this.{x,y}` getters/setters,
  // so that possible subclasses etc. always pick up correct side effects.
  private readonly internal: {
    x: number;
    y: number;
  };

  public constructor(x: number, y: number) {
    super();
    this.internal = { x, y };
  }

  public setValue(x: number, y: number): this;
  public setValue(value: Vector2Like): this;
  public setValue(valueOrX: Vector2Like | number, maybeY: boolean | number = true): this {
    this.mutate(() => {
      if (typeof valueOrX === 'number' && typeof maybeY === 'number') {
        this.x = valueOrX;
        this.y = maybeY;
      } else if (typeof valueOrX === 'object') {
        this.x = valueOrX.x;
        this.y = valueOrX.y;
      } else {
        throw new Error(`Unrecognised arguments to 'setValue()'`);
      }
    });
    return this;
  }

  public addSelf(value: Vector2): this {
    this.mutate(() => {
      this.x += value.x;
      this.y += value.y;
    });
    return this;
  }
  public add(value: Vector2): Vector2 {
    return this.clone().addSelf(value);
  }

  public subtractSelf(value: Vector2): this {
    this.mutate(() => {
      this.x -= value.x;
      this.y -= value.y;
    });
    return this;
  }
  public subtract(value: Vector2): Vector2 {
    return this.clone().subtractSelf(value);
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
    this.mutate(() => {
      this.x *= other.x;
      this.y *= other.y;
    });
    return this;
  }
  private multiplyNumberSelf(factor: number): this {
    this.mutate(() => {
      this.x *= factor;
      this.y *= factor;
    });
    return this;
  }


  public multiply(factor: number): Vector2;
  public multiply(other: Vector2): Vector2;
  public multiply(operand: number | Vector2): Vector2 {
    if (operand instanceof Vector2) {
      return this.clone().multiplySelf(operand);
    } else {
      return this.clone().multiplySelf(operand);
    }
  }

  public divideSelf(factor: number): this;
  public divideSelf(other: Vector2): this;
  public divideSelf(operand: number | Vector2): this {
    if (operand instanceof Vector2) {
      if (operand.x === 0 || operand.y === 0) {
        throw new Error(`Cannot divide Vector2 by 0: ${operand}`);
      }
      this.mutate(() => {
        this.x /= operand.x;
        this.y /= operand.y;
      });
    } else {
      if (operand === 0) {
        throw new Error(`Cannot divide Vector2 by 0`);
      }
      this.mutate(() => {
        this.x /= operand;
        this.y /= operand;
      });
    }
    return this;
  }
  public divide(factor: number): Vector2;
  public divide(other: Vector2): Vector2;
  public divide(operand: number | Vector2): Vector2 {
    if (operand instanceof Vector2) {
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

  public normalizeSelf(): this {
    const length = this.length();
    if (length === 0) {
      this.mutate(() => {
        this.x = this.y = 0;
      });
    } else {
      this.mutate(() => {
        this.x /= length;
        this.y /= length;
      });
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
    this.mutate(() => {
      const x = this.y;
      const y = -this.x;
      this.x = x;
      this.y = y;
    });
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

  public withX(value: number): this {
    this.x = value;
    return this;
  }

  public withY(value: number): this {
    this.y = value;
    return this;
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

export class Vector3 extends PlainObservable {
  // @NOTE Raw values encapsulated in annoying object type to prevent
  // accidental direct access. Always use `this.{x,y,z}` getters/setters,
  // so that possible subclasses etc. always pick up correct side effects.
  private readonly internal: {
    x: number;
    y: number;
    z: number;
  };

  public constructor(x: number, y: number, z: number) {
    super();
    this.internal = { x, y, z };
  }

  public setValue(x: number, y: number, z: number): this;
  public setValue(value: Vector3Definition): this;
  public setValue(valueOrX: Vector3Definition | number, maybeY: boolean | number = true, maybeZ?: number): this {
    /* Wow sorry for this completely cursed method signature */
    if (typeof valueOrX === 'number' && typeof maybeY === 'number' && typeof maybeZ === 'number') {
      this.mutate(() => {
        this.x = valueOrX;
        this.y = maybeY;
        this.z = maybeZ;
      });
    } else if (typeof valueOrX === 'object') {
      this.mutate(() => {
        this.x = valueOrX.x;
        this.y = valueOrX.y;
        this.z = valueOrX.z;
      });
    } else {
      throw new Error(`Unrecognised arguments to 'setValue()'`);
    }

    return this;
  }

  public addSelf(value: AnyVector): this {
    this.mutate(() => {
      this.x += value.x;
      this.y += value.y;
      if ('z' in value) {
        this.z += value.z;
      }
    });
    return this;
  }
  public add(value: AnyVector): Vector3 {
    return this.clone().addSelf(value);
  }

  public subtractSelf(value: AnyVector): this {
    this.mutate(() => {
      this.x -= value.x;
      this.y -= value.y;
      if ('z' in value) {
        this.z -= value.z;
      }
    });
    return this;
  }
  public subtract(value: AnyVector): Vector3 {
    return this.clone().subtractSelf(value);
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
    this.mutate(() => {
      this.x *= other.x;
      this.y *= other.y;
      this.z *= other.z;
    });
    return this;
  }
  private multiplyQuaternionSelf(quat: Quaternion): this {
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
    this.mutate(() => {
      this.x = x + quat.w * tx + quat.y * tz - quat.z * ty;
      this.y = y + quat.w * ty + quat.z * tx - quat.x * tz;
      this.z = z + quat.w * tz + quat.x * ty - quat.y * tx;
    });

    return this;
  }
  private multiplyMatrix4Self(matrix: Matrix4): this {
    const { x, y, z } = this;
    const w = matrix["m30"] * this.x + matrix["m31"] * this.y + matrix["m32"] * this.z + matrix["m33"] || 1.0;
    this.mutate(() => {
      this.x = (matrix["m00"] * x + matrix["m01"] * y + matrix["m02"] * z + matrix["m03"]) / w;
      this.y = (matrix["m10"] * x + matrix["m11"] * y + matrix["m12"] * z + matrix["m13"]) / w;
      this.z = (matrix["m20"] * x + matrix["m21"] * y + matrix["m22"] * z + matrix["m23"]) / w;
    });
    return this;
  }
  private multiplyNumberSelf(factor: number): this {
    this.mutate(() => {
      this.x *= factor;
      this.y *= factor;
      this.z *= factor;
    });
    return this;
  }

  public multiply(factor: number): Vector3;
  public multiply(other: Vector3): Vector3;
  public multiply(quaternion: Quaternion): Vector3;
  public multiply(matrix: Matrix4): Vector3;
  public multiply(operand: number | Vector3 | Quaternion | Matrix4): Vector3 {
    if (operand instanceof Vector3) {
      return this.clone().multiplySelf(operand);
    } else if (operand instanceof Quaternion) {
      return this.clone().multiplySelf(operand);
    } else if (operand instanceof Matrix4) {
      return this.clone().multiplySelf(operand);
    } else {
      return this.clone().multiplySelf(operand);
    }
  }

  public divideSelf(factor: number): this;
  public divideSelf(other: Vector3): this;
  public divideSelf(operand: number | Vector3): this {
    if (operand instanceof Vector3) {
      if (operand.x === 0 || operand.y === 0 || operand.z === 0) {
        throw new Error(`Cannot divide Vector3 by 0: ${operand}`);
      }
      this.mutate(() => {
        this.x /= operand.x;
        this.y /= operand.y;
        this.z /= operand.z;
      });
    } else {
      if (operand === 0) {
        throw new Error(`Cannot divide Vector3 by 0`);
      }
      this.mutate(() => {
        this.x /= operand;
        this.y /= operand;
        this.z /= operand;
      });
    }
    return this;
  }
  public divide(factor: number): Vector3;
  public divide(other: Vector3): Vector3;
  public divide(operand: number | Vector3): Vector3 {
    if (operand instanceof Vector3) {
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
    this.mutate(() => {
      this.x /= length;
      this.y /= length;
      this.z /= length;
    });
    return this;
  }
  public normalize(): Vector3 {
    return this.clone().normalizeSelf();
  }

  public crossSelf(other: Vector3): this {
    this.mutate(() => {
      // @NOTE Intermediate values used
      const x = this.y * other.z - this.z * other.y;
      const y = this.z * other.x - this.x * other.z;
      const z = this.x * other.y - this.y * other.x;
      this.x = x;
      this.y = y;
      this.z = z;
    });
    return this;
  }
  public cross(other: Vector3): Vector3 {
    return this.clone().crossSelf(other);
  }

  public dot(other: Vector3): number {
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

  public withX(value: number): this {
    this.x = value;
    return this;
  }

  public withY(value: number): this {
    this.y = value;
    return this;
  }

  public withZ(value: number): this {
    this.z = value;
    return this;
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

  public static up(): Vector3 { return new Vector3(0, 1, 0); }
  public static down(): Vector3 { return new Vector3(0, -1, 0); }
  public static right(): Vector3 { return new Vector3(1, 0, 0); }
  public static left(): Vector3 { return new Vector3(-1, 0, 0); }
  public static forward(): Vector3 { return new Vector3(0, 0, -1); }
  public static back(): Vector3 { return new Vector3(0, 0, 1); }
}

/**
 * A Vector3 specifically for expressing Euler rotation angles,
 * where all xyz components are always wrapped between 0 and 360.
 */
export class EulerVector3 extends Vector3 {
  public constructor(
    x: number,
    y: number,
    z: number,
  ) {
    super(
      betterModulus(x, 360),
      betterModulus(y, 360),
      betterModulus(z, 360),
    );
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

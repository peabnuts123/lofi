import { DegreesToRadians, RadiansToDegrees } from "./math";
import { PlainObservable } from "./observable";
import { EulerVector3, Vector3 } from "./vector";

export class Quaternion extends PlainObservable {
  // @NOTE Raw values encapsulated in annoying object type to prevent
  // accidental direct access. Always use `this.{x,y,z,w}` getters/setters,
  // so that possible subclasses etc. always pick up correct side effects.
  private readonly internal: {
    x: number;
    y: number;
    z: number;
    w: number;
  };

  public constructor(x: number, y: number, z: number, w: number) {
    super();
    this.internal = { x, y, z, w };
  }

  /**
   * Convert the quaternion to Euler angles (in degrees).
   */
  public toEuler(): EulerVector3 {
    // From: https://github.com/BabylonJS/Babylon.js/blob/86bda66b6f61e482374c1a0597f1f504cd75837d/packages/dev/core/src/Maths/math.vector.ts#L5217
    const result = new EulerVector3(0, 0, 0);

    const qz = this.z;
    const qx = this.x;
    const qy = this.y;
    const qw = this.w;

    const zAxisY = qy * qz - qx * qw;
    const limit = 0.4999999;

    if (zAxisY < -limit) {
      result.y = 2 * Math.atan2(qy, qw);
      result.x = Math.PI / 2;
      result.z = 0;
    } else if (zAxisY > limit) {
      result.y = 2 * Math.atan2(qy, qw);
      result.x = -Math.PI / 2;
      result.z = 0;
    } else {
      const sqw = qw * qw;
      const sqz = qz * qz;
      const sqx = qx * qx;
      const sqy = qy * qy;
      result.z = Math.atan2(2.0 * (qx * qy + qz * qw), -sqz - sqx + sqy + sqw);
      result.x = Math.asin(-2.0 * zAxisY);
      result.y = Math.atan2(2.0 * (qz * qx + qy * qw), sqz - sqx - sqy + sqw);
    }

    // Convert to degrees
    result.x *= RadiansToDegrees;
    result.y *= RadiansToDegrees;
    result.z *= RadiansToDegrees;

    return result;
  }

  public multiplySelf(q: Quaternion): this {
    this.mutate(() => {
      const { x, y, z, w } = this;
      this.x = w * q.x + x * q.w + y * q.z - z * q.y;
      this.y = w * q.y - x * q.z + y * q.w + z * q.x;
      this.z = w * q.z + x * q.y - y * q.x + z * q.w;
      this.w = w * q.w - x * q.x - y * q.y - z * q.z;
    });
    return this;
  }
  public multiply(q: Quaternion): Quaternion {
    return this.clone().multiplySelf(q);
  }

  public slerpSelf(right: Quaternion, t: number): this {
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

    this.mutate(() => {
      this.x = num3 * this.x + num2 * right.x;
      this.y = num3 * this.y + num2 * right.y;
      this.z = num3 * this.z + num2 * right.z;
      this.w = num3 * this.w + num2 * right.w;
    });
    return this;
  }

  public slerp(right: Quaternion, t: number): Quaternion {
    return this.clone().slerpSelf(right, t);
  }

  public invertSelf(): this {
    this.mutate(() => {
      this.x = -this.x;
      this.y = -this.y;
      this.z = -this.z;
      // @NOTE w remains unchanged.
    });
    return this;
  }
  public invert(): Quaternion {
    return this.clone().invertSelf();
  }

  public normalizeSelf(): this {
    const n = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
    if (n === 0) {
      this.mutate(() => {
        this.x = this.y = this.z = 0;
        this.w = 1;
      });
    } else {
      this.mutate(() => {
        this.x /= n;
        this.y /= n;
        this.z /= n;
        this.w /= n;
      });
    }
    return this;
  }
  public normalize(): Quaternion {
    return this.clone().normalizeSelf();
  }

  public setValue(x: number, y: number, z: number, w: number): this;
  public setValue(value: Quaternion): this;
  public setValue(xOrValue: number | Quaternion, maybeY?: number, maybeZ?: number, maybeW?: number): this {
    /* Wow sorry for this completely cursed method signature */
    if (typeof xOrValue === 'number' && typeof maybeY === 'number' && typeof maybeZ === 'number' && typeof maybeW === 'number') {
      this.mutate(() => {
        this.x = xOrValue;
        this.y = maybeY;
        this.z = maybeZ;
        this.w = maybeW;
      });
    } else if (typeof xOrValue === 'object') {
      this.mutate(() => {
        this.x = xOrValue.x;
        this.y = xOrValue.y;
        this.z = xOrValue.z;
        this.w = xOrValue.w;
      });
    } else {
      throw new Error(`Unrecognised arguments to 'setValue()'`);
    }
    return this;
  }

  public clone(): Quaternion {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }

  public toString(): string {
    return `Quaternion(x=${this.x}, y=${this.y}, z=${this.z}, w=${this.w})`;
  }

  /**
   * Create a quaternion that represents no rotation.
   */
  public static identity(): Quaternion {
    return new Quaternion(0, 0, 0, 1);
  }

  /**
   * Creates a quaternion from an axis and angle (in degrees).
   * @param axis The axis of rotation.
   * @param angle The angle in degrees.
   */
  public static fromAxisAngle(axis: Vector3, angle: number): Quaternion {
    const halfAngle = angle * DegreesToRadians * 0.5;
    const s = Math.sin(halfAngle);
    axis = axis.normalize();
    return new Quaternion(
      axis.x * s,
      axis.y * s,
      axis.z * s,
      Math.cos(halfAngle),
    );
  }

  /**
   * Creates a quaternion from Euler angles (in degrees).
   * @param x Rotation around X axis in degrees.
   * @param y Rotation around Y axis in degrees.
   * @param z Rotation around Z axis in degrees.
   */
  public static fromEuler(vector: Vector3): Quaternion;
  public static fromEuler(x: number, y: number, z: number): Quaternion;
  public static fromEuler(xOrVector: number | Vector3, y?: number, z?: number): Quaternion {
    // From: https://github.com/BabylonJS/Babylon.js/blob/86bda66b6f61e482374c1a0597f1f504cd75837d/packages/dev/core/src/Maths/math.vector.ts#L5650
    let xValue: number;
    let yValue: number;
    let zValue: number;
    if (xOrVector instanceof Vector3) {
      xValue = xOrVector.x * DegreesToRadians;
      yValue = xOrVector.y * DegreesToRadians;
      zValue = xOrVector.z * DegreesToRadians;
    } else {
      xValue = xOrVector * DegreesToRadians;
      yValue = y! * DegreesToRadians;
      zValue = z! * DegreesToRadians;
    }

    const halfRoll = zValue * 0.5;
    const halfPitch = xValue * 0.5;
    const halfYaw = yValue * 0.5;
    const sinRoll = Math.sin(halfRoll);
    const cosRoll = Math.cos(halfRoll);
    const sinPitch = Math.sin(halfPitch);
    const cosPitch = Math.cos(halfPitch);
    const sinYaw = Math.sin(halfYaw);
    const cosYaw = Math.cos(halfYaw);

    return new Quaternion(
      cosYaw * sinPitch * cosRoll + sinYaw * cosPitch * sinRoll,
      sinYaw * cosPitch * cosRoll - cosYaw * sinPitch * sinRoll,
      cosYaw * cosPitch * sinRoll - sinYaw * sinPitch * cosRoll,
      cosYaw * cosPitch * cosRoll + sinYaw * sinPitch * sinRoll,
    );
  }

  public static fromLookDirection(forward: Vector3, up: Vector3): Quaternion {
    // Validate
    if (Math.abs(forward.dot(up)) > 1e-8) {
      throw new Error(`Cannot create Quaternion from look direction - 'forward' and 'up' vectors must be orthogonal. (DEBUG: (dot='${forward.dot(up)}')) Provided: (forward='${forward}') (up='${up}')`);
    }
    // Sanitise
    if (!forward.isNormalized()) {
      forward = forward.normalize();
    }
    if (!up.isNormalized()) {
      up = up.normalize();
    }

    const right = up.cross(forward);

    // Mostly from: https://github.com/BabylonJS/Babylon.js/blob/86bda66b6f61e482374c1a0597f1f504cd75837d/packages/dev/core/src/Maths/math.vector.ts#L5335
    const trace = right.x + up.y + forward.z;

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      return new Quaternion(
        (up.z - forward.y) * s,
        (forward.x - right.z) * s,
        (right.y - up.x) * s,
        0.25 / s,
      );
    } else if (right.x > up.y && right.x > forward.z) {
      const s = 2.0 * Math.sqrt(1.0 + right.x - up.y - forward.z);
      return new Quaternion(
        0.25 * s,
        (up.x + right.y) / s,
        (forward.x + right.z) / s,
        (up.z - forward.y) / s,
      );
    } else if (up.y > forward.z) {
      const s = 2.0 * Math.sqrt(1.0 + up.y - right.x - forward.z);
      return new Quaternion(
        (up.x + right.y) / s,
        0.25 * s,
        (forward.y + up.z) / s,
        (forward.x - right.z) / s,
      );
    } else {
      const s = 2.0 * Math.sqrt(1.0 + forward.z - right.x - up.y);
      return new Quaternion(
        (forward.x + right.z) / s,
        (forward.y + up.z) / s,
        0.25 * s,
        (right.y - up.x) / s,
      );
    }
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

  public get w(): number { return this.internal.w; }
  public set w(value: number) {
    this.internal.w = value;
    this.notifyOnChange();
  }
}


// @TODO throw errors instead of logging warnings?
export class ReadOnlyQuaternion extends Quaternion {
  /**
   * Escape hatch to replace the value in a read-only quaternion, if you
   * really need to.
   * @param self ReadOnlyQuaternion to replace.
   * @param value The value to place into the ReadOnlyQuaternion instance.
   */
  public static replace(self: ReadOnlyQuaternion, value: Quaternion): void {
    // @NOTE Call mutable Quaternion definition to allow modification
    Quaternion.prototype['mutate'].call(self, () => {
      self['internal'].x = value.x;
      self['internal'].y = value.y;
      self['internal'].z = value.z;
      self['internal'].w = value.w;
    });
  }

  protected override mutate(_mutator: () => void): void {
    console.warn(`(mutate) Cannot modify read-only Quaternion`);
  }

  public override get x(): number { return super.x; }
  public override set x(_: number) {
    console.warn(`(set x) Cannot modify read-only Quaternion`);
  }
  public override get y(): number { return super.y; }
  public override set y(_: number) {
    console.warn(`(set y) Cannot modify read-only Quaternion`);
  }
  public override get z(): number { return super.z; }
  public override set z(_: number) {
    console.warn(`(set z) Cannot modify read-only Quaternion`);
  }
  public override get w(): number { return super.w; }
  public override set w(_: number) {
    console.warn(`(set w) Cannot modify read-only Quaternion`);
  }
}

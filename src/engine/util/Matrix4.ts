import type { Quaternion } from "./quaternion";
import type { Vector3 } from "./vector";

export class Matrix4 {
  public m00: number;
  public m01: number;
  public m02: number;
  public m03: number;
  public m10: number;
  public m11: number;
  public m12: number;
  public m13: number;
  public m20: number;
  public m21: number;
  public m22: number;
  public m23: number;
  public m30: number;
  public m31: number;
  public m32: number;
  public m33: number;

  public constructor() {
    // @NOTE Initialise to identity matrix
    this.m00 = 1;
    this.m01 = 0;
    this.m02 = 0;
    this.m03 = 0;
    this.m10 = 0;
    this.m11 = 1;
    this.m12 = 0;
    this.m13 = 0;
    this.m20 = 0;
    this.m21 = 0;
    this.m22 = 1;
    this.m23 = 0;
    this.m30 = 0;
    this.m31 = 0;
    this.m32 = 0;
    this.m33 = 1;
  }

  public clone(): Matrix4 {
    const result = new Matrix4();
    result.m00 = this.m00;
    result.m01 = this.m01;
    result.m02 = this.m02;
    result.m03 = this.m03;
    result.m10 = this.m10;
    result.m11 = this.m11;
    result.m12 = this.m12;
    result.m13 = this.m13;
    result.m20 = this.m20;
    result.m21 = this.m21;
    result.m22 = this.m22;
    result.m23 = this.m23;
    result.m30 = this.m30;
    result.m31 = this.m31;
    result.m32 = this.m32;
    result.m33 = this.m33;
    return result;
  }

  public setValue(value: Matrix4): this {
    this.m00 = value.m00;
    this.m01 = value.m01;
    this.m02 = value.m02;
    this.m03 = value.m03;
    this.m10 = value.m10;
    this.m11 = value.m11;
    this.m12 = value.m12;
    this.m13 = value.m13;
    this.m20 = value.m20;
    this.m21 = value.m21;
    this.m22 = value.m22;
    this.m23 = value.m23;
    this.m30 = value.m30;
    this.m31 = value.m31;
    this.m32 = value.m32;
    this.m33 = value.m33;
    return this;
  }

  public multiplySelf(b: Matrix4): this {
    return this.__multiplySelf(this, b);
  }
  public multiply(matrix: Matrix4): Matrix4 {
    const result = this.clone();
    return result.multiply(matrix);
  }

  public reverseMultiplySelf(b: Matrix4): this {
    return this.__multiplySelf(b, this);
  }
  public reverseMultiply(b: Matrix4): Matrix4 {
    const result = this.clone();
    return result.reverseMultiplySelf(b);
  }

  private __multiplySelf(a: Matrix4, b: Matrix4): this {
    const a00 = a.m00, a01 = a.m01, a02 = a.m02, a03 = a.m03,
      a10 = a.m10, a11 = a.m11, a12 = a.m12, a13 = a.m13,
      a20 = a.m20, a21 = a.m21, a22 = a.m22, a23 = a.m23,
      a30 = a.m30, a31 = a.m31, a32 = a.m32, a33 = a.m33;
    const b00 = b.m00, b01 = b.m01, b02 = b.m02, b03 = b.m03,
      b10 = b.m10, b11 = b.m11, b12 = b.m12, b13 = b.m13,
      b20 = b.m20, b21 = b.m21, b22 = b.m22, b23 = b.m23,
      b30 = b.m30, b31 = b.m31, b32 = b.m32, b33 = b.m33;

    this.m00 = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
    this.m01 = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
    this.m02 = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
    this.m03 = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;
    this.m10 = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
    this.m11 = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
    this.m12 = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
    this.m13 = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;
    this.m20 = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
    this.m21 = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
    this.m22 = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
    this.m23 = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;
    this.m30 = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
    this.m31 = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
    this.m32 = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
    this.m33 = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;
    return this;
  }

  public invertSelf(): this {
    const a00 = this.m00, a01 = this.m01, a02 = this.m02, a03 = this.m03,
      a10 = this.m10, a11 = this.m11, a12 = this.m12, a13 = this.m13,
      a20 = this.m20, a21 = this.m21, a22 = this.m22, a23 = this.m23,
      a30 = this.m30, a31 = this.m31, a32 = this.m32, a33 = this.m33;
    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    // Calculate the determinant
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) {
      throw new Error("Matrix4: Can't invert matrix, determinant is 0");
    }
    det = 1.0 / det;
    this.m00 = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    this.m01 = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    this.m02 = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    this.m03 = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    this.m10 = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    this.m11 = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    this.m12 = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    this.m13 = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    this.m20 = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    this.m21 = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    this.m22 = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    this.m23 = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    this.m30 = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    this.m31 = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    this.m32 = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    this.m33 = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return this;
  }
  public invert(): Matrix4 {
    const result = this.clone();
    return result.invertSelf();
  }

  public perspectiveSelf(fovy: number, aspect: number, near: number, far: number): this {
    const f = 1.0 / Math.tan(fovy / 2);
    this.m00 = f / aspect;
    this.m01 = 0;
    this.m02 = 0;
    this.m03 = 0;
    this.m10 = 0;
    this.m11 = f;
    this.m12 = 0;
    this.m13 = 0;
    this.m20 = 0;
    this.m21 = 0;
    this.m23 = -1;
    this.m30 = 0;
    this.m31 = 0;
    this.m33 = 0;
    if (far != null && far !== Infinity) {
      const nf = 1 / (near - far);
      this.m22 = (far + near) * nf;
      this.m32 = 2 * far * near * nf;
    } else {
      this.m22 = -1;
      this.m32 = -2 * near;
    }
    return this;
  }
  public static perspective(fovy: number, aspect: number, near: number, far: number): Matrix4 {
    const result = new Matrix4();
    return result.perspectiveSelf(fovy, aspect, near, far);
  }

  public fromRotationTranslationScaleSelf(q: Quaternion, v: Vector3, s: Vector3): this {
    const x2 = q.x + q.x;
    const y2 = q.y + q.y;
    const z2 = q.z + q.z;
    const xx = q.x * x2;
    const xy = q.x * y2;
    const xz = q.x * z2;
    const yy = q.y * y2;
    const yz = q.y * z2;
    const zz = q.z * z2;
    const wx = q.w * x2;
    const wy = q.w * y2;
    const wz = q.w * z2;
    this.m00 = (1 - (yy + zz)) * s.x;
    this.m01 = (xy + wz) * s.x;
    this.m02 = (xz - wy) * s.x;
    this.m03 = 0;
    this.m10 = (xy - wz) * s.y;
    this.m11 = (1 - (xx + zz)) * s.y;
    this.m12 = (yz + wx) * s.y;
    this.m13 = 0;
    this.m20 = (xz + wy) * s.z;
    this.m21 = (yz - wx) * s.z;
    this.m22 = (1 - (xx + yy)) * s.z;
    this.m23 = 0;
    this.m30 = v.x;
    this.m31 = v.y;
    this.m32 = v.z;
    this.m33 = 1;
    return this;
  }
  public static fromRotationTranslationScale(q: Quaternion, v: Vector3, s: Vector3): Matrix4 {
    const result = new Matrix4();
    return result.fromRotationTranslationScaleSelf(q, v, s);
  }

  public toArray(): Float32Array {
    return new Float32Array([
      this.m00, this.m01, this.m02, this.m03,
      this.m10, this.m11, this.m12, this.m13,
      this.m20, this.m21, this.m22, this.m23,
      this.m30, this.m31, this.m32, this.m33,
    ]);
  }
}

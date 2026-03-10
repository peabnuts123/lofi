import type { TypedArray } from "@gltf-transform/core";
import type { Quaternion } from "./quaternion";
import type { Vector3 } from "./vector";
import { CannotInvertMatrixError } from "./Matrix3";


export type Matrix4InitialValues = [
  m00: number, m10: number, m20: number, m30: number,
  m01: number, m11: number, m21: number, m31: number,
  m02: number, m12: number, m22: number, m32: number,
  m03: number, m13: number, m23: number, m33: number,
];

/**
 * A 4x4 matrix. Values are stored in column-major order.
 */
export class Matrix4 {
  public m00: number;
  public m10: number;
  public m20: number;
  public m30: number;
  public m01: number;
  public m11: number;
  public m21: number;
  public m31: number;
  public m02: number;
  public m12: number;
  public m22: number;
  public m32: number;
  public m03: number;
  public m13: number;
  public m23: number;
  public m33: number;

  public constructor(initialValues?: Matrix4InitialValues | TypedArray) {
    if (initialValues) {
      this.m00 = initialValues[0];
      this.m10 = initialValues[1];
      this.m20 = initialValues[2];
      this.m30 = initialValues[3];
      this.m01 = initialValues[4];
      this.m11 = initialValues[5];
      this.m21 = initialValues[6];
      this.m31 = initialValues[7];
      this.m02 = initialValues[8];
      this.m12 = initialValues[9];
      this.m22 = initialValues[10];
      this.m32 = initialValues[11];
      this.m03 = initialValues[12];
      this.m13 = initialValues[13];
      this.m23 = initialValues[14];
      this.m33 = initialValues[15];
    } else {
      // @NOTE Initialise to identity matrix
      this.m00 = 1;
      this.m10 = 0;
      this.m20 = 0;
      this.m30 = 0;
      this.m01 = 0;
      this.m11 = 1;
      this.m21 = 0;
      this.m31 = 0;
      this.m02 = 0;
      this.m12 = 0;
      this.m22 = 1;
      this.m32 = 0;
      this.m03 = 0;
      this.m13 = 0;
      this.m23 = 0;
      this.m33 = 1;
    }
  }

  public clone(): Matrix4 {
    const result = new Matrix4();
    result.m00 = this.m00;
    result.m10 = this.m10;
    result.m20 = this.m20;
    result.m30 = this.m30;
    result.m01 = this.m01;
    result.m11 = this.m11;
    result.m21 = this.m21;
    result.m31 = this.m31;
    result.m02 = this.m02;
    result.m12 = this.m12;
    result.m22 = this.m22;
    result.m32 = this.m32;
    result.m03 = this.m03;
    result.m13 = this.m13;
    result.m23 = this.m23;
    result.m33 = this.m33;
    return result;
  }

  public setValue(value: Matrix4): this {
    this.m00 = value.m00;
    this.m10 = value.m10;
    this.m20 = value.m20;
    this.m30 = value.m30;
    this.m01 = value.m01;
    this.m11 = value.m11;
    this.m21 = value.m21;
    this.m31 = value.m31;
    this.m02 = value.m02;
    this.m12 = value.m12;
    this.m22 = value.m22;
    this.m32 = value.m32;
    this.m03 = value.m03;
    this.m13 = value.m13;
    this.m23 = value.m23;
    this.m33 = value.m33;
    return this;
  }

  public multiplySelf(b: Matrix4): this {
    return this.__multiplySelf(this, b);
  }
  public multiply(matrix: Matrix4): Matrix4 {
    return this.clone().multiplySelf(matrix);
  }

  public reverseMultiplySelf(b: Matrix4): this {
    return this.__multiplySelf(b, this);
  }
  public reverseMultiply(b: Matrix4): Matrix4 {
    return this.clone().reverseMultiplySelf(b);
  }

  private __multiplySelf(a: Matrix4, b: Matrix4): this {
    const a00 = a.m00, a10 = a.m10, a20 = a.m20, a30 = a.m30,
      a01 = a.m01, a11 = a.m11, a21 = a.m21, a31 = a.m31,
      a02 = a.m02, a12 = a.m12, a22 = a.m22, a32 = a.m32,
      a03 = a.m03, a13 = a.m13, a23 = a.m23, a33 = a.m33;
    const b00 = b.m00, b10 = b.m10, b20 = b.m20, b30 = b.m30,
      b01 = b.m01, b11 = b.m11, b21 = b.m21, b31 = b.m31,
      b02 = b.m02, b12 = b.m12, b22 = b.m22, b32 = b.m32,
      b03 = b.m03, b13 = b.m13, b23 = b.m23, b33 = b.m33;

    this.m00 = b00 * a00 + b10 * a01 + b20 * a02 + b30 * a03;
    this.m10 = b00 * a10 + b10 * a11 + b20 * a12 + b30 * a13;
    this.m20 = b00 * a20 + b10 * a21 + b20 * a22 + b30 * a23;
    this.m30 = b00 * a30 + b10 * a31 + b20 * a32 + b30 * a33;
    this.m01 = b01 * a00 + b11 * a01 + b21 * a02 + b31 * a03;
    this.m11 = b01 * a10 + b11 * a11 + b21 * a12 + b31 * a13;
    this.m21 = b01 * a20 + b11 * a21 + b21 * a22 + b31 * a23;
    this.m31 = b01 * a30 + b11 * a31 + b21 * a32 + b31 * a33;
    this.m02 = b02 * a00 + b12 * a01 + b22 * a02 + b32 * a03;
    this.m12 = b02 * a10 + b12 * a11 + b22 * a12 + b32 * a13;
    this.m22 = b02 * a20 + b12 * a21 + b22 * a22 + b32 * a23;
    this.m32 = b02 * a30 + b12 * a31 + b22 * a32 + b32 * a33;
    this.m03 = b03 * a00 + b13 * a01 + b23 * a02 + b33 * a03;
    this.m13 = b03 * a10 + b13 * a11 + b23 * a12 + b33 * a13;
    this.m23 = b03 * a20 + b13 * a21 + b23 * a22 + b33 * a23;
    this.m33 = b03 * a30 + b13 * a31 + b23 * a32 + b33 * a33;
    return this;
  }

  public invertSelf(): this {
    const a00 = this.m00, a10 = this.m10, a20 = this.m20, a30 = this.m30,
      a01 = this.m01, a11 = this.m11, a21 = this.m21, a31 = this.m31,
      a02 = this.m02, a12 = this.m12, a22 = this.m22, a32 = this.m32,
      a03 = this.m03, a13 = this.m13, a23 = this.m23, a33 = this.m33;
    const b00 = a00 * a11 - a10 * a01;
    const b01 = a00 * a21 - a20 * a01;
    const b02 = a00 * a31 - a30 * a01;
    const b03 = a10 * a21 - a20 * a11;
    const b04 = a10 * a31 - a30 * a11;
    const b05 = a20 * a31 - a30 * a21;
    const b06 = a02 * a13 - a12 * a03;
    const b07 = a02 * a23 - a22 * a03;
    const b08 = a02 * a33 - a32 * a03;
    const b09 = a12 * a23 - a22 * a13;
    const b10 = a12 * a33 - a32 * a13;
    const b11 = a22 * a33 - a32 * a23;

    // Calculate the determinant
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) {
      throw new CannotInvertMatrixError("Matrix4: Can't invert matrix, determinant is 0");
    }
    det = 1.0 / det;
    this.m00 = (a11 * b11 - a21 * b10 + a31 * b09) * det;
    this.m10 = (a20 * b10 - a10 * b11 - a30 * b09) * det;
    this.m20 = (a13 * b05 - a23 * b04 + a33 * b03) * det;
    this.m30 = (a22 * b04 - a12 * b05 - a32 * b03) * det;
    this.m01 = (a21 * b08 - a01 * b11 - a31 * b07) * det;
    this.m11 = (a00 * b11 - a20 * b08 + a30 * b07) * det;
    this.m21 = (a23 * b02 - a03 * b05 - a33 * b01) * det;
    this.m31 = (a02 * b05 - a22 * b02 + a32 * b01) * det;
    this.m02 = (a01 * b10 - a11 * b08 + a31 * b06) * det;
    this.m12 = (a10 * b08 - a00 * b10 - a30 * b06) * det;
    this.m22 = (a03 * b04 - a13 * b02 + a33 * b00) * det;
    this.m32 = (a12 * b02 - a02 * b04 - a32 * b00) * det;
    this.m03 = (a11 * b07 - a01 * b09 - a21 * b06) * det;
    this.m13 = (a00 * b09 - a10 * b07 + a20 * b06) * det;
    this.m23 = (a13 * b01 - a03 * b03 - a23 * b00) * det;
    this.m33 = (a02 * b03 - a12 * b01 + a22 * b00) * det;
    return this;
  }
  public invert(): Matrix4 {
    return this.clone().invertSelf();
  }

  public perspectiveSelf(fovy: number, aspect: number, near: number, far: number): this {
    const f = 1.0 / Math.tan(fovy / 2);
    this.m00 = f / aspect;
    this.m10 = 0;
    this.m20 = 0;
    this.m30 = 0;
    this.m01 = 0;
    this.m11 = f;
    this.m21 = 0;
    this.m31 = 0;
    this.m02 = 0;
    this.m12 = 0;
    this.m32 = -1;
    this.m03 = 0;
    this.m13 = 0;
    this.m33 = 0;
    if (far != null && far !== Infinity) {
      const nf = 1 / (near - far);
      this.m22 = (far + near) * nf;
      this.m23 = 2 * far * near * nf;
    } else {
      this.m22 = -1;
      this.m23 = -2 * near;
    }
    return this;
  }
  public static perspective(fovy: number, aspect: number, near: number, far: number): Matrix4 {
    return new Matrix4().perspectiveSelf(fovy, aspect, near, far);
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
    this.m10 = (xy + wz) * s.x;
    this.m20 = (xz - wy) * s.x;
    this.m30 = 0;
    this.m01 = (xy - wz) * s.y;
    this.m11 = (1 - (xx + zz)) * s.y;
    this.m21 = (yz + wx) * s.y;
    this.m31 = 0;
    this.m02 = (xz + wy) * s.z;
    this.m12 = (yz - wx) * s.z;
    this.m22 = (1 - (xx + yy)) * s.z;
    this.m32 = 0;
    this.m03 = v.x;
    this.m13 = v.y;
    this.m23 = v.z;
    this.m33 = 1;
    return this;
  }
  public static fromRotationTranslationScale(q: Quaternion, v: Vector3, s: Vector3): Matrix4 {
    return new Matrix4().fromRotationTranslationScaleSelf(q, v, s);
  }

  public toArray(): Float32Array {
    return new Float32Array([
      this.m00, this.m10, this.m20, this.m30,
      this.m01, this.m11, this.m21, this.m31,
      this.m02, this.m12, this.m22, this.m32,
      this.m03, this.m13, this.m23, this.m33,
    ]);
  }

  public prettyPrint(dp: number = 2, message: string = ""): void {
    console.log(message,
    /*  */ `${this.m00.toFixed(dp)} ${this.m01.toFixed(dp)} ${this.m02.toFixed(dp)} ${this.m03.toFixed(dp)}\n`
    /**/ + `${this.m10.toFixed(dp)} ${this.m11.toFixed(dp)} ${this.m12.toFixed(dp)} ${this.m13.toFixed(dp)}\n`
    /**/ + `${this.m20.toFixed(dp)} ${this.m21.toFixed(dp)} ${this.m22.toFixed(dp)} ${this.m23.toFixed(dp)}\n`
    /**/ + `${this.m30.toFixed(dp)} ${this.m31.toFixed(dp)} ${this.m32.toFixed(dp)} ${this.m33.toFixed(dp)}\n`);
  }
}

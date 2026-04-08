
import type { TypedArray } from "@lofi/core/util/types";

import type { Matrix4 } from "./Matrix4";

export type Matrix3InitialValues = [
  m00: number, m10: number, m20: number,
  m01: number, m11: number, m21: number,
  m02: number, m12: number, m22: number,
];

/**
 * A 3x3 matrix. Values are stored in column-major order.
 */
export class Matrix3 {
  public m00: number;
  public m10: number;
  public m20: number;
  public m01: number;
  public m11: number;
  public m21: number;
  public m02: number;
  public m12: number;
  public m22: number;

  public constructor(initialValues?: Matrix3InitialValues | TypedArray) {
    if (initialValues) {
      this.m00 = initialValues[0];
      this.m10 = initialValues[1];
      this.m20 = initialValues[2];
      this.m01 = initialValues[3];
      this.m11 = initialValues[4];
      this.m21 = initialValues[5];
      this.m02 = initialValues[6];
      this.m12 = initialValues[7];
      this.m22 = initialValues[8];
    } else {
      // @NOTE Initialise to identity matrix
      this.m00 = 1;
      this.m10 = 0;
      this.m20 = 0;
      this.m01 = 0;
      this.m11 = 1;
      this.m21 = 0;
      this.m02 = 0;
      this.m12 = 0;
      this.m22 = 1;
    }
  }

  public clone(): Matrix3 {
    const result = new Matrix3();
    result.m00 = this.m00;
    result.m10 = this.m10;
    result.m20 = this.m20;
    result.m01 = this.m01;
    result.m11 = this.m11;
    result.m21 = this.m21;
    result.m02 = this.m02;
    result.m12 = this.m12;
    result.m22 = this.m22;
    return result;
  }

  public setValue(value: Matrix3): this {
    this.m00 = value.m00;
    this.m10 = value.m10;
    this.m20 = value.m20;
    this.m01 = value.m01;
    this.m11 = value.m11;
    this.m21 = value.m21;
    this.m02 = value.m02;
    this.m12 = value.m12;
    this.m22 = value.m22;
    return this;
  }

  public normalSelf(matrix: Matrix4): this {
    const a00 = matrix.m00, a10 = matrix.m10, a20 = matrix.m20, a03 = matrix.m03,
      a01 = matrix.m01, a11 = matrix.m11, a21 = matrix.m21, a13 = matrix.m13,
      a02 = matrix.m02, a12 = matrix.m12, a22 = matrix.m22, a23 = matrix.m23,
      a30 = matrix.m30, a31 = matrix.m31, a32 = matrix.m32, a33 = matrix.m33;
    const b00 = a00 * a11 - a10 * a01;
    const b01 = a00 * a21 - a20 * a01;
    const b02 = a00 * a13 - a03 * a01;
    const b03 = a10 * a21 - a20 * a11;
    const b04 = a10 * a13 - a03 * a11;
    const b05 = a20 * a13 - a03 * a21;
    const b06 = a02 * a31 - a12 * a30;
    const b07 = a02 * a32 - a22 * a30;
    const b08 = a02 * a33 - a23 * a30;
    const b09 = a12 * a32 - a22 * a31;
    const b10 = a12 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    // Calculate the determinant
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) {
      throw new CannotInvertMatrixError("Matrix3: Can't invert matrix, determinant is 0");
    }
    det = 1.0 / det;
    this.m00 = (a11 * b11 - a21 * b10 + a13 * b09) * det;
    this.m10 = (a21 * b08 - a01 * b11 - a13 * b07) * det;
    this.m20 = (a01 * b10 - a11 * b08 + a13 * b06) * det;
    this.m01 = (a20 * b10 - a10 * b11 - a03 * b09) * det;
    this.m11 = (a00 * b11 - a20 * b08 + a03 * b07) * det;
    this.m21 = (a10 * b08 - a00 * b10 - a03 * b06) * det;
    this.m02 = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    this.m12 = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    this.m22 = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    return this;
  }
  public static normal(matrix: Matrix4): Matrix3 {
    return new Matrix3().normalSelf(matrix);
  }

  public toArray(): Float32Array {
    return new Float32Array([
      this.m00, this.m10, this.m20,
      this.m01, this.m11, this.m21,
      this.m02, this.m12, this.m22,
    ]);
  }

  public prettyPrint(dp: number = 2): void {
    console.log(
    /*  */ `${this.m00.toFixed(dp)} ${this.m01.toFixed(dp)} ${this.m02.toFixed(dp)}\n`
    /**/ + `${this.m10.toFixed(dp)} ${this.m11.toFixed(dp)} ${this.m12.toFixed(dp)}\n`
    /**/ + `${this.m20.toFixed(dp)} ${this.m21.toFixed(dp)} ${this.m22.toFixed(dp)}\n`);
  }
}

export class CannotInvertMatrixError extends Error {
}

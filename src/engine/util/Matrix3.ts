import type { Matrix4 } from "./Matrix4";

export class Matrix3 {
  public m00: number;
  public m01: number;
  public m02: number;
  public m10: number;
  public m11: number;
  public m12: number;
  public m20: number;
  public m21: number;
  public m22: number;

  public constructor() {
    // @NOTE Initialise to identity matrix
    this.m00 = 1;
    this.m01 = 0;
    this.m02 = 0;
    this.m10 = 0;
    this.m11 = 1;
    this.m12 = 0;
    this.m20 = 0;
    this.m21 = 0;
    this.m22 = 1;
  }

  public clone(): Matrix3 {
    const result = new Matrix3();
    result.m00 = this.m00;
    result.m01 = this.m01;
    result.m02 = this.m02;
    result.m10 = this.m10;
    result.m11 = this.m11;
    result.m12 = this.m12;
    result.m20 = this.m20;
    result.m21 = this.m21;
    result.m22 = this.m22;
    return result;
  }

  public setValue(value: Matrix3): this {
    this.m00 = value.m00;
    this.m01 = value.m01;
    this.m02 = value.m02;
    this.m10 = value.m10;
    this.m11 = value.m11;
    this.m12 = value.m12;
    this.m20 = value.m20;
    this.m21 = value.m21;
    this.m22 = value.m22;
    return this;
  }

  public normalSelf(matrix: Matrix4): this {
    const a00 = matrix.m00, a01 = matrix.m01, a02 = matrix.m02, a03 = matrix.m03,
      a10 = matrix.m10, a11 = matrix.m11, a12 = matrix.m12, a13 = matrix.m13,
      a20 = matrix.m20, a21 = matrix.m21, a22 = matrix.m22, a23 = matrix.m23,
      a30 = matrix.m30, a31 = matrix.m31, a32 = matrix.m32, a33 = matrix.m33;
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
      // return null;
      throw new Error("Matrix3: Can't invert matrix, determinant is 0");
    }
    det = 1.0 / det;
    this.m00 = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    this.m01 = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    this.m02 = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    this.m10 = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    this.m11 = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    this.m12 = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    this.m20 = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    this.m21 = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    this.m22 = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    return this;
  }
  public static normal(matrix: Matrix4): Matrix3 {
    const result = new Matrix3();
    return result.normalSelf(matrix);
  }

  public toArray(): Float32Array {
    return new Float32Array([
      this.m00, this.m01, this.m02,
      this.m10, this.m11, this.m12,
      this.m20, this.m21, this.m22,
    ]);
  }
}

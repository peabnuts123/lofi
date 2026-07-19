
import  type { TypedArray } from "@lopoly/core/util/types";

import { Matrix4 } from "./Matrix4";
import type { Vector3 } from "./Vector3";

export type Matrix3InitialValues = [
  m00: number, m10: number, m20: number,
  m01: number, m11: number, m21: number,
  m02: number, m12: number, m22: number,
];

class Matrix3InternalBuffer {
  public static readonly BufferSize: number = 9;
  public readonly buffer: Float64Array = new Float64Array(Matrix3InternalBuffer.BufferSize);
  public get m00(): number { return this.buffer[0]; }
  public set m00(value: number) { this.buffer[0] = value; }
  public get m10(): number { return this.buffer[1]; }
  public set m10(value: number) { this.buffer[1] = value; }
  public get m20(): number { return this.buffer[2]; }
  public set m20(value: number) { this.buffer[2] = value; }
  public get m01(): number { return this.buffer[3]; }
  public set m01(value: number) { this.buffer[3] = value; }
  public get m11(): number { return this.buffer[4]; }
  public set m11(value: number) { this.buffer[4] = value; }
  public get m21(): number { return this.buffer[5]; }
  public set m21(value: number) { this.buffer[5] = value; }
  public get m02(): number { return this.buffer[6]; }
  public set m02(value: number) { this.buffer[6] = value; }
  public get m12(): number { return this.buffer[7]; }
  public set m12(value: number) { this.buffer[7] = value; }
  public get m22(): number { return this.buffer[8]; }
  public set m22(value: number) { this.buffer[8] = value; }
}

/**
 * A 3x3 matrix. Values are stored in column-major order.
 * @TODO Make observable
 */
export class Matrix3 {
  private readonly internal: Matrix3InternalBuffer;

  public constructor(initialValues?: Matrix3InitialValues | TypedArray) {
    this.internal = new Matrix3InternalBuffer();
    if (initialValues) {
      for (let i = 0; i < Matrix3InternalBuffer.BufferSize; i++) {
        this.internal.buffer[i] = initialValues[i];
      }
    } else {
      // @NOTE Initialise to identity matrix
      // @TODO deprecate in favour of static method
      this.internal.m00 = 1;
      this.internal.m10 = 0;
      this.internal.m20 = 0;
      this.internal.m01 = 0;
      this.internal.m11 = 1;
      this.internal.m21 = 0;
      this.internal.m02 = 0;
      this.internal.m12 = 0;
      this.internal.m22 = 1;
    }
  }

  public clone(): Matrix3 {
    return new Matrix3(this.internal.buffer);
  }

  public setValue(value: Matrix3): this;
  public setValue(value: Matrix4): this;
  public setValue(value: Matrix3 | Matrix4): this {
    if (value instanceof Matrix4) {
      return this.setValueMatrix4(value);
    } else {
      return this.setValueMatrix3(value);
    }
  }
  private setValueMatrix3(value: Matrix3): this {
    for (let i = 0; i < 9; i++) {
      this.internal.buffer[i] = value.internal.buffer[i];
    }
    return this;
  }
  private setValueMatrix4(value: Matrix4): this {
    this.internal.m00 = value.m00;
    this.internal.m10 = value.m10;
    this.internal.m20 = value.m20;
    this.internal.m01 = value.m01;
    this.internal.m11 = value.m11;
    this.internal.m21 = value.m21;
    this.internal.m02 = value.m02;
    this.internal.m12 = value.m12;
    this.internal.m22 = value.m22;
    return this;
  }

  public scaleSelf(factor: number): this {
    for (let i = 0; i < Matrix3InternalBuffer.BufferSize; i++) {
      this.internal.buffer[i] *= factor;
    }
    // this.notifyOnChange(); // @TODO
    return this;
  }
  public scale(factor: number): Matrix3 {
    return this.clone().scaleSelf(factor);
  }

  public multiplySelf(other: Matrix3): this {
    const a00 = this.m00, a10 = this.m10, a20 = this.m20,
      a01 = this.m01, a11 = this.m11, a21 = this.m21,
      a02 = this.m02, a12 = this.m12, a22 = this.m22;
    const b00 = other.m00, b10 = other.m10, b20 = other.m20,
      b01 = other.m01, b11 = other.m11, b21 = other.m21,
      b02 = other.m02, b12 = other.m12, b22 = other.m22;

    this.internal.m00 = b00 * a00 + b10 * a01 + b20 * a02;
    this.internal.m10 = b00 * a10 + b10 * a11 + b20 * a12;
    this.internal.m20 = b00 * a20 + b10 * a21 + b20 * a22;
    this.internal.m01 = b01 * a00 + b11 * a01 + b21 * a02;
    this.internal.m11 = b01 * a10 + b11 * a11 + b21 * a12;
    this.internal.m21 = b01 * a20 + b11 * a21 + b21 * a22;
    this.internal.m02 = b02 * a00 + b12 * a01 + b22 * a02;
    this.internal.m12 = b02 * a10 + b12 * a11 + b22 * a12;
    this.internal.m22 = b02 * a20 + b12 * a21 + b22 * a22;
    // this.notifyOnChange(); // @TODO

    return this;
  }
  public multiply(other: Matrix3): Matrix3 {
    return this.clone().multiplySelf(other);
  }

  public multiplyVectorInPlace(vector: Vector3): Vector3 {
    const { x, y, z } = vector;
    return vector.setValue(
      this.m00 * x + this.m01 * y + this.m02 * z,
      this.m10 * x + this.m11 * y + this.m12 * z,
      this.m20 * x + this.m21 * y + this.m22 * z,
    );
  }
  public multiplyVector(vector: Vector3): Vector3 {
    return this.multiplyVectorInPlace(vector.clone());
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
    this.internal.m00 = (a11 * b11 - a21 * b10 + a13 * b09) * det;
    this.internal.m10 = (a21 * b08 - a01 * b11 - a13 * b07) * det;
    this.internal.m20 = (a01 * b10 - a11 * b08 + a13 * b06) * det;
    this.internal.m01 = (a20 * b10 - a10 * b11 - a03 * b09) * det;
    this.internal.m11 = (a00 * b11 - a20 * b08 + a03 * b07) * det;
    this.internal.m21 = (a10 * b08 - a00 * b10 - a03 * b06) * det;
    this.internal.m02 = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    this.internal.m12 = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    this.internal.m22 = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    return this;
  }
  public static normal(matrix: Matrix4): Matrix3 {
    return new Matrix3().normalSelf(matrix);
  }

  public identitySelf(): this {
    this.internal.m00 = 1;
    this.internal.m10 = 0;
    this.internal.m20 = 0;
    this.internal.m01 = 0;
    this.internal.m11 = 1;
    this.internal.m21 = 0;
    this.internal.m02 = 0;
    this.internal.m12 = 0;
    this.internal.m22 = 1;
    // this.notifyOnChange();
    return this;
  }
  public static identity(): Matrix3 {
    return new Matrix3().identitySelf();
  }

  public writeTo(target: Float32Array, offset: number = 0): void {
    target.set(this.internal.buffer, offset);
  }

  public prettyPrint(dp: number = 2): void {
    console.log(
    /*  */ `${this.m00.toFixed(dp)} ${this.m01.toFixed(dp)} ${this.m02.toFixed(dp)}\n`
    /**/ + `${this.m10.toFixed(dp)} ${this.m11.toFixed(dp)} ${this.m12.toFixed(dp)}\n`
    /**/ + `${this.m20.toFixed(dp)} ${this.m21.toFixed(dp)} ${this.m22.toFixed(dp)}\n`);
  }

  public get m00(): number { return this.internal.m00; }
  public set m00(value: number) { this.internal.m00 = value; }
  public get m10(): number { return this.internal.m10; }
  public set m10(value: number) { this.internal.m10 = value; }
  public get m20(): number { return this.internal.m20; }
  public set m20(value: number) { this.internal.m20 = value; }
  public get m01(): number { return this.internal.m01; }
  public set m01(value: number) { this.internal.m01 = value; }
  public get m11(): number { return this.internal.m11; }
  public set m11(value: number) { this.internal.m11 = value; }
  public get m21(): number { return this.internal.m21; }
  public set m21(value: number) { this.internal.m21 = value; }
  public get m02(): number { return this.internal.m02; }
  public set m02(value: number) { this.internal.m02 = value; }
  public get m12(): number { return this.internal.m12; }
  public set m12(value: number) { this.internal.m12 = value; }
  public get m22(): number { return this.internal.m22; }
  public set m22(value: number) { this.internal.m22 = value; }
}

export class CannotInvertMatrixError extends Error {
}

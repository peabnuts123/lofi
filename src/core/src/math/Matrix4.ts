import type { TypedArray } from "@lofi/core/util/types";

import type { Quaternion } from "./Quaternion";
import type { Vector3 } from "./vector";
import { CannotInvertMatrixError } from "./Matrix3";
import { Observable } from "../util";


export type Matrix4InitialValues = [
  m00: number, m10: number, m20: number, m30: number,
  m01: number, m11: number, m21: number, m31: number,
  m02: number, m12: number, m22: number, m32: number,
  m03: number, m13: number, m23: number, m33: number,
];

/**
 * A 4x4 matrix. Values are stored in column-major order.
 */
export class Matrix4 extends Observable {
  public _m00: number;
  public _m10: number;
  public _m20: number;
  public _m30: number;
  public _m01: number;
  public _m11: number;
  public _m21: number;
  public _m31: number;
  public _m02: number;
  public _m12: number;
  public _m22: number;
  public _m32: number;
  public _m03: number;
  public _m13: number;
  public _m23: number;
  public _m33: number;

  /**
   * Create a new instance of Matrix4. Will be initialised to an identity matrix
   * if no initial values are provided.
   */
  public constructor(initialValues?: Matrix4InitialValues | TypedArray) {
    super();
    if (initialValues) {
      this._m00 = initialValues[0];
      this._m10 = initialValues[1];
      this._m20 = initialValues[2];
      this._m30 = initialValues[3];
      this._m01 = initialValues[4];
      this._m11 = initialValues[5];
      this._m21 = initialValues[6];
      this._m31 = initialValues[7];
      this._m02 = initialValues[8];
      this._m12 = initialValues[9];
      this._m22 = initialValues[10];
      this._m32 = initialValues[11];
      this._m03 = initialValues[12];
      this._m13 = initialValues[13];
      this._m23 = initialValues[14];
      this._m33 = initialValues[15];
    } else {
      // @TODO probably should be a static method
      // @NOTE Initialise to identity matrix
      this._m00 = 1;
      this._m10 = 0;
      this._m20 = 0;
      this._m30 = 0;
      this._m01 = 0;
      this._m11 = 1;
      this._m21 = 0;
      this._m31 = 0;
      this._m02 = 0;
      this._m12 = 0;
      this._m22 = 1;
      this._m32 = 0;
      this._m03 = 0;
      this._m13 = 0;
      this._m23 = 0;
      this._m33 = 1;
    }
  }

  public clone(): Matrix4 {
    const result = new Matrix4();
    result.mutate(() => {
      result._m00 = this._m00;
      result._m10 = this._m10;
      result._m20 = this._m20;
      result._m30 = this._m30;
      result._m01 = this._m01;
      result._m11 = this._m11;
      result._m21 = this._m21;
      result._m31 = this._m31;
      result._m02 = this._m02;
      result._m12 = this._m12;
      result._m22 = this._m22;
      result._m32 = this._m32;
      result._m03 = this._m03;
      result._m13 = this._m13;
      result._m23 = this._m23;
      result._m33 = this._m33;
    });
    return result;
  }

  public setValue(value: Matrix4): this {
    this.mutate(() => {
      this._m00 = value.m00;
      this._m10 = value.m10;
      this._m20 = value.m20;
      this._m30 = value.m30;
      this._m01 = value.m01;
      this._m11 = value.m11;
      this._m21 = value.m21;
      this._m31 = value.m31;
      this._m02 = value.m02;
      this._m12 = value.m12;
      this._m22 = value.m22;
      this._m32 = value.m32;
      this._m03 = value.m03;
      this._m13 = value.m13;
      this._m23 = value.m23;
      this._m33 = value.m33;
    });
    return this;
  }

  public addSelf(other: Matrix4): this {
    this.mutate(() => {
      this._m00 += other._m00;
      this._m10 += other._m10;
      this._m20 += other._m20;
      this._m30 += other._m30;
      this._m01 += other._m01;
      this._m11 += other._m11;
      this._m21 += other._m21;
      this._m31 += other._m31;
      this._m02 += other._m02;
      this._m12 += other._m12;
      this._m22 += other._m22;
      this._m32 += other._m32;
      this._m03 += other._m03;
      this._m13 += other._m13;
      this._m23 += other._m23;
      this._m33 += other._m33;
    });
    return this;
  }
  public add(other: Matrix4): Matrix4 {
    return this.clone().addSelf(other);
  }

  public multiplySelf(factor: number): this;
  public multiplySelf(other: Matrix4): this;
  public multiplySelf(operand: number | Matrix4): this {
    if (typeof operand === 'number') {
      return this.multiplyNumberSelf(operand);
    } else {
      return this.__multiplyMatrixSelf(this, operand);
    }
  }
  private multiplyNumberSelf(factor: number): this {
    this.mutate(() => {
      this._m00 *= factor;
      this._m10 *= factor;
      this._m20 *= factor;
      this._m30 *= factor;
      this._m01 *= factor;
      this._m11 *= factor;
      this._m21 *= factor;
      this._m31 *= factor;
      this._m02 *= factor;
      this._m12 *= factor;
      this._m22 *= factor;
      this._m32 *= factor;
      this._m03 *= factor;
      this._m13 *= factor;
      this._m23 *= factor;
      this._m33 *= factor;
    });
    return this;
  }

  public multiply(factor: number): Matrix4;
  public multiply(other: Matrix4): Matrix4;
  public multiply(operand: number | Matrix4): Matrix4 {
    if (typeof operand === 'number') {
      return this.clone().multiplySelf(operand);
    } else {
      return this.clone().multiplySelf(operand);
    }
  }

  public reverseMultiplySelf(b: Matrix4): this {
    return this.__multiplyMatrixSelf(b, this);
  }
  public reverseMultiply(b: Matrix4): Matrix4 {
    return this.clone().reverseMultiplySelf(b);
  }

  private __multiplyMatrixSelf(a: Matrix4, b: Matrix4): this {
    const a00 = a.m00, a10 = a.m10, a20 = a.m20, a30 = a.m30,
      a01 = a.m01, a11 = a.m11, a21 = a.m21, a31 = a.m31,
      a02 = a.m02, a12 = a.m12, a22 = a.m22, a32 = a.m32,
      a03 = a.m03, a13 = a.m13, a23 = a.m23, a33 = a.m33;
    const b00 = b.m00, b10 = b.m10, b20 = b.m20, b30 = b.m30,
      b01 = b.m01, b11 = b.m11, b21 = b.m21, b31 = b.m31,
      b02 = b.m02, b12 = b.m12, b22 = b.m22, b32 = b.m32,
      b03 = b.m03, b13 = b.m13, b23 = b.m23, b33 = b.m33;

    this.mutate(() => {
      this._m00 = b00 * a00 + b10 * a01 + b20 * a02 + b30 * a03;
      this._m10 = b00 * a10 + b10 * a11 + b20 * a12 + b30 * a13;
      this._m20 = b00 * a20 + b10 * a21 + b20 * a22 + b30 * a23;
      this._m30 = b00 * a30 + b10 * a31 + b20 * a32 + b30 * a33;
      this._m01 = b01 * a00 + b11 * a01 + b21 * a02 + b31 * a03;
      this._m11 = b01 * a10 + b11 * a11 + b21 * a12 + b31 * a13;
      this._m21 = b01 * a20 + b11 * a21 + b21 * a22 + b31 * a23;
      this._m31 = b01 * a30 + b11 * a31 + b21 * a32 + b31 * a33;
      this._m02 = b02 * a00 + b12 * a01 + b22 * a02 + b32 * a03;
      this._m12 = b02 * a10 + b12 * a11 + b22 * a12 + b32 * a13;
      this._m22 = b02 * a20 + b12 * a21 + b22 * a22 + b32 * a23;
      this._m32 = b02 * a30 + b12 * a31 + b22 * a32 + b32 * a33;
      this._m03 = b03 * a00 + b13 * a01 + b23 * a02 + b33 * a03;
      this._m13 = b03 * a10 + b13 * a11 + b23 * a12 + b33 * a13;
      this._m23 = b03 * a20 + b13 * a21 + b23 * a22 + b33 * a23;
      this._m33 = b03 * a30 + b13 * a31 + b23 * a32 + b33 * a33;
    });

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
    this.mutate(() => {
      this._m00 = (a11 * b11 - a21 * b10 + a31 * b09) * det;
      this._m10 = (a20 * b10 - a10 * b11 - a30 * b09) * det;
      this._m20 = (a13 * b05 - a23 * b04 + a33 * b03) * det;
      this._m30 = (a22 * b04 - a12 * b05 - a32 * b03) * det;
      this._m01 = (a21 * b08 - a01 * b11 - a31 * b07) * det;
      this._m11 = (a00 * b11 - a20 * b08 + a30 * b07) * det;
      this._m21 = (a23 * b02 - a03 * b05 - a33 * b01) * det;
      this._m31 = (a02 * b05 - a22 * b02 + a32 * b01) * det;
      this._m02 = (a01 * b10 - a11 * b08 + a31 * b06) * det;
      this._m12 = (a10 * b08 - a00 * b10 - a30 * b06) * det;
      this._m22 = (a03 * b04 - a13 * b02 + a33 * b00) * det;
      this._m32 = (a12 * b02 - a02 * b04 - a32 * b00) * det;
      this._m03 = (a11 * b07 - a01 * b09 - a21 * b06) * det;
      this._m13 = (a00 * b09 - a10 * b07 + a20 * b06) * det;
      this._m23 = (a13 * b01 - a03 * b03 - a23 * b00) * det;
      this._m33 = (a02 * b03 - a12 * b01 + a22 * b00) * det;
    });
    return this;
  }
  public invert(): Matrix4 {
    return this.clone().invertSelf();
  }

  public perspectiveSelf(fovy: number, aspect: number, near: number, far: number): this {
    const f = 1.0 / Math.tan(fovy / 2);
    this.mutate(() => {
      this._m00 = f / aspect;
      this._m10 = 0;
      this._m20 = 0;
      this._m30 = 0;
      this._m01 = 0;
      this._m11 = f;
      this._m21 = 0;
      this._m31 = 0;
      this._m02 = 0;
      this._m12 = 0;
      this._m32 = -1;
      this._m03 = 0;
      this._m13 = 0;
      this._m33 = 0;
      if (far != null && far !== Infinity) {
        const nf = 1 / (near - far);
        this._m22 = (far + near) * nf;
        this._m23 = 2 * far * near * nf;
      } else {
        this._m22 = -1;
        this._m23 = -2 * near;
      }
    });

    return this;
  }
  public static perspective(fovy: number, aspect: number, near: number, far: number): Matrix4 {
    return new Matrix4().perspectiveSelf(fovy, aspect, near, far);
  }

  // @TODO rename / re-order params
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

    this.mutate(() => {
      this._m00 = (1 - (yy + zz)) * s.x;
      this._m10 = (xy + wz) * s.x;
      this._m20 = (xz - wy) * s.x;
      this._m30 = 0;
      this._m01 = (xy - wz) * s.y;
      this._m11 = (1 - (xx + zz)) * s.y;
      this._m21 = (yz + wx) * s.y;
      this._m31 = 0;
      this._m02 = (xz + wy) * s.z;
      this._m12 = (yz - wx) * s.z;
      this._m22 = (1 - (xx + yy)) * s.z;
      this._m32 = 0;
      this._m03 = v.x;
      this._m13 = v.y;
      this._m23 = v.z;
      this._m33 = 1;
    });

    return this;
  }
  public static fromRotationTranslationScale(q: Quaternion, v: Vector3, s: Vector3): Matrix4 {
    return new Matrix4().fromRotationTranslationScaleSelf(q, v, s);
  }

  public identitySelf(): this {
    this.mutate(() => {
      this._m00 = 1;
      this._m10 = 0;
      this._m20 = 0;
      this._m30 = 0;
      this._m01 = 0;
      this._m11 = 1;
      this._m21 = 0;
      this._m31 = 0;
      this._m02 = 0;
      this._m12 = 0;
      this._m22 = 1;
      this._m32 = 0;
      this._m03 = 0;
      this._m13 = 0;
      this._m23 = 0;
      this._m33 = 1;
    });
    return this;
  }
  public static identity(): Matrix4 {
    return new Matrix4().identitySelf();
  }

  public writeTo(target: Float32Array, offset: number = 0): void {
    target[offset + 0] = this.m00;
    target[offset + 1] = this.m10;
    target[offset + 2] = this.m20;
    target[offset + 3] = this.m30;
    target[offset + 4] = this.m01;
    target[offset + 5] = this.m11;
    target[offset + 6] = this.m21;
    target[offset + 7] = this.m31;
    target[offset + 8] = this.m02;
    target[offset + 9] = this.m12;
    target[offset + 10] = this.m22;
    target[offset + 11] = this.m32;
    target[offset + 12] = this.m03;
    target[offset + 13] = this.m13;
    target[offset + 14] = this.m23;
    target[offset + 15] = this.m33;
  }

  public toString(dp: number = 2): string {
    return `(Matrix4[\n` +
    /*  */ `${this.m00.toFixed(dp)} ${this.m01.toFixed(dp)} ${this.m02.toFixed(dp)} ${this.m03.toFixed(dp)}\n`
    /**/ + `${this.m10.toFixed(dp)} ${this.m11.toFixed(dp)} ${this.m12.toFixed(dp)} ${this.m13.toFixed(dp)}\n`
    /**/ + `${this.m20.toFixed(dp)} ${this.m21.toFixed(dp)} ${this.m22.toFixed(dp)} ${this.m23.toFixed(dp)}\n`
    /**/ + `${this.m30.toFixed(dp)} ${this.m31.toFixed(dp)} ${this.m32.toFixed(dp)} ${this.m33.toFixed(dp)}\n`
      + `]`;
  }

  public prettyPrint(dp: number = 2, message: string = ""): void {
    console.log(message, this.toString(dp));
  }

  public get m00(): number { return this._m00; }
  public set m00(value: number) { this.mutate(() => this._m00 = value); }
  public get m10(): number { return this._m10; }
  public set m10(value: number) { this.mutate(() => this._m10 = value); }
  public get m20(): number { return this._m20; }
  public set m20(value: number) { this.mutate(() => this._m20 = value); }
  public get m30(): number { return this._m30; }
  public set m30(value: number) { this.mutate(() => this._m30 = value); }
  public get m01(): number { return this._m01; }
  public set m01(value: number) { this.mutate(() => this._m01 = value); }
  public get m11(): number { return this._m11; }
  public set m11(value: number) { this.mutate(() => this._m11 = value); }
  public get m21(): number { return this._m21; }
  public set m21(value: number) { this.mutate(() => this._m21 = value); }
  public get m31(): number { return this._m31; }
  public set m31(value: number) { this.mutate(() => this._m31 = value); }
  public get m02(): number { return this._m02; }
  public set m02(value: number) { this.mutate(() => this._m02 = value); }
  public get m12(): number { return this._m12; }
  public set m12(value: number) { this.mutate(() => this._m12 = value); }
  public get m22(): number { return this._m22; }
  public set m22(value: number) { this.mutate(() => this._m22 = value); }
  public get m32(): number { return this._m32; }
  public set m32(value: number) { this.mutate(() => this._m32 = value); }
  public get m03(): number { return this._m03; }
  public set m03(value: number) { this.mutate(() => this._m03 = value); }
  public get m13(): number { return this._m13; }
  public set m13(value: number) { this.mutate(() => this._m13 = value); }
  public get m23(): number { return this._m23; }
  public set m23(value: number) { this.mutate(() => this._m23 = value); }
  public get m33(): number { return this._m33; }
  public set m33(value: number) { this.mutate(() => this._m33 = value); }
}

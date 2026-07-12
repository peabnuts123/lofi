import type { TypedArray } from "@lofi/core/util/types";

import { Observable } from "../util";
import { CannotInvertMatrixError } from "./Matrix3";
import type { Quaternion } from "./Quaternion";
import type { Vector3 } from "./vector";


export type Matrix4InitialValues = [
  m00: number, m10: number, m20: number, m30: number,
  m01: number, m11: number, m21: number, m31: number,
  m02: number, m12: number, m22: number, m32: number,
  m03: number, m13: number, m23: number, m33: number,
];

class Matrix4InternalBuffer {
  public static readonly BufferSize: number = 16;
  public readonly buffer: Float64Array = new Float64Array(Matrix4InternalBuffer.BufferSize);
  public get m00(): number { return this.buffer[0]; }
  public set m00(value: number) { this.buffer[0] = value; }
  public get m10(): number { return this.buffer[1]; }
  public set m10(value: number) { this.buffer[1] = value; }
  public get m20(): number { return this.buffer[2]; }
  public set m20(value: number) { this.buffer[2] = value; }
  public get m30(): number { return this.buffer[3]; }
  public set m30(value: number) { this.buffer[3] = value; }
  public get m01(): number { return this.buffer[4]; }
  public set m01(value: number) { this.buffer[4] = value; }
  public get m11(): number { return this.buffer[5]; }
  public set m11(value: number) { this.buffer[5] = value; }
  public get m21(): number { return this.buffer[6]; }
  public set m21(value: number) { this.buffer[6] = value; }
  public get m31(): number { return this.buffer[7]; }
  public set m31(value: number) { this.buffer[7] = value; }
  public get m02(): number { return this.buffer[8]; }
  public set m02(value: number) { this.buffer[8] = value; }
  public get m12(): number { return this.buffer[9]; }
  public set m12(value: number) { this.buffer[9] = value; }
  public get m22(): number { return this.buffer[10]; }
  public set m22(value: number) { this.buffer[10] = value; }
  public get m32(): number { return this.buffer[11]; }
  public set m32(value: number) { this.buffer[11] = value; }
  public get m03(): number { return this.buffer[12]; }
  public set m03(value: number) { this.buffer[12] = value; }
  public get m13(): number { return this.buffer[13]; }
  public set m13(value: number) { this.buffer[13] = value; }
  public get m23(): number { return this.buffer[14]; }
  public set m23(value: number) { this.buffer[14] = value; }
  public get m33(): number { return this.buffer[15]; }
  public set m33(value: number) { this.buffer[15] = value; }
}

/**
 * A 4x4 matrix. Values are stored in column-major order.
 */
export class Matrix4 extends Observable {
  private readonly internal: Matrix4InternalBuffer;

  /**
   * Create a new instance of Matrix4. Will be initialised to an identity matrix
   * if no initial values are provided.
   */
  public constructor(initialValues?: Matrix4InitialValues | TypedArray) {
    super();
    this.internal = new Matrix4InternalBuffer();
    if (initialValues) {
      for (let i = 0; i < Matrix4InternalBuffer.BufferSize; i++) {
        this.internal.buffer[i] = initialValues[i];
      }
    } else {
      // @NOTE Initialise to identity matrix
      // @TODO Deprecate in favour of `Matrix4.identity()`
      this.internal.m00 = 1;
      this.internal.m10 = 0;
      this.internal.m20 = 0;
      this.internal.m30 = 0;
      this.internal.m01 = 0;
      this.internal.m11 = 1;
      this.internal.m21 = 0;
      this.internal.m31 = 0;
      this.internal.m02 = 0;
      this.internal.m12 = 0;
      this.internal.m22 = 1;
      this.internal.m32 = 0;
      this.internal.m03 = 0;
      this.internal.m13 = 0;
      this.internal.m23 = 0;
      this.internal.m33 = 1;
    }
  }

  public clone(): Matrix4 {
    return new Matrix4(this.internal.buffer);
  }

  public setValue(value: Matrix4): this {
    let valueChanged = false;
    for (let i = 0; i < Matrix4InternalBuffer.BufferSize; i++) {
      if (!valueChanged && this.internal.buffer[i] !== value.internal.buffer[i]) {
        valueChanged = true;
      }
      this.internal.buffer[i] = value.internal.buffer[i];
    }
    if (valueChanged) {
      this.notifyOnChange();
    }
    return this;
  }

  public addSelf(other: Matrix4): this {
    for (let i = 0; i < Matrix4InternalBuffer.BufferSize; i++) {
      this.internal.buffer[i] += other.internal.buffer[i];
    }
    this.notifyOnChange();
    return this;
  }
  public add(other: Matrix4): Matrix4 {
    return this.clone().addSelf(other);
  }

  public scaleSelf(factor: number): this {
    for (let i = 0; i < Matrix4InternalBuffer.BufferSize; i++) {
      this.internal.buffer[i] *= factor;
    }
    this.notifyOnChange();
    return this;
  }
  public scale(factor: number): Matrix4 {
    return this.clone().scaleSelf(factor);
  }

  public multiplySelf(other: Matrix4): this {
    const a00 = this.m00, a10 = this.m10, a20 = this.m20, a30 = this.m30,
      a01 = this.m01, a11 = this.m11, a21 = this.m21, a31 = this.m31,
      a02 = this.m02, a12 = this.m12, a22 = this.m22, a32 = this.m32,
      a03 = this.m03, a13 = this.m13, a23 = this.m23, a33 = this.m33;
    const b00 = other.m00, b10 = other.m10, b20 = other.m20, b30 = other.m30,
      b01 = other.m01, b11 = other.m11, b21 = other.m21, b31 = other.m31,
      b02 = other.m02, b12 = other.m12, b22 = other.m22, b32 = other.m32,
      b03 = other.m03, b13 = other.m13, b23 = other.m23, b33 = other.m33;

    this.internal.m00 = b00 * a00 + b10 * a01 + b20 * a02 + b30 * a03;
    this.internal.m10 = b00 * a10 + b10 * a11 + b20 * a12 + b30 * a13;
    this.internal.m20 = b00 * a20 + b10 * a21 + b20 * a22 + b30 * a23;
    this.internal.m30 = b00 * a30 + b10 * a31 + b20 * a32 + b30 * a33;
    this.internal.m01 = b01 * a00 + b11 * a01 + b21 * a02 + b31 * a03;
    this.internal.m11 = b01 * a10 + b11 * a11 + b21 * a12 + b31 * a13;
    this.internal.m21 = b01 * a20 + b11 * a21 + b21 * a22 + b31 * a23;
    this.internal.m31 = b01 * a30 + b11 * a31 + b21 * a32 + b31 * a33;
    this.internal.m02 = b02 * a00 + b12 * a01 + b22 * a02 + b32 * a03;
    this.internal.m12 = b02 * a10 + b12 * a11 + b22 * a12 + b32 * a13;
    this.internal.m22 = b02 * a20 + b12 * a21 + b22 * a22 + b32 * a23;
    this.internal.m32 = b02 * a30 + b12 * a31 + b22 * a32 + b32 * a33;
    this.internal.m03 = b03 * a00 + b13 * a01 + b23 * a02 + b33 * a03;
    this.internal.m13 = b03 * a10 + b13 * a11 + b23 * a12 + b33 * a13;
    this.internal.m23 = b03 * a20 + b13 * a21 + b23 * a22 + b33 * a23;
    this.internal.m33 = b03 * a30 + b13 * a31 + b23 * a32 + b33 * a33;
    this.notifyOnChange();

    return this;
  }
  public multiply(other: Matrix4): Matrix4 {
    return this.clone().multiplySelf(other);
  }

  public transformPointInPlace(point: Vector3): Vector3 {
    const { x, y, z } = point;
    const w = this.m30 * x + this.m31 * y + this.m32 * z + this.m33 || 1.0;
    return point.setValue(
      (this.m00 * x + this.m01 * y + this.m02 * z + this.m03) / w,
      (this.m10 * x + this.m11 * y + this.m12 * z + this.m13) / w,
      (this.m20 * x + this.m21 * y + this.m22 * z + this.m23) / w,
    );
  }
  public transformPoint(point: Vector3): Vector3 {
    return this.transformPointInPlace(point.clone());
  }

  public transformDirectionInPlace(direction: Vector3): Vector3 {
    const { x, y, z } = direction;
    return direction.setValue(
      this.m00 * x + this.m01 * y + this.m02 * z,
      this.m10 * x + this.m11 * y + this.m12 * z,
      this.m20 * x + this.m21 * y + this.m22 * z,
    );
  }
  public transformDirection(direction: Vector3): Vector3 {
    return this.transformDirectionInPlace(direction.clone());
  }

  public transformNormalInPlace(normal: Vector3): Vector3 {
    const { x, y, z } = normal;
    const a00 = this.m00, a10 = this.m10, a20 = this.m20,
      a01 = this.m01, a11 = this.m11, a21 = this.m21,
      a02 = this.m02, a12 = this.m12, a22 = this.m22;
    const b00 = a11 * a22 - a21 * a12;
    const b01 = a20 * a12 - a10 * a22;
    const b02 = a10 * a21 - a20 * a11;
    const b10 = a21 * a02 - a01 * a22;
    const b11 = a00 * a22 - a20 * a02;
    const b12 = a20 * a01 - a00 * a21;
    const b20 = a01 * a12 - a11 * a02;
    const b21 = a10 * a02 - a00 * a12;
    const b22 = a00 * a11 - a10 * a01;
    let det = a00 * b00 + a01 * b01 + a02 * b02;
    if (!det) {
      throw new CannotInvertMatrixError("Matrix4: Can't transform normal, matrix determinant is 0");
    }
    det = 1.0 / det;
    return normal.setValue(
      (b00 * x + b01 * y + b02 * z) * det,
      (b10 * x + b11 * y + b12 * z) * det,
      (b20 * x + b21 * y + b22 * z) * det,
    ).normalizeSelf();
  }
  public transformNormal(normal: Vector3): Vector3 {
    return this.transformNormalInPlace(normal.clone());
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
    this.internal.m00 = (a11 * b11 - a21 * b10 + a31 * b09) * det;
    this.internal.m10 = (a20 * b10 - a10 * b11 - a30 * b09) * det;
    this.internal.m20 = (a13 * b05 - a23 * b04 + a33 * b03) * det;
    this.internal.m30 = (a22 * b04 - a12 * b05 - a32 * b03) * det;
    this.internal.m01 = (a21 * b08 - a01 * b11 - a31 * b07) * det;
    this.internal.m11 = (a00 * b11 - a20 * b08 + a30 * b07) * det;
    this.internal.m21 = (a23 * b02 - a03 * b05 - a33 * b01) * det;
    this.internal.m31 = (a02 * b05 - a22 * b02 + a32 * b01) * det;
    this.internal.m02 = (a01 * b10 - a11 * b08 + a31 * b06) * det;
    this.internal.m12 = (a10 * b08 - a00 * b10 - a30 * b06) * det;
    this.internal.m22 = (a03 * b04 - a13 * b02 + a33 * b00) * det;
    this.internal.m32 = (a12 * b02 - a02 * b04 - a32 * b00) * det;
    this.internal.m03 = (a11 * b07 - a01 * b09 - a21 * b06) * det;
    this.internal.m13 = (a00 * b09 - a10 * b07 + a20 * b06) * det;
    this.internal.m23 = (a13 * b01 - a03 * b03 - a23 * b00) * det;
    this.internal.m33 = (a02 * b03 - a12 * b01 + a22 * b00) * det;
    this.notifyOnChange();
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
    this.m11 = 0;
    // this.m21 = -(f + n)/(n - f)
    this.m31 = 1;
    this.m02 = 0;
    this.m12 = f;
    this.m22 = 0;
    this.m32 = 0;
    this.m03 = 0;
    this.m13 = 0;
    // this.m23 = 2fn/(n - f);
    this.m33 = 0;
    if (far != null && far !== Infinity) {
      const nf = 1 / (near - far);
      this.m21 = -(far + near) * nf;
      this.m23 = 2 * far * near * nf;
    } else {
      this.m21 = 1;
      this.m23 = -2 * near;
    }
    this.notifyOnChange();

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

    this.internal.m00 = (1 - (yy + zz)) * s.x;
    this.internal.m10 = (xy + wz) * s.x;
    this.internal.m20 = (xz - wy) * s.x;
    this.internal.m30 = 0;
    this.internal.m01 = (xy - wz) * s.y;
    this.internal.m11 = (1 - (xx + zz)) * s.y;
    this.internal.m21 = (yz + wx) * s.y;
    this.internal.m31 = 0;
    this.internal.m02 = (xz + wy) * s.z;
    this.internal.m12 = (yz - wx) * s.z;
    this.internal.m22 = (1 - (xx + yy)) * s.z;
    this.internal.m32 = 0;
    this.internal.m03 = v.x;
    this.internal.m13 = v.y;
    this.internal.m23 = v.z;
    this.internal.m33 = 1;
    this.notifyOnChange();

    return this;
  }
  public static fromRotationTranslationScale(q: Quaternion, v: Vector3, s: Vector3): Matrix4 {
    return new Matrix4().fromRotationTranslationScaleSelf(q, v, s);
  }

  public identitySelf(): this {
    this.internal.m00 = 1;
    this.internal.m10 = 0;
    this.internal.m20 = 0;
    this.internal.m30 = 0;
    this.internal.m01 = 0;
    this.internal.m11 = 1;
    this.internal.m21 = 0;
    this.internal.m31 = 0;
    this.internal.m02 = 0;
    this.internal.m12 = 0;
    this.internal.m22 = 1;
    this.internal.m32 = 0;
    this.internal.m03 = 0;
    this.internal.m13 = 0;
    this.internal.m23 = 0;
    this.internal.m33 = 1;
    this.notifyOnChange();
    return this;
  }
  public static identity(): Matrix4 {
    return new Matrix4().identitySelf();
  }

  public writeTo(target: Float32Array, offset: number = 0): void {
    target.set(this.internal.buffer, offset);
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

  public get m00(): number { return this.internal.m00; }
  public set m00(value: number) {
    if (this.internal.m00 !== value) {
      this.internal.m00 = value;
      this.notifyOnChange();
    }
  }
  public get m10(): number { return this.internal.m10; }
  public set m10(value: number) {
    if (this.internal.m10 !== value) {
      this.internal.m10 = value;
      this.notifyOnChange();
    }
  }
  public get m20(): number { return this.internal.m20; }
  public set m20(value: number) {
    if (this.internal.m20 !== value) {
      this.internal.m20 = value;
      this.notifyOnChange();
    }
  }
  public get m30(): number { return this.internal.m30; }
  public set m30(value: number) {
    if (this.internal.m30 !== value) {
      this.internal.m30 = value;
      this.notifyOnChange();
    }
  }
  public get m01(): number { return this.internal.m01; }
  public set m01(value: number) {
    if (this.internal.m01 !== value) {
      this.internal.m01 = value;
      this.notifyOnChange();
    }
  }
  public get m11(): number { return this.internal.m11; }
  public set m11(value: number) {
    if (this.internal.m11 !== value) {
      this.internal.m11 = value;
      this.notifyOnChange();
    }
  }
  public get m21(): number { return this.internal.m21; }
  public set m21(value: number) {
    if (this.internal.m21 !== value) {
      this.internal.m21 = value;
      this.notifyOnChange();
    }
  }
  public get m31(): number { return this.internal.m31; }
  public set m31(value: number) {
    if (this.internal.m31 !== value) {
      this.internal.m31 = value;
      this.notifyOnChange();
    }
  }
  public get m02(): number { return this.internal.m02; }
  public set m02(value: number) {
    if (this.internal.m02 !== value) {
      this.internal.m02 = value;
      this.notifyOnChange();
    }
  }
  public get m12(): number { return this.internal.m12; }
  public set m12(value: number) {
    if (this.internal.m12 !== value) {
      this.internal.m12 = value;
      this.notifyOnChange();
    }
  }
  public get m22(): number { return this.internal.m22; }
  public set m22(value: number) {
    if (this.internal.m22 !== value) {
      this.internal.m22 = value;
      this.notifyOnChange();
    }
  }
  public get m32(): number { return this.internal.m32; }
  public set m32(value: number) {
    if (this.internal.m32 !== value) {
      this.internal.m32 = value;
      this.notifyOnChange();
    }
  }
  public get m03(): number { return this.internal.m03; }
  public set m03(value: number) {
    if (this.internal.m03 !== value) {
      this.internal.m03 = value;
      this.notifyOnChange();
    }
  }
  public get m13(): number { return this.internal.m13; }
  public set m13(value: number) {
    if (this.internal.m13 !== value) {
      this.internal.m13 = value;
      this.notifyOnChange();
    }
  }
  public get m23(): number { return this.internal.m23; }
  public set m23(value: number) {
    if (this.internal.m23 !== value) {
      this.internal.m23 = value;
      this.notifyOnChange();
    }
  }
  public get m33(): number { return this.internal.m33; }
  public set m33(value: number) {
    if (this.internal.m33 !== value) {
      this.internal.m33 = value;
      this.notifyOnChange();
    }
  }
}

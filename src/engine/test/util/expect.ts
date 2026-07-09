import { expect } from "vitest";

import type { Matrix4 } from "@lofi/core/math/Matrix4";
import type { IReadOnlyQuaternion } from "@lofi/core/math/Quaternion";
import type { Vector3Definition } from "@lofi/core/math/vector";

export function expectQuaternionsToBeEqual(actual: IReadOnlyQuaternion, expected: IReadOnlyQuaternion): void {
  expect(actual.x, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.x, 8);
  expect(actual.y, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.y, 8);
  expect(actual.z, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.z, 8);
  expect(actual.w, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.w, 8);
}

export function expectVectorsToBeEqual(actual: Vector3Definition, expected: Vector3Definition, message?: string): void {
  expect(actual.x, `${message ? message + ". " : ""}Expected '${JSON.stringify({ x: actual.x, y: actual.y, z: actual.z })}' to equal ${JSON.stringify({ x: expected.x, y: expected.y, z: expected.z })}`).toBeCloseTo(expected.x, 8);
  expect(actual.y, `${message ? message + ". " : ""}Expected '${JSON.stringify({ x: actual.x, y: actual.y, z: actual.z })}' to equal ${JSON.stringify({ x: expected.x, y: expected.y, z: expected.z })}`).toBeCloseTo(expected.y, 8);
  expect(actual.z, `${message ? message + ". " : ""}Expected '${JSON.stringify({ x: actual.x, y: actual.y, z: actual.z })}' to equal ${JSON.stringify({ x: expected.x, y: expected.y, z: expected.z })}`).toBeCloseTo(expected.z, 8);
}

export function expectVectorArraysToBeEqual(actual: readonly Vector3Definition[], expected: readonly Vector3Definition[]): void {
  expect(actual.length, "Array lengths should be equal").toEqual(expected.length);
  actual.forEach((actual, i) => {
    expectVectorsToBeEqual(actual, expected[i], `Vectors at index ${i} are not equal`);
  });
}

export function expectMatrix4sToBeEqual(actual: Matrix4, expected: Matrix4): void {
  expect(actual.m00, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.m00, 8);
  expect(actual.m10, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.m10, 8);
  expect(actual.m20, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.m20, 8);
  expect(actual.m30, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.m30, 8);
  expect(actual.m01, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.m01, 8);
  expect(actual.m11, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.m11, 8);
  expect(actual.m21, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.m21, 8);
  expect(actual.m31, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.m31, 8);
  expect(actual.m02, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.m02, 8);
  expect(actual.m12, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.m12, 8);
  expect(actual.m22, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.m22, 8);
  expect(actual.m32, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.m32, 8);
  expect(actual.m03, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.m03, 8);
  expect(actual.m13, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.m13, 8);
  expect(actual.m23, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.m23, 8);
  expect(actual.m33, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.m33, 8);
}

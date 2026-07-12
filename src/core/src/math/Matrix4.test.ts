import { describe, test, expect } from 'vitest';
import { Matrix4 } from './Matrix4';
import { Vector3 } from './vector';
import { expectVectorsToBeEqual } from '@test/util/expect';
import { Quaternion } from './Quaternion';

/*
  @TODO Test backlog
    - Everything (these tests are just ported from Vector3)
 */

describe(Matrix4.name, () => {
  describe("Observability", () => {
    test("Calling transformPointInPlace() does not fire onChange()", () => {
      // Setup
      const matrix = Matrix4.identity();

      let timesOnChangeCalled = 0;
      matrix.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      matrix.transformPointInPlace(Vector3.forward());

      // Assert
      expect(timesOnChangeCalled).toBe(0);
    });
    test("Calling transformPoint() does not fire onChange()", () => {
      // Setup
      const matrix = Matrix4.identity();

      let timesOnChangeCalled = 0;
      matrix.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      matrix.transformPoint(Vector3.forward());

      // Assert
      expect(timesOnChangeCalled).toBe(0);
    });
    test("Calling transformDirectionInPlace() does not fire onChange()", () => {
      // Setup
      const matrix = Matrix4.identity();

      let timesOnChangeCalled = 0;
      matrix.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      matrix.transformDirectionInPlace(Vector3.forward());

      // Assert
      expect(timesOnChangeCalled).toBe(0);
    });
    test("Calling transformDirection() does not fire onChange()", () => {
      // Setup
      const matrix = Matrix4.identity();

      let timesOnChangeCalled = 0;
      matrix.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      matrix.transformDirection(Vector3.forward());

      // Assert
      expect(timesOnChangeCalled).toBe(0);
    });
    test("Calling transformNormalInPlace() does not fire onChange()", () => {
      // Setup
      const matrix = Matrix4.identity();

      let timesOnChangeCalled = 0;
      matrix.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      matrix.transformNormalInPlace(Vector3.forward());

      // Assert
      expect(timesOnChangeCalled).toBe(0);
    });
    test("Calling transformNormal() does not fire onChange()", () => {
      // Setup
      const matrix = Matrix4.identity();

      let timesOnChangeCalled = 0;
      matrix.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      matrix.transformNormal(Vector3.forward());

      // Assert
      expect(timesOnChangeCalled).toBe(0);
    });
  });

  test("Calling transformPointInPlace() mutates correctly", () => {
    // Setup
    const vector = new Vector3(1, 0, 0);
    const matrix = Matrix4.fromRotationTranslationScale(
      Quaternion.fromAxisAngle(Vector3.up(), 90),
      Vector3.one(),
      new Vector3(2, 2, 2),
    );
    // @NOTE order of operations:
    // 1. Scale
    // 2. Rotation
    // 3. Translation
    const expectedValue = new Vector3(1, 3, 1);

    // Test
    matrix.transformPointInPlace(vector);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling transformPoint() returns the correct result", () => {
    // Setup
    const vector = new Vector3(1, 0, 0);
    const original = vector.clone();
    const matrix = Matrix4.fromRotationTranslationScale(
      Quaternion.fromAxisAngle(Vector3.up(), 90),
      Vector3.one(),
      new Vector3(2, 2, 2),
    );
    // @NOTE order of operations:
    // 1. Scale
    // 2. Rotation
    // 3. Translation
    const expectedValue = new Vector3(1, 3, 1);

    // Test
    const result = matrix.transformPoint(vector);

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });
  test("Calling transformDirectionInPlace() mutates correctly", () => {
    // Setup
    const vector = new Vector3(1, 0, 0);
    const matrix = Matrix4.fromRotationTranslationScale(
      Quaternion.fromAxisAngle(Vector3.up(), 90),
      Vector3.one(),
      new Vector3(2, 2, 2),
    );
    const expectedValue = new Vector3(0, 2, 0);

    // Test
    matrix.transformDirectionInPlace(vector);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling transformDirection() returns the correct result", () => {
    // Setup
    const vector = new Vector3(1, 0, 0);
    const original = vector.clone();
    const matrix = Matrix4.fromRotationTranslationScale(
      Quaternion.fromAxisAngle(Vector3.up(), 90),
      Vector3.one(),
      new Vector3(2, 2, 2),
    );
    const expectedValue = new Vector3(0, 2, 0);

    // Test
    const result = matrix.transformDirection(vector);

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });

  test("Calling transformNormalInPlace() mutates correctly", () => {
    // Setup
    const vector = new Vector3(1, 1, 0).normalizeSelf();
    const matrix = Matrix4.fromRotationTranslationScale(
      Quaternion.fromAxisAngle(Vector3.up(), 90),
      Vector3.one(),
      new Vector3(2, 1, 1),
    );
    const expectedValue = new Vector3(-1, 0.5, 0).normalizeSelf();

    // Test
    matrix.transformNormalInPlace(vector);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling transformNormal() returns the correct result", () => {
    // Setup
    const vector = new Vector3(1, 1, 0).normalizeSelf();
    const original = vector.clone();
    const matrix = Matrix4.fromRotationTranslationScale(
      Quaternion.fromAxisAngle(Vector3.up(), 90),
      Vector3.one(),
      new Vector3(2, 1, 1),
    );
    const expectedValue = new Vector3(-1, 0.5, 0).normalizeSelf();

    // Test
    const result = matrix.transformNormal(vector);

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });
});

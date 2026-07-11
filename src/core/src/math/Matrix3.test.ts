import { describe, test } from 'vitest';
import { Matrix3 } from './Matrix3';
import { Vector3 } from './vector';
import { expectVectorsToBeEqual } from '@test/util/expect';

describe(Matrix3.name, () => {
  // describe("Observability", () => {
  // @TODO Make Matrix3 Observable
  //   test("Calling multiplyVectorInPlace() fires onChange() once", () => {
  //     // Setup
  //     const matrix = Matrix3.identity();

  //     let timesOnChangeCalled = 0;
  //     matrix.onChange(() => {
  //       timesOnChangeCalled++;
  //     });

  //     // Test
  //     matrix.multiplyVectorInPlace(Vector3.forward());

  //     // Assert
  //     expect(timesOnChangeCalled).toBe(1);
  //   });
  //   test("Calling multiplyVector() fires onChange() once", () => {
  //     // Setup
  //     const matrix = Matrix3.identity();

  //     let timesOnChangeCalled = 0;
  //     matrix.onChange(() => {
  //       timesOnChangeCalled++;
  //     });

  //     // Test
  //     matrix.multiplyVector(Vector3.forward());

  //     // Assert
  //     expect(timesOnChangeCalled).toBe(1);
  //   });
  // });
  test("Calling multiplyVectorInPlace() with a Matrix3 mutates correctly", () => {
    // Setup
    const vector = new Vector3(1, 2, 3);
    const matrix = new Matrix3([
      1, 2, 3,
      4, 5, 6,
      7, 8, 9,
    ]);
    const expectedValue = new Vector3(30, 36, 42);

    // Test
    matrix.multiplyVectorInPlace(vector);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling multiplyVector() returns the correct result", () => {
    // Setup
    const vector = new Vector3(1, 2, 3);
    const original = vector.clone();
    const matrix = new Matrix3([
      1, 2, 3,
      4, 5, 6,
      7, 8, 9,
    ]);
    const expectedValue = new Vector3(30, 36, 42);

    // Test
    const result = matrix.multiplyVector(vector);

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });
});

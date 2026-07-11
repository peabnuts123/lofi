import { expectQuaternionsToBeEqual, expectVectorsToBeEqual } from '@test/util/expect';

import { describe, test, expect } from 'vitest';
import { Quaternion } from './Quaternion';
import { Vector3 } from './vector';
import { WellKnownQuaternions } from '@test/util/quaternions';

/*
  @TODO Test Backlog
    - Normalizing quaternion of length 0 gets identity
    - Normalizing quaternion of length 1 gets no change, doesn't notify
    - Setting same value does not fire onChange

 */

describe("quaternion", () => {
  describe("Observability", () => {
    test("Setting x, y, z, w fires onChange() separately", () => {
      // Setup
      const quaternion = Quaternion.identity();

      let timesOnChangeCalled = 0;
      quaternion.onChange(() => {
        timesOnChangeCalled++;
      });

      const timesOnChangeCalledInitial = timesOnChangeCalled;

      // Test
      quaternion.x = 1;
      const timesOnChangeCalledAfterSetX = timesOnChangeCalled;
      quaternion.y = 2;
      const timesOnChangeCalledAfterSetY = timesOnChangeCalled;
      quaternion.z = 3;
      const timesOnChangeCalledAfterSetZ = timesOnChangeCalled;
      quaternion.w = 4;
      const timesOnChangeCalledAfterSetW = timesOnChangeCalled;

      // Assert
      expect(timesOnChangeCalledInitial).toBe(0);
      expect(timesOnChangeCalledAfterSetX).toBe(1);
      expect(timesOnChangeCalledAfterSetY).toBe(2);
      expect(timesOnChangeCalledAfterSetZ).toBe(3);
      expect(timesOnChangeCalledAfterSetW).toBe(4);
    });
    test("Calling multiplySelf() fires onChange() once", () => {
      // Setup
      const quaternion = Quaternion.identity();

      let timesOnChangeCalled = 0;
      quaternion.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      quaternion.multiplySelf(Quaternion.identity());

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling slerpSelf() fires onChange() once", () => {
      // Setup
      const quaternion = Quaternion.identity();

      let timesOnChangeCalled = 0;
      quaternion.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      quaternion.slerpSelf(Quaternion.identity(), 0.5);

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling setValue() fires onChange() once", () => {
      // Setup
      const quaternion = Quaternion.identity();

      let timesOnChangeCalled = 0;
      quaternion.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      quaternion.setValue(new Quaternion(0, 1, 0, 0));

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling invertSelf() fires onChange() once", () => {
      // Setup
      const quaternion = Quaternion.identity();

      let timesOnChangeCalled = 0;
      quaternion.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      quaternion.invertSelf();

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling normalizeSelf() fires onChange() once", () => {
      // Setup
      const quaternion = Quaternion.identity();

      let timesOnChangeCalled = 0;
      quaternion.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      quaternion.normalizeSelf();

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling rotateVectorInPlace() does not fire onChange()", () => {
      // Setup
      const quaternion = Quaternion.identity();

      let timesOnChangeCalled = 0;
      quaternion.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      quaternion.rotateVectorInPlace(Vector3.forward());

      // Assert
      expect(timesOnChangeCalled).toBe(0);
    });
    test("Calling rotateVector() does not fire onChange()", () => {
      // Setup
      const quaternion = Quaternion.identity();

      let timesOnChangeCalled = 0;
      quaternion.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      quaternion.rotateVector(Vector3.forward());

      // Assert
      expect(timesOnChangeCalled).toBe(0);
    });
  });
  test("Constructor initial values are set correctly", () => {
    // Setup
    const quaternion = new Quaternion(1, 2, 3, 4);

    // Test / Assert
    expect(quaternion.x).toBe(1);
    expect(quaternion.y).toBe(2);
    expect(quaternion.z).toBe(3);
    expect(quaternion.w).toBe(4);
  });
  test("Calling toEuler() returns the correct result", () => {
    // Setup
    const quaternion = WellKnownQuaternions['90Y90Z']().quaternion;
    const expectedResult = WellKnownQuaternions['90Y90Z']().euler;

    const qz = Quaternion.fromAxisAngle(new Vector3(0, 0, 1), 90);
    const qy = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), 90);
    const mulResult = qz.multiply(qy);
    console.log(`[DEBUG] mulResult: ${mulResult}`);


    // Test
    const result = quaternion.toEuler();

    // Assert
    expectVectorsToBeEqual(result, expectedResult);
  });
  test("Calling multiplySelf() mutates correctly", () => {
    // Setup
    const quaternion = WellKnownQuaternions['90Z']().quaternion;
    const operand = WellKnownQuaternions['90Y']().quaternion;
    const expected = WellKnownQuaternions['90Y90Z']().quaternion;

    // Test
    quaternion.multiplySelf(operand);

    // Assert
    expectQuaternionsToBeEqual(quaternion, expected);
  });
  test("Calling multiply() returns the correct result", () => {
    // Setup
    const quaternion = WellKnownQuaternions['90Z']().quaternion;
    const qOriginal = quaternion.clone();
    const operand = WellKnownQuaternions['90Y']().quaternion;
    const expected = WellKnownQuaternions['90Y90Z']().quaternion;

    // Test
    const result = quaternion.multiply(operand);

    // Assert
    expectQuaternionsToBeEqual(result, expected);
    expectQuaternionsToBeEqual(quaternion, qOriginal);
  });
  test("Calling slerpSelf() mutates correctly", () => {
    // Setup
    const quaternion = Quaternion.identity();
    const target = WellKnownQuaternions['180Z']().quaternion;
    const expected = WellKnownQuaternions['90Z']().quaternion;

    // Test
    quaternion.slerpSelf(target, 0.5);

    // Assert
    expectQuaternionsToBeEqual(quaternion, expected);
  });
  test("Calling slerp() returns the correct result", () => {
    // Setup
    const quaternion = Quaternion.identity();
    const qOriginal = quaternion.clone();
    const target = WellKnownQuaternions['180Z']().quaternion;
    const expected = WellKnownQuaternions['90Z']().quaternion;

    // Test
    const result = quaternion.slerp(target, 0.5);

    // Assert
    expectQuaternionsToBeEqual(result, expected);
    expectQuaternionsToBeEqual(quaternion, qOriginal);
  });
  test("Calling invertSelf() mutates correctly", () => {
    // Setup
    const quaternion = WellKnownQuaternions['90X']().quaternion;
    const expectedResult = WellKnownQuaternions['-90X']().quaternion;

    // Test
    quaternion.invertSelf();

    // Assert
    expectQuaternionsToBeEqual(quaternion, expectedResult);
  });
  test("Calling invert() returns the correct result", () => {
    // Setup
    const quaternion = WellKnownQuaternions['90X']().quaternion;
    const qOriginal = quaternion.clone();
    const expectedResult = WellKnownQuaternions['-90X']().quaternion;

    // Test
    const result = quaternion.invert();

    // Assert
    expectQuaternionsToBeEqual(result, expectedResult);
    expectQuaternionsToBeEqual(quaternion, qOriginal);
  });
  test("Calling normalizeSelf() mutates correctly", () => {
    // Setup
    const quaternion = new Quaternion(1, 0, 0, 1);
    const expectedResult = new Quaternion(Math.SQRT1_2, 0, 0, Math.SQRT1_2);

    // Test
    quaternion.normalizeSelf();

    // Assert
    expectQuaternionsToBeEqual(quaternion, expectedResult);
  });
  test("Calling normalize() returns the correct result", () => {
    // Setup
    const quaternion = new Quaternion(1, 0, 0, 1);
    const qOriginal = quaternion.clone();
    const expectedResult = new Quaternion(Math.SQRT1_2, 0, 0, Math.SQRT1_2);

    // Test
    const result = quaternion.normalize();

    // Assert
    expectQuaternionsToBeEqual(result, expectedResult);
    expectQuaternionsToBeEqual(quaternion, qOriginal);
  });
  test("Calling setValue() with separate xyzw components mutates correctly", () => {
    // Setup
    const quaternion = Quaternion.identity();

    // Test
    quaternion.setValue(1, 2, 3, 4);

    // Assert
    expect(quaternion.x).toBe(1);
    expect(quaternion.y).toBe(2);
    expect(quaternion.z).toBe(3);
    expect(quaternion.w).toBe(4);
  });
  test("Calling setValue() with a Quaternion instance mutates correctly", () => {
    // Setup
    const quaternion = Quaternion.identity();
    const source = new Quaternion(1, 2, 3, 4);

    // Test
    quaternion.setValue(source);

    // Assert
    expect(quaternion.x).toBe(1);
    expect(quaternion.y).toBe(2);
    expect(quaternion.z).toBe(3);
    expect(quaternion.w).toBe(4);
  });
  test("Calling clone() returns the correct result", () => {
    // Setup
    const quaternion = new Quaternion(1, 2, 3, 4);

    // Test
    const result = quaternion.clone();

    // Assert
    expectQuaternionsToBeEqual(result, quaternion);
    expect(result).not.toBe(quaternion);
  });
  test("Calling rotateVectorInPlace() with a Vector3 mutates correctly", () => {
    // Setup
    const vector = Vector3.forward();
    const rotation = Quaternion.fromAxisAngle(Vector3.up(), 90);
    const expectedValue = Vector3.left();

    // Test
    rotation.rotateVectorInPlace(vector);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling rotateVector() with a Vector3 returns the correct result", () => {
    // Setup
    const vector = Vector3.forward();
    const original = vector.clone();
    const rotation = Quaternion.fromAxisAngle(Vector3.up(), 90);
    const expectedValue = Vector3.left();

    // Test
    const result = rotation.rotateVector(vector);

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });
  test("Calling Quaternion.identity() creates an identity Quaternion", () => {
    // Test
    const result = Quaternion.identity();

    // Assert
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.z).toBe(0);
    expect(result.w).toBe(1);
  });
  test("Calling Quaternion.fromAxisAngle() creates the correct Quaternion", () => {
    // Setup
    const expectedResult = WellKnownQuaternions['180Z']().quaternion;

    // Test
    const result = Quaternion.fromAxisAngle(Vector3.up(), 180);

    // Assert
    expectQuaternionsToBeEqual(expectedResult, result);
  });
  test("Calling Quaternion.fromEuler() with a Vector3 creates the correct Quaternion", () => {
    // Setup
    const euler = WellKnownQuaternions['90Y90Z']().euler;
    const expectedResult = WellKnownQuaternions['90Y90Z']().quaternion;

    // Test
    const result = Quaternion.fromEuler(euler);

    // Assert
    expectQuaternionsToBeEqual(result, expectedResult);
  });
  test("Calling Quaternion.fromEuler() with separate xyz components creates the correct Quaternion", () => {
    // Setup
    const euler = WellKnownQuaternions['90Y90Z']().euler;
    const expectedResult = WellKnownQuaternions['90Y90Z']().quaternion;

    // Test
    const result = Quaternion.fromEuler(euler.x, euler.y, euler.z);

    // Assert
    expectQuaternionsToBeEqual(result, expectedResult);
  });
  test("Calling Quaternion.fromLookDirection() with implicit up creates the correct Quaternion", () => {
    // Setup
    const forward = Vector3.forward();

    // Test
    const result = Quaternion.fromLookDirection(forward);

    // Assert
    expectQuaternionsToBeEqual(result, Quaternion.identity());
  });
  test("Calling Quaternion.fromLookDirection() with explicit up creates the correct Quaternion", () => {
    // Setup
    const forward = Vector3.down();
    const up = Vector3.forward();
    const expectedResult = WellKnownQuaternions['-90X']().quaternion;

    // Test
    const result = Quaternion.fromLookDirection(forward, up);

    // Assert
    expectQuaternionsToBeEqual(result, expectedResult);
  });
  test.each([
    '90X',
    '90Y',
    '90Z',
    '180Z',
    '90Y90Z',
    'identity',
  ] satisfies Array<keyof typeof WellKnownQuaternions>)("Sanity check of various toEuler()/fromEuler() round trips: Well-known quaternion \"%s\"", (testCase) => {
    const { quaternion, euler } = WellKnownQuaternions[testCase]();
    const qToEuler = quaternion.toEuler();
    const qToEulerToQ = Quaternion.fromEuler(qToEuler);

    const eulerToQ = Quaternion.fromEuler(euler);
    const eulerToQToEuler = eulerToQ.toEuler();

    expectVectorsToBeEqual(qToEuler, euler);
    expectQuaternionsToBeEqual(qToEulerToQ, quaternion);
    expectQuaternionsToBeEqual(eulerToQ, quaternion);
    expectVectorsToBeEqual(eulerToQToEuler, euler);
  });
});

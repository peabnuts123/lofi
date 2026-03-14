import { expectQuaternionsToBeEqual, expectVectorsToBeEqual } from '@test/util/expect';

import { describe, test, expect } from 'vitest';
import { Quaternion } from './quaternion';
import { Vector3 } from './vector';

/**
 * Quaternions can have somewhat obtuse values. This is a list of
 * quaternions and equivalent euler vectors that are known to be correct.
 */
const WellKnownResults = {
  /** Identity i.e. no rotation */
  ['identity']: () => ({
    quaternion: Quaternion.identity(),
    euler: Vector3.zero(),
  }),
  /** A rotation of 90 degrees around the Y axis and 90 degrees around the Z axis. */
  ['90Y90Z']: () => ({
    quaternion: new Quaternion(0.5, 0.5, 0.5, 0.5),
    euler: new Vector3(0, 90, 90),
  }),
  /** A rotation of 180 degrees around the Y axis. */
  ['180Y']: () => ({
    quaternion: new Quaternion(0, 1, 0, 0),
    euler: new Vector3(0, 180, 0),
  }),
  /** A rotation of 90 degrees around the X axis. */
  ['90X']: () => ({
    quaternion: new Quaternion(Math.SQRT1_2, 0, 0, Math.SQRT1_2),
    euler: new Vector3(90, 0, 0),
  }),
  /** A rotation of 90 degrees around the Y axis. */
  ['90Y']: () => ({
    quaternion: new Quaternion(0, Math.SQRT1_2, 0, Math.SQRT1_2),
    euler: new Vector3(0, 90, 0),
  }),
  /** A rotation of 90 degrees around the Z axis. */
  ['90Z']: () => ({
    quaternion: new Quaternion(0, 0, Math.SQRT1_2, Math.SQRT1_2),
    euler: new Vector3(0, 0, 90),
  }),
  /** A rotation of -90 degrees around the X axis. */
  ['-90X']: () => ({
    quaternion: new Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2),
    euler: new Vector3(90, 0, 0),
  }),
} satisfies Record<string, () => {
  quaternion: Quaternion;
  euler: Vector3;
}>;
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
      quaternion.setValue(Quaternion.identity());

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
    const quaternion = WellKnownResults['90Y90Z']().quaternion;
    const expectedResult = WellKnownResults['90Y90Z']().euler;

    // Test
    const result = quaternion.toEuler();

    // Assert
    expectVectorsToBeEqual(result, expectedResult);
  });
  test("Calling multiplySelf() mutates correctly", () => {
    // Setup
    const quaternion = WellKnownResults['90Y']().quaternion;
    const operand = WellKnownResults['90Z']().quaternion;
    const expected = WellKnownResults['90Y90Z']().quaternion;

    // Test
    quaternion.multiplySelf(operand);

    // Assert
    expectQuaternionsToBeEqual(quaternion, expected);
  });
  test("Calling multiply() returns the correct result", () => {
    // Setup
    const quaternion = WellKnownResults['90Y']().quaternion;
    const qOriginal = quaternion.clone();
    const operand = WellKnownResults['90Z']().quaternion;
    const expected = WellKnownResults['90Y90Z']().quaternion;

    // Test
    const result = quaternion.multiply(operand);

    // Assert
    expectQuaternionsToBeEqual(result, expected);
    expectQuaternionsToBeEqual(quaternion, qOriginal);
  });
  test("Calling slerpSelf() mutates correctly", () => {
    // Setup
    const quaternion = Quaternion.identity();
    const target = WellKnownResults['180Y']().quaternion;
    const expected = WellKnownResults['90Y']().quaternion;

    // Test
    quaternion.slerpSelf(target, 0.5);

    // Assert
    expectQuaternionsToBeEqual(quaternion, expected);
  });
  test("Calling slerp() returns the correct result", () => {
    // Setup
    const quaternion = Quaternion.identity();
    const qOriginal = quaternion.clone();
    const target = WellKnownResults['180Y']().quaternion;
    const expected = WellKnownResults['90Y']().quaternion;

    // Test
    const result = quaternion.slerp(target, 0.5);

    // Assert
    expectQuaternionsToBeEqual(result, expected);
    expectQuaternionsToBeEqual(quaternion, qOriginal);
  });
  test("Calling invertSelf() mutates correctly", () => {
    // Setup
    const quaternion = WellKnownResults['90X']().quaternion;
    const expectedResult = WellKnownResults['-90X']().quaternion;

    // Test
    quaternion.invertSelf();

    // Assert
    expectQuaternionsToBeEqual(quaternion, expectedResult);
  });
  test("Calling invert() returns the correct result", () => {
    // Setup
    const quaternion = WellKnownResults['90X']().quaternion;
    const qOriginal = quaternion.clone();
    const expectedResult = WellKnownResults['-90X']().quaternion;

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
    const expectedResult = WellKnownResults['180Y']().quaternion;

    // Test
    const result = Quaternion.fromAxisAngle(Vector3.up(), 180);

    // Assert
    expectQuaternionsToBeEqual(expectedResult, result);
  });
  test("Calling Quaternion.fromEuler() with a Vector3 creates the correct Quaternion", () => {
    // Setup
    const euler = WellKnownResults['90Y90Z']().euler;
    const expectedResult = WellKnownResults['90Y90Z']().quaternion;

    // Test
    const result = Quaternion.fromEuler(euler);

    // Assert
    expectQuaternionsToBeEqual(result, expectedResult);
  });
  test("Calling Quaternion.fromEuler() with separate xyz components creates the correct Quaternion", () => {
    // Setup
    const euler = WellKnownResults['90Y90Z']().euler;
    const expectedResult = WellKnownResults['90Y90Z']().quaternion;

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
    const expectedResult = WellKnownResults['-90X']().quaternion;

    // Test
    const result = Quaternion.fromLookDirection(forward, up);

    // Assert
    expectQuaternionsToBeEqual(result, expectedResult);
  });
});

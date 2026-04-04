import { expectQuaternionsToBeEqual, expectVectorsToBeEqual } from '@test/util/expect';

import { describe, test, expect } from 'vitest';
import { Rotation } from './Rotation';
import { Quaternion } from './quaternion';
import { Vector3 } from './vector';

describe("Rotation", () => {
  describe("Observability", () => {
    test("Mutating q marks euler and inverse dirty, recomputes them lazily", () => {
      // Setup
      const rotation = new Rotation();
      const updatedValue = Quaternion.fromAxisAngle(Vector3.up(), 180);
      const expectedInverse = updatedValue.invert();
      const expectedEuler = new Vector3(0, 180, 0);

      // Test
      rotation.q.setValue(updatedValue);
      /* Read internal state - @NOTE spy on private values */
      const inverseIsDirty = rotation['_qInverse']['isDirty'];
      const inverseValue = rotation['_qInverse']['_value'].clone();
      const eulerIsDirty = rotation['_euler']['isDirty'];
      const eulerValue = rotation['_euler']['_value'].clone();

      /* Read values, force recompute */
      const updatedInverse = rotation.qInverse.clone();
      const updatedEuler = rotation.euler.clone();
      /* Re-read internal state - @NOTE spy on private values */
      const inverseIsDirtyAfterRead = rotation['_qInverse']['isDirty'];
      const inverseValueAfterRead = rotation['_qInverse']['_value'].clone();
      const eulerIsDirtyAfterRead = rotation['_euler']['isDirty'];
      const eulerValueAfterRead = rotation['_euler']['_value'].clone();

      // Assert
      expect(inverseIsDirty).toBe(true);
      expectQuaternionsToBeEqual(inverseValue, Quaternion.identity());
      expect(eulerIsDirty).toBe(true);
      expectVectorsToBeEqual(eulerValue, Vector3.zero());
      expectQuaternionsToBeEqual(updatedInverse, expectedInverse);
      expectVectorsToBeEqual(updatedEuler, expectedEuler);
      expect(inverseIsDirtyAfterRead).toBe(false);
      expectQuaternionsToBeEqual(inverseValueAfterRead, expectedInverse);
      expect(eulerIsDirtyAfterRead).toBe(false);
      expectVectorsToBeEqual(eulerValueAfterRead, expectedEuler);
    });
    test("Mutating euler immediately recomputes q, marks inverse dirty, recomputes it lazily", () => {
      // Setup
      const rotation = new Rotation();
      // const updatedValue = Quaternion.fromAxisAngle(Vector3.up(), 180);
      const updatedValue = new Vector3(10, 20, 30);
      const expectedQuaternion = Quaternion.fromEuler(updatedValue);
      const expectedInverse = expectedQuaternion.invert();

      // Test
      rotation.euler.setValue(updatedValue);
      /* Read internal state - @NOTE spy on private values */
      const inverseIsDirty = rotation['_qInverse']['isDirty'];
      const inverseValue = rotation['_qInverse']['_value'].clone();

      /* Read values, force recompute */
      const updatedQuaternion = rotation.q.clone();
      const updatedInverse = rotation.qInverse.clone();
      // const updatedEuler = rotation.euler;
      /* Re-read internal state - @NOTE spy on private values */
      const inverseIsDirtyAfterRead = rotation['_qInverse']['isDirty'];
      const inverseValueAfterRead = rotation['_qInverse']['_value'].clone();

      // Assert
      expect(inverseIsDirty).toBe(true);
      expectQuaternionsToBeEqual(inverseValue, Quaternion.identity());
      expectQuaternionsToBeEqual(updatedQuaternion, expectedQuaternion);
      expectQuaternionsToBeEqual(updatedInverse, expectedInverse);
      expect(inverseIsDirtyAfterRead).toBe(false);
      expectQuaternionsToBeEqual(inverseValueAfterRead, expectedInverse);
    });
    test("Mutating q fires onChange() once", () => {
      // Setup
      const rotation = new Rotation();
      let timesOnChangeCalled = 0;
      rotation.onChange(() => timesOnChangeCalled++);

      // Test
      rotation.q.setValue(Quaternion.fromAxisAngle(Vector3.up(), 180));

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Setting q fires onChange() once", () => {
      // Setup
      const rotation = new Rotation();
      let timesOnChangeCalled = 0;
      rotation.onChange(() => timesOnChangeCalled++);

      // Test
      rotation.q = Quaternion.fromAxisAngle(Vector3.up(), 180);

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Muting euler fires onChange() once", () => {
      // Setup
      const rotation = new Rotation();
      let timesOnChangeCalled = 0;
      rotation.onChange(() => timesOnChangeCalled++);

      // Test
      rotation.euler.setValue(new Vector3(10, 20, 30));

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Setting euler fires onChange() once", () => {
      // Setup
      const rotation = new Rotation();
      let timesOnChangeCalled = 0;
      rotation.onChange(() => timesOnChangeCalled++);

      // Test
      rotation.euler = new Vector3(10, 20, 30);

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Setting {x,y,z} fires onChange() separately", () => {
      // Setup
      const rotation = new Rotation();
      let timesOnChangeCalled = 0;
      rotation.onChange(() => timesOnChangeCalled++);

      const timesOnChangeCalledInitial = timesOnChangeCalled;

      // Test
      rotation.x = 10;
      const timesOnChangeCalledAfterX = timesOnChangeCalled;
      rotation.y = 20;
      const timesOnChangeCalledAfterY = timesOnChangeCalled;
      rotation.z = 30;
      const timesOnChangeCalledAfterZ = timesOnChangeCalled;

      // Assert
      expect(timesOnChangeCalledInitial).toBe(0);
      expect(timesOnChangeCalledAfterX).toBe(1);
      expect(timesOnChangeCalledAfterY).toBe(2);
      expect(timesOnChangeCalledAfterZ).toBe(3);
    });
    test("Mutating qInverse does not fire onChange()", () => {
      // Setup
      const rotation = new Rotation();
      let timesOnChangeCalled = 0;
      rotation.onChange(() => timesOnChangeCalled++);

      // Test
      rotation.qInverse.setValue(10, 20, 30, 40)
        .invertSelf()
        .normalizeSelf();

      // Assert
      expect(timesOnChangeCalled).toBe(0);
    });
    test("Calling multiply() fires onChange() once", () => {
      // Setup
      const rotation = new Rotation();
      let timesOnChangeCalled = 0;
      rotation.onChange(() => timesOnChangeCalled++);

      // Test
      rotation.multiply(Quaternion.fromAxisAngle(Vector3.up(), 180));

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling slerp() fires onChange() once", () => {
      // Setup
      const rotation = new Rotation();
      let timesOnChangeCalled = 0;
      rotation.onChange(() => timesOnChangeCalled++);

      // Test
      rotation.slerp(Quaternion.fromAxisAngle(Vector3.up(), 180), 0.5);

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling set() with a quaternion fires onChange() once", () => {
      // Setup
      const rotation = new Rotation();
      let timesOnChangeCalled = 0;
      rotation.onChange(() => timesOnChangeCalled++);

      // Test
      rotation.set(Quaternion.fromAxisAngle(Vector3.up(), 180));

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling set with separate xyz components fires onChange() once", () => {
      // Setup
      const rotation = new Rotation();
      let timesOnChangeCalled = 0;
      rotation.onChange(() => timesOnChangeCalled++);

      // Test
      rotation.set(10, 20, 30);

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling set with a partial Vector3Like fires onChange() once", () => {
      // Setup
      const rotation = new Rotation();
      let timesOnChangeCalled = 0;
      rotation.onChange(() => timesOnChangeCalled++);

      // Test
      rotation.set({ x: 30, z: 15 });

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
  });
  test("New instance is created with identity", () => {
    // Setup
    const rotation = new Rotation();

    // Test / Assert
    expectQuaternionsToBeEqual(rotation.q, Quaternion.identity());
    expectQuaternionsToBeEqual(rotation.qInverse, Quaternion.identity().invertSelf());
    expectVectorsToBeEqual(rotation.euler, Vector3.zero());
    expect(rotation.x).toBe(0);
    expect(rotation.y).toBe(0);
    expect(rotation.z).toBe(0);
  });
  test("Calling multiply() mutates correctly", () => {
    // Setup
    const rotation = new Rotation();
    const operand = Quaternion.fromAxisAngle(Vector3.up(), 180);
    const expectedQuaternion = new Quaternion(0, 1, 0, 0);
    const expectedInverse = expectedQuaternion.invert();
    const expectedEuler = new Vector3(0, 180, 0);

    // Test
    rotation.multiply(operand);

    // Assert
    expectQuaternionsToBeEqual(rotation.q, expectedQuaternion);
    expectQuaternionsToBeEqual(rotation.qInverse, expectedInverse);
    expectVectorsToBeEqual(rotation.euler, expectedEuler);
  });
  test("Calling slerp() mutates correctly", () => {
    // Setup
    const rotation = new Rotation();
    const operand = Quaternion.fromAxisAngle(Vector3.up(), 180);
    const expectedQuaternion = Quaternion.fromAxisAngle(Vector3.up(), 90);
    const expectedInverse = expectedQuaternion.invert();
    const expectedEuler = new Vector3(0, 90, 0);

    // Test
    rotation.slerp(operand, 0.5);

    // Assert
    expectQuaternionsToBeEqual(rotation.q, expectedQuaternion);
    expectQuaternionsToBeEqual(rotation.qInverse, expectedInverse);
    expectVectorsToBeEqual(rotation.euler, expectedEuler);
  });
  test("Calling set() with a quaternion mutates correctly", () => {
    // Setup
    const rotation = new Rotation();
    const quaternion = Quaternion.fromAxisAngle(Vector3.up(), 90);
    const expectedInverse = quaternion.invert();
    const expectedEuler = new Vector3(0, 90, 0);

    // Test
    rotation.set(quaternion);

    // Assert
    expect(rotation.q).not.toBe(quaternion); // Should not be the same exact instance
    expectQuaternionsToBeEqual(rotation.q, quaternion);
    expectQuaternionsToBeEqual(rotation.qInverse, expectedInverse);
    expectVectorsToBeEqual(rotation.euler, expectedEuler);
  });
  test("Calling set() with separate xyz components mutates correctly", () => {
    // Setup
    const rotation = new Rotation();
    const euler = new Vector3(10, 20, 30);
    const expectedQuaternion = Quaternion.fromEuler(euler);
    const expectedInverse = expectedQuaternion.invert();

    // Test
    rotation.set(euler.x, euler.y, euler.z);

    // Assert
    expectQuaternionsToBeEqual(rotation.q, expectedQuaternion);
    expectQuaternionsToBeEqual(rotation.qInverse, expectedInverse);
    expectVectorsToBeEqual(rotation.euler, euler);
  });
  test("Calling set() with a partial Vector3Like mutates correctly", () => {
    // Setup
    const initialValue = { x: 10, y: 20, z: 30 };
    const rotation = new Rotation();
    rotation.q = Quaternion.fromEuler(initialValue.x, initialValue.y, initialValue.z);
    const update = { x: 90, z: 15 };
    const expectedEuler = new Vector3(update.x, initialValue.y, update.z);
    const expectedQuaternion = Quaternion.fromEuler(expectedEuler);
    const expectedInverse = expectedQuaternion.invert();

    // Test
    rotation.set(update);

    // Assert
    expectQuaternionsToBeEqual(rotation.q, expectedQuaternion);
    expectQuaternionsToBeEqual(rotation.qInverse, expectedInverse);
    expectVectorsToBeEqual(rotation.euler, expectedEuler);
  });
  test("Setting euler mutates correctly", () => {
    // Setup
    const rotation = new Rotation();
    const operand = new Vector3(10, 20, 30);
    const expectedQuaternion = Quaternion.fromEuler(operand);
    const expectedInverse = expectedQuaternion.invert();

    // Test
    rotation.euler = operand;

    // Assert
    expectQuaternionsToBeEqual(rotation.q, expectedQuaternion);
    expectQuaternionsToBeEqual(rotation.qInverse, expectedInverse);
    expectVectorsToBeEqual(rotation.euler, operand);
  });
  test("Mutating euler mutates correctly", () => {
    // Setup
    const rotation = new Rotation();
    const updatedXValue = 20;
    const expectedEuler = Vector3.zero().setX(updatedXValue);
    const expectedQuaternion = Quaternion.fromEuler(expectedEuler);
    const expectedInverse = expectedQuaternion.invert();

    // Test
    rotation.euler.x = updatedXValue;

    // Assert
    expectQuaternionsToBeEqual(rotation.q, expectedQuaternion);
    expectQuaternionsToBeEqual(rotation.qInverse, expectedInverse);
    expectVectorsToBeEqual(rotation.euler, expectedEuler);
  });
  test("Setting {x,y,z} mutates correctly", () => {
    // Setup
    const rotation = new Rotation();
    // const updatedXValue = 20;
    const updatedEulerAngles = new Vector3(10, 20, 30);
    /* After X update */
    const expectedEulerAfterXUpdate = Vector3.zero().setX(updatedEulerAngles.x);
    const expectedQuaternionAfterXUpdate = Quaternion.fromEuler(expectedEulerAfterXUpdate);
    const expectedInverseAfterXUpdate = expectedQuaternionAfterXUpdate.invert();
    /* After Y update */
    const expectedEulerAfterYUpdate = expectedEulerAfterXUpdate.clone().setY(updatedEulerAngles.y);
    const expectedQuaternionAfterYUpdate = Quaternion.fromEuler(expectedEulerAfterYUpdate);
    const expectedInverseAfterYUpdate = expectedQuaternionAfterYUpdate.invert();
    /* After Z update */
    const expectedEulerAfterZUpdate = expectedEulerAfterYUpdate.clone().setZ(updatedEulerAngles.z);
    const expectedQuaternionAfterZUpdate = Quaternion.fromEuler(expectedEulerAfterZUpdate);
    const expectedInverseAfterZUpdate = expectedQuaternionAfterZUpdate.invert();

    // Test
    /* X update */
    rotation.x = updatedEulerAngles.x;
    const actualQuaternionAfterXUpdate = rotation.q.clone();
    const actualInverseAfterXUpdate = rotation.qInverse.clone();
    const actualEulerAfterXUpdate = rotation.euler.clone();
    /* Y update */
    rotation.y = updatedEulerAngles.y;
    const actualQuaternionAfterYUpdate = rotation.q.clone();
    const actualInverseAfterYUpdate = rotation.qInverse.clone();
    const actualEulerAfterYUpdate = rotation.euler.clone();
    /* Z update */
    rotation.z = updatedEulerAngles.z;
    const actualQuaternionAfterZUpdate = rotation.q.clone();
    const actualInverseAfterZUpdate = rotation.qInverse.clone();
    const actualEulerAfterZUpdate = rotation.euler.clone();

    // Assert
    expectQuaternionsToBeEqual(actualQuaternionAfterXUpdate, expectedQuaternionAfterXUpdate);
    expectQuaternionsToBeEqual(actualInverseAfterXUpdate, expectedInverseAfterXUpdate);
    expectVectorsToBeEqual(actualEulerAfterXUpdate, expectedEulerAfterXUpdate);

    expectQuaternionsToBeEqual(actualQuaternionAfterYUpdate, expectedQuaternionAfterYUpdate);
    expectQuaternionsToBeEqual(actualInverseAfterYUpdate, expectedInverseAfterYUpdate);
    expectVectorsToBeEqual(actualEulerAfterYUpdate, expectedEulerAfterYUpdate);

    expectQuaternionsToBeEqual(actualQuaternionAfterZUpdate, expectedQuaternionAfterZUpdate);
    expectQuaternionsToBeEqual(actualInverseAfterZUpdate, expectedInverseAfterZUpdate);
    expectVectorsToBeEqual(actualEulerAfterZUpdate, expectedEulerAfterZUpdate);
  });
  test("Setting q mutates correctly", () => {
    // Setup
    const rotation = new Rotation();
    const expectedEuler = new Vector3(10, 20, 30);
    const quaternion = Quaternion.fromEuler(expectedEuler);
    const expectedInverse = quaternion.invert();

    // Test
    rotation.q = quaternion;

    // Assert
    expectQuaternionsToBeEqual(rotation.q, quaternion);
    expectQuaternionsToBeEqual(rotation.qInverse, expectedInverse);
    expectVectorsToBeEqual(rotation.euler, expectedEuler);
  });
  test("Mutating q mutates correctly", () => {
    // Setup
    const rotation = new Rotation();
    const expectedEuler = new Vector3(10, 20, 30);
    const expectedQuaternion = Quaternion.fromEuler(expectedEuler);
    const expectedInverse = expectedQuaternion.invert();

    // Test
    rotation.q.setValue(expectedQuaternion);

    // Assert
    expectQuaternionsToBeEqual(rotation.q, expectedQuaternion);
    expectQuaternionsToBeEqual(rotation.qInverse, expectedInverse);
    expectVectorsToBeEqual(rotation.euler, expectedEuler);
  });
  test("Mutating qInverse has no effect", () => {
    // Setup
    const rotation = new Rotation();
    const expectedQuaternion = Quaternion.identity();
    const expectedInverse = Quaternion.identity().invertSelf();
    const expectedEuler = Vector3.zero();

    // Test
    rotation.qInverse
      .slerpSelf(Quaternion.fromAxisAngle(Vector3.up(), 117), 0.5)
      .invertSelf()
      .multiplySelf(Quaternion.fromAxisAngle(Vector3.forward(), 67));

    // Assert
    expectQuaternionsToBeEqual(rotation.q, expectedQuaternion);
    expectQuaternionsToBeEqual(rotation.qInverse, expectedInverse);
    expectVectorsToBeEqual(rotation.euler, expectedEuler);
  });
  test("Euler angles are always within (-360, 360)", () => {
    // Setup
    const rotation = new Rotation();

    // Test
    rotation.x = 450;
    rotation.y = -450;
    rotation.z = 360;

    // Assert
    expect(rotation.x).toBe(90);
    expect(rotation.y).toBe(-90);
    expect(rotation.z).toBe(0);
  });
});




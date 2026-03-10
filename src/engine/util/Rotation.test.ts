import { describe, test, expect } from 'vitest';
import { Rotation } from './Rotation';
import { Quaternion, ReadOnlyQuaternion } from './quaternion';
import { EulerVector3, Vector3, type Vector3Definition } from './vector';
import type { Computed, WritableComputed } from './observable';

describe("Rotation", () => {
  test("New instance is created with identity", () => {
    // Setup
    const Identity = Quaternion.identity();

    // Test
    const rotation = new MockRotation();

    // Assert
    expectQuaternionsToBeEqual(rotation.q, Identity);
    expectQuaternionsToBeEqual(rotation.qInverse, Identity.invert());
    expectVectorsToBeEqual(rotation.euler, Vector3.zero());
  });

  test("Multiplying by a quaternion updates values", () => {
    // Setup
    const rotation = new MockRotation();
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

  test("Slerping to a quaternion updates values", () => {
    // Setup
    const rotation = new MockRotation();
    const target = Quaternion.fromAxisAngle(Vector3.up(), 180);
    const expectedQuaternion = Quaternion.fromAxisAngle(Vector3.up(), 90);
    const expectedInverse = expectedQuaternion.invert();
    const expectedEuler = new Vector3(0, 90, 0);

    // Test
    rotation.slerp(target, 0.5);

    // Assert
    expectQuaternionsToBeEqual(rotation.q, expectedQuaternion);
    expectQuaternionsToBeEqual(rotation.qInverse, expectedInverse);
    expectVectorsToBeEqual(rotation.euler, expectedEuler);
  });

  test("Setting the quaternion updates values", () => {
    // Setup
    const rotation = new MockRotation();
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

  test("Setting euler values updates values", () => {
    // Setup
    const rotation = new MockRotation();
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

  test("Partial euler update updates values", () => {
    // Setup
    const initialValue = { x: 10, y: 20, z: 30 };
    const rotation = new MockRotation({ initialValue });
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

  test("Modifying q marks euler and inverse as dirty, does not recompute them", () => {
    // Setup
    const rotation = new MockRotation();
    const quaternion = Quaternion.fromAxisAngle(Vector3.up(), 90);
    const initialEulerIsDirty = rotation.getEulerIsDirty();
    const initialInverseIsDirty = rotation.getQInverseIsDirty();
    const initialEuler = rotation.getEuler();
    const initialInverse = rotation.getQInverse();
    const expectedEuler = Vector3.zero();
    const expectedInverse = Quaternion.identity().invert();

    // Test
    rotation.set(quaternion);
    const updatedEulerIsDirty = rotation.getEulerIsDirty();
    const updatedInverseIsDirty = rotation.getQInverseIsDirty();
    const updatedEuler = rotation.getEuler();
    const updatedInverse = rotation.getQInverse();

    // Assert
    expect(initialEulerIsDirty).toBe(false);
    expect(initialInverseIsDirty).toBe(false);
    expectVectorsToBeEqual(initialEuler, expectedEuler);
    expectQuaternionsToBeEqual(initialInverse, expectedInverse);

    expect(updatedEulerIsDirty).toBe(true);
    expect(updatedInverseIsDirty).toBe(true);
    expectVectorsToBeEqual(updatedEuler, expectedEuler);
    expectQuaternionsToBeEqual(updatedInverse, expectedInverse);
  });

  test("Modifying euler immediately recomputes quaternion and marks inverse as dirty, but does not recompute it", () => {
    // Setup
    const rotation = new MockRotation();
    const euler = new Vector3(10, 20, 30);
    const expectedQuaternion = Quaternion.fromEuler(euler);
    const expectedInverse = Quaternion.identity().invert();
    const initialQuaternion = rotation.q.clone();
    const initialInverse = rotation.getQInverse().clone();
    const initialInverseIsDirty = rotation.getQInverseIsDirty();

    // Test
    rotation.set(euler);
    const updatedQuaternion = rotation.q.clone();
    const updatedInverse = rotation.getQInverse().clone();
    const updatedInverseIsDirty = rotation.getQInverseIsDirty();

    // Assert
    expectQuaternionsToBeEqual(initialQuaternion, Quaternion.identity());
    expectQuaternionsToBeEqual(initialInverse, expectedInverse);
    expect(initialInverseIsDirty).toBe(false);

    expectQuaternionsToBeEqual(updatedQuaternion, expectedQuaternion);
    expectQuaternionsToBeEqual(updatedInverse, expectedInverse);
    expect(updatedInverseIsDirty).toBe(true);
  });

  test("Modifying the inverse has no effect", () => {
    // Setup
    const rotation = new MockRotation({
      initialValue: { x: 10, y: 20, z: 30 },
    });
    const initialQuaternion = rotation.q.clone();
    const initialInverse = rotation.getQInverse().clone();
    const initialEuler = rotation.getEuler().clone();
    const initialEulerIsDirty = rotation.getEulerIsDirty();
    const initialInverseIsDirty = rotation.getQInverseIsDirty();


    // Test
    /* Modify inverse in various ways */
    rotation.qInverse.setValue(1, 2, 3, 4);
    rotation.qInverse.x = 10;
    rotation.qInverse.y = 11;
    rotation.qInverse.z = 12;
    rotation.qInverse.w = 13;
    const updatedQuaternion = rotation.q.clone();
    const updatedInverse = rotation.getQInverse().clone();
    const updatedEuler = rotation.getEuler().clone();
    const updatedEulerIsDirty = rotation.getEulerIsDirty();
    const updatedInverseIsDirty = rotation.getQInverseIsDirty();

    // Assert
    expectQuaternionsToBeEqual(initialQuaternion, updatedQuaternion);
    expectQuaternionsToBeEqual(initialInverse, updatedInverse);
    expectVectorsToBeEqual(initialEuler, updatedEuler);
    expect(initialEulerIsDirty).toBe(false);
    expect(initialInverseIsDirty).toBe(false);
    expect(updatedEulerIsDirty).toBe(false);
    expect(updatedInverseIsDirty).toBe(false);
  });

  describe("onChange callbacks", () => {
    test("Calling multiply() fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });
      const operand = Quaternion.fromAxisAngle(Vector3.up(), 90);

      // Test
      rotation.multiply(operand);

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Calling slerp() fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });
      const operand = Quaternion.fromAxisAngle(Vector3.up(), 90);

      // Test
      rotation.slerp(operand, 0.5);

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Calling set() with Quaternion fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });
      const operand = Quaternion.fromAxisAngle(Vector3.up(), 90);

      // Test
      rotation.set(operand);

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Calling set() with euler angles fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });

      // Test
      rotation.set(10, 20, 30);

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Calling set() with partial euler angles fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });

      // Test
      rotation.set({ x: 10, z: 20 });

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Setting x fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });

      // Test
      rotation.x = 10;

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Setting y fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });

      // Test
      rotation.y = 10;

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Setting z fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });

      // Test
      rotation.z = 10;

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Setting euler.x fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });

      // Test
      rotation.euler.x = 10;

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Setting euler.y fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });

      // Test
      rotation.euler.y = 10;

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Setting euler.z fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });

      // Test
      rotation.euler.z = 10;

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Calling euler.addSelf() fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });

      // Test
      rotation.getEuler().addSelf(new Vector3(10, 20, 30));

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Calling euler.subtractSelf() fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });

      // Test
      rotation.euler.subtractSelf(new Vector3(10, 20, 30));

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Calling euler.multiplySelf(number) fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });

      // Test
      rotation.euler.multiplySelf(5);

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Calling euler.multiplySelf(vector) fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });

      // Test
      rotation.euler.multiplySelf(new Vector3(1, 2, 3));

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Calling euler.divideSelf(number) fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });

      // Test
      rotation.euler.divideSelf(2);

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Calling euler.divideSelf(vector) fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });

      // Test
      rotation.euler.divideSelf(new Vector3(1, 2, 3));

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Calling euler.normalizeSelf fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });

      // Test
      rotation.euler.normalizeSelf();

      // Assert
      expect(onChangeCount).toBe(1);
    });
    test("Calling euler.crossSelf fires onChange only once", () => {
      // Setup
      let onChangeCount = 0;
      const rotation = new MockRotation({
        initialValue: { x: 10, y: 20, z: 30 },
        onChange: () => onChangeCount++,
      });

      // Test
      rotation.euler.crossSelf(new Vector3(1, 2, 3));

      // Assert
      expect(onChangeCount).toBe(1);
    });
  });

  function expectQuaternionsToBeEqual(q1: Quaternion, q2: Quaternion): void {
    expect(q1.x).toBeCloseTo(q2.x, 8);
    expect(q1.y).toBeCloseTo(q2.y, 8);
    expect(q1.z).toBeCloseTo(q2.z, 8);
    expect(q1.w).toBeCloseTo(q2.w, 8);
  }
  function expectVectorsToBeEqual(v1: Vector3, v2: Vector3): void {
    expect(v1.x).toBeCloseTo(v2.x, 8);
    expect(v1.y).toBeCloseTo(v2.y, 8);
    expect(v1.z).toBeCloseTo(v2.z, 8);
  }
});


interface MockRotationConstructorArgs {
  initialValue?: Vector3Definition;
  onChange?: () => void;
}


/* @TODO We should refactor these tests to make more sense under new computed mechanisms */
class MockRotation extends Rotation {
  public constructor({ initialValue, onChange }: MockRotationConstructorArgs = {}) {
    super();
    if (initialValue !== undefined) {
      this.euler.setValue(initialValue);
    }
    // @NOTE Force evaluation of initial values
    // @TODO Kind of a hack
    const _q = this.q;
    const _qInverse = this.qInverse;
    const _euler = this.euler;

    if (onChange) {
      this.q.onChange(onChange);
    }
  }

  public getEulerIsDirty(): boolean {
    return this['_euler']['isDirty'];
  }
  public getEuler(): EulerVector3 {
    return this['_euler']['_value'];
  }
  public getEulerComputed(): WritableComputed<EulerVector3> {
    return this['_euler'];
  }

  public getQInverseIsDirty(): boolean {
    return this['_qInverse']['isDirty'];
  }
  public getQInverse(): ReadOnlyQuaternion {
    return this['_qInverse']['_value'];
  }
  public getQInverseComputed(): Computed<ReadOnlyQuaternion> {
    return this['_qInverse'];
  }
}

import { describe, test, expect } from 'vitest';
import { Rotation, type RotationOnChangeCallback } from './Rotation';
import { Quaternion } from './quaternion';
import { Vector3, type DirtyVector3, type Vector3Definition } from './vector';

describe("Rotation", () => {
  test("New instance is created with identity", () => {
    // Setup
    const identity = Quaternion.identity();

    // Test
    const rotation = new MockRotation();

    // Assert
    expectQuaternionsToBeEqual(rotation.q, identity);
    expectQuaternionsToBeEqual(rotation.qConjugate, identity.conjugate());
    expectVectorsToBeEqual(rotation.euler, Vector3.zero());
  });

  test("Multiplying by a quaternion updates values", () => {
    // Setup
    const rotation = new MockRotation();
    const operand = Quaternion.fromAxisAngle(Vector3.up(), 180);
    const expectedQuaternion = new Quaternion(0, 1, 0, 0);
    const expectedConjugate = expectedQuaternion.conjugate();
    const expectedEuler = new Vector3(0, 180, 0);

    // Test
    rotation.multiply(operand);

    // Assert
    expectQuaternionsToBeEqual(rotation.q, expectedQuaternion);
    expectQuaternionsToBeEqual(rotation.qConjugate, expectedConjugate);
    expectVectorsToBeEqual(rotation.euler, expectedEuler);
  });

  test("Slerping to a quaternion updates values", () => {
    // Setup
    const rotation = new MockRotation();
    const target = Quaternion.fromAxisAngle(Vector3.up(), 180);
    const expectedQuaternion = Quaternion.fromAxisAngle(Vector3.up(), 90);
    const expectedConjugate = expectedQuaternion.conjugate();
    const expectedEuler = new Vector3(0, 90, 0);

    // Test
    rotation.slerp(target, 0.5);

    // Assert
    expectQuaternionsToBeEqual(rotation.q, expectedQuaternion);
    expectQuaternionsToBeEqual(rotation.qConjugate, expectedConjugate);
    expectVectorsToBeEqual(rotation.euler, expectedEuler);
  });

  test("Setting the quaternion updates values", () => {
    // Setup
    const rotation = new MockRotation();
    const quaternion = Quaternion.fromAxisAngle(Vector3.up(), 90);
    const expectedConjugate = quaternion.conjugate();
    const expectedEuler = new Vector3(0, 90, 0);

    // Test
    rotation.set(quaternion);

    // Assert
    expect(rotation.q).not.toBe(quaternion); // Should not be the same exact instance
    expectQuaternionsToBeEqual(rotation.q, quaternion);
    expectQuaternionsToBeEqual(rotation.qConjugate, expectedConjugate);
    expectVectorsToBeEqual(rotation.euler, expectedEuler);
  });

  test("Setting euler values updates values", () => {
    // Setup
    const rotation = new MockRotation();
    const euler = new Vector3(10, 20, 30);
    const expectedQuaternion = Quaternion.fromEuler(euler);
    const expectedConjugate = expectedQuaternion.conjugate();

    // Test
    rotation.set(euler.x, euler.y, euler.z);

    // Assert
    expectQuaternionsToBeEqual(rotation.q, expectedQuaternion);
    expectQuaternionsToBeEqual(rotation.qConjugate, expectedConjugate);
    expectVectorsToBeEqual(rotation.euler, euler);
  });

  test("Partial euler update updates values", () => {
    // Setup
    const initialValue = { x: 10, y: 20, z: 30 };
    const rotation = new MockRotation({ initialValue });
    // const euler = new Vector3(10, 20, 30);
    const update = { x: 90, z: 15 };
    const expectedEuler = new Vector3(update.x, initialValue.y, update.z);
    const expectedQuaternion = Quaternion.fromEuler(expectedEuler);
    const expectedConjugate = expectedQuaternion.conjugate();

    // Test
    rotation.set(update);

    // Assert
    expectQuaternionsToBeEqual(rotation.q, expectedQuaternion);
    expectQuaternionsToBeEqual(rotation.qConjugate, expectedConjugate);
    expectVectorsToBeEqual(rotation.euler, expectedEuler);
  });

  test("Modifying q marks euler and conjugate as dirty, does not recompute them", () => {
    // Setup
    const rotation = new MockRotation();
    const quaternion = Quaternion.fromAxisAngle(Vector3.up(), 90);
    const initialEulerIsDirty = rotation.getEulerIsDirty();
    const initialConjugateIsDirty = rotation.getQConjugateIsDirty();
    const initialEuler = rotation.getEuler();
    const initialConjugate = rotation.getQConjugate();
    const expectedEuler = Vector3.zero();
    const expectedConjugate = Quaternion.identity().conjugate();

    // Test
    rotation.set(quaternion);
    const updatedEulerIsDirty = rotation.getEulerIsDirty();
    const updatedConjugateIsDirty = rotation.getQConjugateIsDirty();
    const updatedEuler = rotation.getEuler();
    const updatedConjugate = rotation.getQConjugate();

    // Assert
    expect(initialEulerIsDirty).toBe(false);
    expect(initialConjugateIsDirty).toBe(false);
    expectVectorsToBeEqual(initialEuler, expectedEuler);
    expectQuaternionsToBeEqual(initialConjugate, expectedConjugate);

    expect(updatedEulerIsDirty).toBe(true);
    expect(updatedConjugateIsDirty).toBe(true);
    expectVectorsToBeEqual(updatedEuler, expectedEuler);
    expectQuaternionsToBeEqual(updatedConjugate, expectedConjugate);
  });

  test("Modifying euler immediately recomputes quaternion and marks conjugate as dirty, but does not recompute it", () => {
    // Setup
    const rotation = new MockRotation();
    const euler = new Vector3(10, 20, 30);
    const expectedQuaternion = Quaternion.fromEuler(euler);
    const expectedConjugate = Quaternion.identity().conjugate();
    const initialQuaternion = rotation.q.clone();
    const initialConjugate = rotation.getQConjugate().clone();
    const initialConjugateIsDirty = rotation.getQConjugateIsDirty();

    // Test
    rotation.set(euler);
    const updatedQuaternion = rotation.q.clone();
    const updatedConjugate = rotation.getQConjugate().clone();
    const updatedConjugateIsDirty = rotation.getQConjugateIsDirty();

    // Assert
    expectQuaternionsToBeEqual(initialQuaternion, Quaternion.identity());
    expectQuaternionsToBeEqual(initialConjugate, expectedConjugate);
    expect(initialConjugateIsDirty).toBe(false);

    expectQuaternionsToBeEqual(updatedQuaternion, expectedQuaternion);
    expectQuaternionsToBeEqual(updatedConjugate, expectedConjugate);
    expect(updatedConjugateIsDirty).toBe(true);
  });

  test("Modifying the conjugate has no effect", () => {
    // Setup
    const rotation = new MockRotation({
      initialValue: { x: 10, y: 20, z: 30 },
    });
    const initialQuaternion = rotation.q.clone();
    const initialConjugate = rotation.getQConjugate().clone();
    const initialEuler = rotation.getEuler().clone();
    const initialEulerIsDirty = rotation.getEulerIsDirty();
    const initialConjugateIsDirty = rotation.getQConjugateIsDirty();


    // Test
    /* Modify conjugate in various ways */
    rotation.qConjugate.setValue(1, 2, 3, 4);
    rotation.qConjugate.x = 10;
    rotation.qConjugate.y = 11;
    rotation.qConjugate.z = 12;
    rotation.qConjugate.w = 13;
    const updatedQuaternion = rotation.q.clone();
    const updatedConjugate = rotation.getQConjugate().clone();
    const updatedEuler = rotation.getEuler().clone();
    const updatedEulerIsDirty = rotation.getEulerIsDirty();
    const updatedConjugateIsDirty = rotation.getQConjugateIsDirty();

    // Assert
    expectQuaternionsToBeEqual(initialQuaternion, updatedQuaternion);
    expectQuaternionsToBeEqual(initialConjugate, updatedConjugate);
    expectVectorsToBeEqual(initialEuler, updatedEuler);
    expect(initialEulerIsDirty).toBe(false);
    expect(initialConjugateIsDirty).toBe(false);
    expect(updatedEulerIsDirty).toBe(false);
    expect(updatedConjugateIsDirty).toBe(false);
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
    /* @NOTE Read private fields as to not trigger setters */
    expect(q1['_x']).toBeCloseTo(q2['_x'], 8);
    expect(q1['_y']).toBeCloseTo(q2['_y'], 8);
    expect(q1['_z']).toBeCloseTo(q2['_z'], 8);
    expect(q1['_w']).toBeCloseTo(q2['_w'], 8);
  }
  function expectVectorsToBeEqual(v1: Vector3, v2: Vector3): void {
    /* @NOTE Read private fields as to not trigger setters */
    expect(v1['_x']).toBeCloseTo(v2['_x'], 8);
    expect(v1['_y']).toBeCloseTo(v2['_y'], 8);
    expect(v1['_z']).toBeCloseTo(v2['_z'], 8);
  }
});


interface MockRotationConstructorArgs {
  initialValue?: Vector3Definition;
  onChange?: RotationOnChangeCallback;
}
class MockRotation extends Rotation {
  public constructor({ initialValue, onChange }: MockRotationConstructorArgs = {}) {
    super({
      onChange,
    });
    if (initialValue !== undefined) {
      // Set initial value and silently recompute internal state
      this.getEuler().setValue(initialValue, false);
      this['recomputeQuaternionFromEuler']();
      this['recomputeQConjugate']();
    }
  }

  public getEulerIsDirty(): boolean {
    return this['eulerIsDirty'];
  }
  public getEuler(): DirtyVector3 {
    return this['_euler'];
  }
  public getQConjugateIsDirty(): boolean {
    return this['qConjugateIsDirty'];
  }
  public getQConjugate(): Quaternion {
    return this['_qConjugate'];
  }

  public debug_recomputeEverything(): void {
    this['recomputeEuler']();
    this['recomputeQConjugate']();
  }
}

import { expectVectorsToBeEqual } from '@test/util/expect';

import { describe, test, expect } from 'vitest';
import { Vector3 } from './Vector3';
import { Vector2 } from './Vector2';

/* @TODO Test backlog
  - Vector2
  - divideSelf/divide by 0 throws error
  - withX/withY/withZ
  - Setting the same value(s) does not fire on change
*/

describe("Vector3", () => {
  describe("Observability", () => {
    test("Setting x, y, z fires onChange() separately", () => {
      // Setup
      const vector = Vector3.zero();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      const timesOnChangeCalledInitial = timesOnChangeCalled;

      // Test
      vector.x = 1;
      const timesOnChangeCalledAfterSetX = timesOnChangeCalled;
      vector.y = 2;
      const timesOnChangeCalledAfterSetY = timesOnChangeCalled;
      vector.z = 3;
      const timesOnChangeCalledAfterSetZ = timesOnChangeCalled;

      // Assert
      expect(timesOnChangeCalledInitial).toBe(0);
      expect(timesOnChangeCalledAfterSetX).toBe(1);
      expect(timesOnChangeCalledAfterSetY).toBe(2);
      expect(timesOnChangeCalledAfterSetZ).toBe(3);
    });
    test("Calling setValue() with separate (x,y,z) fires onChange() once", () => {
      // Setup
      const vector = Vector3.zero();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.setValue(1, 2, 3);

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling setValue() with Vector3 fires onChange() once", () => {
      // Setup
      const vector = Vector3.zero();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.setValue(new Vector3(1, 2, 3));

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling addSelf() with Vector3 fires onChange() once", () => {
      // Setup
      const vector = Vector3.zero();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.addSelf(new Vector3(1, 2, 3));

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling addSelf() with Vector2 fires onChange() once", () => {
      // Setup
      const vector = Vector3.zero();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.addSelf(new Vector2(1, 2));

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling subtractSelf() with Vector3 fires onChange() once", () => {
      // Setup
      const vector = Vector3.zero();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.subtractSelf(new Vector3(1, 2, 3));

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling subtractSelf() with Vector2 fires onChange() once", () => {
      // Setup
      const vector = Vector3.zero();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.subtractSelf(new Vector2(1, 2));

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling scaleSelf() with number fires onChange() once", () => {
      // Setup
      const vector = Vector3.zero();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.scaleSelf(2);

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling scaleSelf() with Vector3 fires onChange() once", () => {
      // Setup
      const vector = Vector3.zero();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.scaleSelf(new Vector3(2, 2, 2));

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling normalizeSelf() fires onChange() once", () => {
      // Setup
      const vector = new Vector3(1, 2, 3);

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.normalizeSelf();

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling normalizeSelf() on a vector of length 0 DOES NOT FIRE onChange()", () => {
      // Setup
      const vector = Vector3.zero();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.normalizeSelf();

      // Assert
      expect(timesOnChangeCalled).toBe(0);
    });
    test("Calling normalizeSelf() on a vector of length 1 DOES NOT FIRE onChange()", () => {
      // Setup
      const vector = Vector3.forward();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.normalizeSelf();

      // Assert
      expect(timesOnChangeCalled).toBe(0);
    });
    test("Calling crossSelf() fires onChange() once", () => {
      // Setup
      const vector = new Vector3(1, 2, 3);

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.crossSelf(new Vector3(4, 5, 6));

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling setX() fires onChange() once", () => {
      // Setup
      const vector = new Vector3(1, 2, 3);

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.setX(4);

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling setY() fires onChange() once", () => {
      // Setup
      const vector = new Vector3(1, 2, 3);

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.setY(4);

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling setZ() fires onChange() once", () => {
      // Setup
      const vector = new Vector3(1, 2, 3);

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.setZ(4);

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
  });
  test("Constructor initial values are set initially", () => {
    // Setup / Test
    const vector = new Vector3(1, 2, 3);

    // Assert
    expect(vector.x).toBe(1);
    expect(vector.y).toBe(2);
    expect(vector.z).toBe(3);
  });
  test("Calling setValue() with separate xyz components mutates correctly", () => {
    // Setup
    const vector = Vector3.zero();
    const expectedValue = new Vector3(1, 2, 3);

    // Test
    vector.setValue(1, 2, 3);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling setValue() with a Vector3Like mutates correctly", () => {
    // Setup
    const vector = Vector3.zero();
    const expectedValue = new Vector3(1, 2, 3);

    // Test
    vector.setValue({ x: expectedValue.x, y: expectedValue.y, z: expectedValue.z });

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling addSelf() with a Vector3 mutates correctly", () => {
    // Setup
    const vector = new Vector3(1, 2, 3);
    const operand = new Vector3(2, 3, 4);
    const expectedValue = new Vector3(3, 5, 7);

    // Test
    vector.addSelf(operand);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling addSelf() with a Vector2 mutates correctly", () => {
    // Setup
    const vector = new Vector3(1, 2, 3);
    const operand = new Vector2(2, 3);
    const expectedValue = new Vector3(3, 5, 3);

    // Test
    vector.addSelf(operand);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling add() with a Vector3 returns the correct result", () => {
    // Setup
    const vector = new Vector3(1, 2, 3);
    const original = vector.clone();
    const operand = new Vector3(2, 3, 4);
    const expectedValue = new Vector3(3, 5, 7);

    // Test
    const result = vector.add(operand);

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });
  test("Calling add() with a Vector2 returns the correct result", () => {
    // Setup
    const vector = new Vector3(1, 2, 3);
    const original = vector.clone();
    const operand = new Vector2(2, 3);
    const expectedValue = new Vector3(3, 5, 3);

    // Test
    const result = vector.add(operand);

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });
  test("Calling subtractSelf() with a Vector3 mutates correctly", () => {
    // Setup
    const vector = new Vector3(5, 7, 9);
    const operand = new Vector3(2, 3, 4);
    const expectedValue = new Vector3(3, 4, 5);

    // Test
    vector.subtractSelf(operand);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling subtractSelf() with a Vector2 mutates correctly", () => {
    // Setup
    const vector = new Vector3(5, 7, 9);
    const operand = new Vector2(2, 3);
    const expectedValue = new Vector3(3, 4, 9);

    // Test
    vector.subtractSelf(operand);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling subtract() with a Vector3 returns the correct result", () => {
    // Setup
    const vector = new Vector3(5, 7, 9);
    const original = vector.clone();
    const operand = new Vector3(2, 3, 4);
    const expectedValue = new Vector3(3, 4, 5);

    // Test
    const result = vector.subtract(operand);

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });
  test("Calling subtract() with a Vector2 returns the correct result", () => {
    // Setup
    const vector = new Vector3(5, 7, 9);
    const original = vector.clone();
    const operand = new Vector2(2, 3);
    const expectedValue = new Vector3(3, 4, 9);

    // Test
    const result = vector.subtract(operand);

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });
  test("Calling scaleSelf() with a number mutates correctly", () => {
    // Setup
    const vector = new Vector3(1, 2, 3);
    const factor = 3;
    const expectedValue = new Vector3(3, 6, 9);

    // Test
    vector.scaleSelf(factor);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling scaleSelf() with a Vector3 mutates correctly", () => {
    // Setup
    const vector = new Vector3(1, 2, 3);
    const operand = new Vector3(2, 3, 4);
    const expectedValue = new Vector3(2, 6, 12);

    // Test
    vector.scaleSelf(operand);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling scale() with a number returns the correct result", () => {
    // Setup
    const vector = new Vector3(1, 2, 3);
    const original = vector.clone();
    const factor = 3;
    const expectedValue = new Vector3(3, 6, 9);

    // Test
    const result = vector.scale(factor);

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });
  test("Calling scale() with a Vector3 returns the correct result", () => {
    // Setup
    const vector = new Vector3(1, 2, 3);
    const original = vector.clone();
    const operand = new Vector3(2, 3, 4);
    const expectedValue = new Vector3(2, 6, 12);

    // Test
    const result = vector.scale(operand);

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });
  test("Calling length() returns the correct result", () => {
    // Setup
    const vector = new Vector3(2, 3, 6);
    const expectedLength = 7;

    // Test
    const result = vector.length();

    // Assert
    expect(result).toBe(expectedLength);
  });
  test("Calling lengthSquared() returns the correct result", () => {
    // Setup
    const vector = new Vector3(2, 3, 6);
    const expectedLengthSquared = 49;

    // Test
    const result = vector.lengthSquared();

    // Assert
    expect(result).toBe(expectedLengthSquared);
  });
  test("Calling normalizeSelf() mutates correctly", () => {
    // Setup
    const vector = new Vector3(2, 3, 6);
    const expectedValue = new Vector3(2 / 7, 3 / 7, 6 / 7);

    // Test
    vector.normalizeSelf();

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling normalizeSelf() on a zero-length vector mutates correctly", () => {
    // Setup
    const vector = Vector3.zero();

    // Test
    vector.normalizeSelf();

    // Assert
    expectVectorsToBeEqual(vector, Vector3.zero());
  });
  test("Calling normalize() returns the correct result", () => {
    // Setup
    const vector = new Vector3(2, 3, 6);
    const original = vector.clone();
    const expectedValue = new Vector3(2 / 7, 3 / 7, 6 / 7);

    // Test
    const result = vector.normalize();

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });
  test("Calling normalize() on a zero-length vector returns the correct result", () => {
    // Setup
    const vector = Vector3.zero();
    const original = vector.clone();

    // Test
    const result = vector.normalize();

    // Assert
    expectVectorsToBeEqual(result, Vector3.zero());
    expectVectorsToBeEqual(vector, original);
  });
  test("Calling crossSelf() mutates correctly", () => {
    // Setup
    const vector = Vector3.forward();
    const operand = Vector3.up();
    const expectedValue = Vector3.right();

    // Test
    vector.crossSelf(operand);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling cross() returns the correct result", () => {
    // Setup
    const vector = Vector3.forward();
    const original = vector.clone();
    const operand = Vector3.up();
    const expectedValue = Vector3.right();

    // Test
    const result = vector.cross(operand);

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });
  test("Calling dot() returns the correct result", () => {
    // Setup
    const a = new Vector3(1, 2, 3);
    const b = new Vector3(4, 5, 6);
    const expectedValue = 32;

    // Test
    const result = a.dot(b);

    // Assert
    expect(result).toBe(expectedValue);
  });
  test("Calling isNormalized() with a unit vector returns true", () => {
    // Setup
    const vector = new Vector3(1, 0, 0);

    // Test
    const result = vector.isNormalized();

    // Assert
    expect(result).toBe(true);
  });
  test("Calling isNormalized() with a non-unit vector returns false", () => {
    // Setup
    const vector = new Vector3(1, 2, 3);

    // Test
    const result = vector.isNormalized();

    // Assert
    expect(result).toBe(false);
  });
  test("Calling clone() returns the correct result", () => {
    // Setup
    const vector = new Vector3(1, 2, 3);

    // Test
    const cloned = vector.clone();

    // Assert
    expectVectorsToBeEqual(cloned, vector);
    expect(cloned).not.toBe(vector);
  });
  test("Calling setX() mutates correctly", () => {
    // Setup
    const vector = new Vector3(1, 2, 3);
    const updatedXValue = 10;
    const expectedValue = new Vector3(updatedXValue, 2, 3);

    // Test
    vector.setX(updatedXValue);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling setY() mutates correctly", () => {
    // Setup
    const vector = new Vector3(1, 2, 3);
    const updatedYValue = 10;
    const expectedValue = new Vector3(1, updatedYValue, 3);

    // Test
    vector.setY(updatedYValue);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling setZ() mutates correctly", () => {
    // Setup
    const vector = new Vector3(1, 2, 3);
    const updatedZValue = 10;
    const expectedValue = new Vector3(1, 2, updatedZValue);

    // Test
    vector.setZ(updatedZValue);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
});

import { expectVectorsToBeEqual } from '@test/util/expect';

import { describe, test, expect } from 'vitest';
import { EulerVector3 } from './EulerVector3';
import { Vector3 } from './Vector3';
import { Vector2 } from './Vector2';

/*
  @TODO Test Backlog
    - setValue with Quaternion property
    - setting the same value does not fire onChange
 */

describe("EulerVector3", () => {
  describe("Observability", () => {
    test("Setting x, y, z fires onChange() separately", () => {
      // Setup
      const vector = new EulerVector3(0, 0, 0);

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
      const vector = new EulerVector3(0, 0, 0);

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
      const vector = new EulerVector3(0, 0, 0);

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
      const vector = new EulerVector3(0, 0, 0);

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
      const vector = new EulerVector3(0, 0, 0);

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
      const vector = new EulerVector3(0, 0, 0);

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
      const vector = new EulerVector3(0, 0, 0);

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.subtractSelf(new Vector2(1, 2));

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling setX() fires onChange() once", () => {
      // Setup
      const vector = new EulerVector3(1, 2, 3);

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
      const vector = new EulerVector3(1, 2, 3);

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
      const vector = new EulerVector3(1, 2, 3);

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
    const vector = new EulerVector3(361, 362, 363);

    // Assert
    expect(vector.x).toBe(1);
    expect(vector.y).toBe(2);
    expect(vector.z).toBe(3);
  });
  test("Calling setValue() with separate xyz components mutates correctly", () => {
    // Setup
    const vector = new EulerVector3(0, 0, 0);
    const expectedValue = new EulerVector3(1, 2, 3);

    // Test
    vector.setValue(361, 362, 363);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling setValue() with a Vector3Like mutates correctly", () => {
    // Setup
    const vector = new EulerVector3(0, 0, 0);
    const operand = new Vector3(361, 362, 363);
    const expectedValue = new EulerVector3(1, 2, 3);

    // Test
    vector.setValue(operand);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling addSelf() with a Vector3Like mutates correctly", () => {
    // Setup
    const vector = new EulerVector3(355, 356, 357);
    const operand = new Vector3(6, 7, 8);
    const expectedValue = new EulerVector3(1, 3, 5);

    // Test
    vector.addSelf(operand);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling addSelf() with a Vector2Like mutates correctly", () => {
    // Setup
    const vector = new EulerVector3(355, 356, 357);
    const operand = new Vector2(6, 7);
    const expectedValue = new EulerVector3(1, 3, 357);

    // Test
    vector.addSelf(operand);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling add() with a Vector3Like returns the correct result", () => {
    // Setup
    const vector = new EulerVector3(355, 356, 357);
    const original = vector.clone();
    const operand = new Vector3(6, 7, 8);
    const expectedValue = new EulerVector3(1, 3, 5);

    // Test
    const result = vector.add(operand);

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });
  test("Calling add() with a Vector2Like returns the correct result", () => {
    // Setup
    const vector = new EulerVector3(355, 356, 357);
    const original = vector.clone();
    const operand = new Vector2(6, 7);
    const expectedValue = new EulerVector3(1, 3, 357);

    // Test
    const result = vector.add(operand);

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });
  test("Calling subtractSelf() with a Vector3Like mutates correctly", () => {
    // Setup
    const vector = new EulerVector3(-355, -356, -357);
    const operand = new Vector3(6, 7, 8);
    const expectedValue = new EulerVector3(-1, -3, -5);

    // Test
    vector.subtractSelf(operand);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling subtractSelf() with a Vector2Like mutates correctly", () => {
    // Setup
    const vector = new EulerVector3(-355, -356, -357);
    const operand = new Vector2(6, 7);
    const expectedValue = new EulerVector3(-1, -3, -357);

    // Test
    vector.subtractSelf(operand);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling subtract() with a Vector3Like returns the correct result", () => {
    // Setup
    const vector = new EulerVector3(-355, -356, -357);
    const original = vector.clone();
    const operand = new Vector3(6, 7, 8);
    const expectedValue = new EulerVector3(-1, -3, -5);

    // Test
    const result = vector.subtract(operand);

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });
  test("Calling subtract() with a Vector2 returns the correct result", () => {
    // Setup
    const vector = new EulerVector3(-355, -356, -357);
    const original = vector.clone();
    const operand = new Vector2(6, 7);
    const expectedValue = new EulerVector3(-1, -3, -357);
    // Test
    const result = vector.subtract(operand);

    // Assert
    expectVectorsToBeEqual(result, expectedValue);
    expectVectorsToBeEqual(vector, original);
  });
  test("Calling clone() returns the correct result", () => {
    // Setup
    const vector = new EulerVector3(1, 2, 3);

    // Test
    const cloned = vector.clone();

    // Assert
    expectVectorsToBeEqual(cloned, vector);
    expect(cloned).not.toBe(vector);
  });
  test("Calling setX() mutates correctly", () => {
    // Setup
    const vector = new EulerVector3(1, 2, 3);
    const updatedXValue = 370;
    const expectedValue = new EulerVector3(updatedXValue % 360, 2, 3);

    // Test
    vector.setX(updatedXValue);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling setY() mutates correctly", () => {
    // Setup
    const vector = new EulerVector3(1, 2, 3);
    const updatedYValue = 370;
    const expectedValue = new EulerVector3(1, updatedYValue % 360, 3);

    // Test
    vector.setY(updatedYValue);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
  test("Calling setZ() mutates correctly", () => {
    // Setup
    const vector = new EulerVector3(1, 2, 3);
    const updatedZValue = 370;
    const expectedValue = new EulerVector3(1, 2, updatedZValue % 360);

    // Test
    vector.setZ(updatedZValue);

    // Assert
    expectVectorsToBeEqual(vector, expectedValue);
  });
});

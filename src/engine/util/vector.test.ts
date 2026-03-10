import { describe, test, expect } from 'vitest';
import { Vector2, Vector3 } from './vector';
import { Quaternion } from './quaternion';
import { Matrix4 } from './Matrix4';

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
    test("Calling addSelf with Vector3 fires onChange() once", () => {
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
    test("Calling addSelf with Vector2 fires onChange() once", () => {
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
    test("Calling subtractSelf with Vector3 fires onChange() once", () => {
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
    test("Calling subtractSelf with Vector2 fires onChange() once", () => {
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
    test("Calling multiplySelf with factor fires onChange() once", () => {
      // Setup
      const vector = Vector3.zero();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.multiplySelf(2);

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling multiplySelf with Vector3 fires onChange() once", () => {
      // Setup
      const vector = Vector3.zero();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.multiplySelf(new Vector3(2, 2, 2));

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling multiplySelf with Quaternion fires onChange() once", () => {
      // Setup
      const vector = Vector3.zero();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.multiplySelf(Quaternion.identity());

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling multiplySelf with Matrix4 fires onChange() once", () => {
      // Setup
      const vector = Vector3.zero();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.multiplySelf(new Matrix4());

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling divideSelf with factor fires onChange() once", () => {
      // Setup
      const vector = Vector3.zero();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.divideSelf(2);

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling divideSelf with Vector3 fires onChange() once", () => {
      // Setup
      const vector = Vector3.zero();

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.divideSelf(new Vector3(2, 2, 2));

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling normalizeSelf fires onChange() once", () => {
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
    test("Calling crossSelf fires onChange() once", () => {
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
    test("Calling withX fires onChange() once", () => {
      // Setup
      const vector = new Vector3(1, 2, 3);

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.withX(4);

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling withY fires onChange() once", () => {
      // Setup
      const vector = new Vector3(1, 2, 3);

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.withY(4);

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
    test("Calling withZ fires onChange() once", () => {
      // Setup
      const vector = new Vector3(1, 2, 3);

      let timesOnChangeCalled = 0;
      vector.onChange(() => {
        timesOnChangeCalled++;
      });

      // Test
      vector.withZ(4);

      // Assert
      expect(timesOnChangeCalled).toBe(1);
    });
  });
});

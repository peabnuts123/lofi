import { describe, test, expect } from 'vitest';
import { Quaternion } from './quaternion';

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
    test("Calling multiplySelf fires onChange() once", () => {
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
    test("Calling slerpSelf fires onChange() once", () => {
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
    test("Calling setValue fires onChange() once", () => {
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
  });
});

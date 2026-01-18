import { Vector3 } from '@polyzone/engine/util/vector';
import { AxisAlignedBoundingBox } from '@polyzone/engine/collision';
import { describe, test, expect } from 'vitest';

import { rayAABBIntersection } from './index';

describe("Ray casting", () => {
  describe("Ray-AABB intersection", () => {
    test("Against corner of unit cube", () => {
      // Setup
      const size = 1;
      const aabb = new AxisAlignedBoundingBox({
        xMin: -size,
        xMax: size,
        yMin: -size,
        yMax: size,
        zMin: -size,
        zMax: size,
      });

      const rayOrigin = new Vector3(-size * 2, -size * 2, -size * 2);
      const rayDirection = new Vector3(size, size, size);

      // Test
      const result = rayAABBIntersection(rayOrigin, rayDirection, aabb);
      const intersectionPoint = result === undefined ? undefined : rayDirection.multiply(result).addSelf(rayOrigin);

      // Assert
      expect(result).toBe(1);
      expect(intersectionPoint).toEqual(new Vector3(-size, -size, -size));
    });

    test("Axis-aligned against middle of AABB", () => {
      // Setup
      const size = 1;
      const aabb = new AxisAlignedBoundingBox({
        xMin: -size,
        xMax: size,
        yMin: -size,
        yMax: size,
        zMin: -size,
        zMax: size,
      });

      const rayOrigin = new Vector3(0, 0, size * 2);
      const rayDirection = new Vector3(0, 0, -size);

      // Test
      const result = rayAABBIntersection(rayOrigin, rayDirection, aabb);
      const intersectionPoint = result === undefined ? undefined : rayDirection.multiply(result).addSelf(rayOrigin);

      // Assert
      expect(result).toBe(1);
      expect(intersectionPoint).toEqual(new Vector3(0, 0, size));
    });

    test("No intersection", () => {
      // Setup
      const size = 1;
      const aabb = new AxisAlignedBoundingBox({
        xMin: -size,
        xMax: size,
        yMin: -size,
        yMax: size,
        zMin: -size,
        zMax: size,
      });

      const rayOrigin = new Vector3(-size * 2, 0, size * 2);
      const rayDirection = new Vector3(0, 0, -size);

      // Test
      const result = rayAABBIntersection(rayOrigin, rayDirection, aabb);

      // Assert
      expect(result).toBeUndefined();
    });
  });
});

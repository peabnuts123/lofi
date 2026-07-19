import { describe, test, expect } from 'vitest';

import  { Vector3 } from '@lopoly/core/math/Vector3';
import  { AxisAlignedBoundingBox } from '@lopoly/engine/collision';
import  type { Triangle } from "@lopoly/engine/models/geometry";

import { RayCast } from './RayCast';

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
      const result = RayCast.intersectAABB(rayOrigin, rayDirection, aabb);
      const intersectionPoint = result === undefined ? undefined : rayDirection.scale(result).addSelf(rayOrigin);

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
      const result = RayCast.intersectAABB(rayOrigin, rayDirection, aabb);
      const intersectionPoint = result === undefined ? undefined : rayDirection.scale(result).addSelf(rayOrigin);

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
      const result = RayCast.intersectAABB(rayOrigin, rayDirection, aabb);

      // Assert
      expect(result).toBeUndefined();
    });
    test("Negative / reverse intersection", () => {
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
      const rayDirection = new Vector3(-size, -size, -size);

      // Test
      const result = RayCast.intersectAABB(rayOrigin, rayDirection, aabb);

      // Assert
      expect(result).toBeUndefined();
    });
    test("Ray origin inside AABB", () => {
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

      const rayOrigin = new Vector3(0, 0, 0);
      const rayDirection = new Vector3(size, size, size);

      // Test
      const result = RayCast.intersectAABB(rayOrigin, rayDirection, aabb);

      // Assert
      expect(result).toBe(0);
    });
    test("Ray origin on near edge of AABB", () => {
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

      const rayOrigin = new Vector3(-size, -size, -size);
      const rayDirection = new Vector3(size, size, size);

      // Test
      const result = RayCast.intersectAABB(rayOrigin, rayDirection, aabb);

      // Assert
      expect(result).toBe(0);
    });
    test("Ray origin on far edge of AABB", () => {
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

      const rayOrigin = new Vector3(size, size, size);
      const rayDirection = new Vector3(size, size, size);

      // Test
      const result = RayCast.intersectAABB(rayOrigin, rayDirection, aabb);

      // Assert
      expect(result).toBeUndefined();
    });
    test("0-width, axis aligned AABB", () => {
      // Setup
      const size = 1;
      const aabb = new AxisAlignedBoundingBox({
        xMin: -size,
        xMax: size,
        yMin: -size,
        yMax: size,
        zMin: -0,
        zMax: 0,
      });

      const rayOrigin = new Vector3(0, 0, size * 2);
      const rayDirection = new Vector3(0, 0, -size);

      // Test
      const result = RayCast.intersectAABB(rayOrigin, rayDirection, aabb);
      const intersectionPoint = result === undefined ? undefined : rayDirection.scale(result).addSelf(rayOrigin);

      // Assert
      expect(result).toBe(2);
      expect(intersectionPoint).toEqual(new Vector3(0, 0, 0));
    });
  });

  describe("Ray-Triangle intersection", () => {
    test("Flat triangle at origin", () => {
      // Setup
      const triangle: Triangle = [
        new Vector3(0, 0, 1), // Top
        new Vector3(-1, 0, -0.5), // Left
        new Vector3(1, 0, -0.5), // Right
      ];
      // Ray will intersect with 0,0,0
      const rayOrigin = new Vector3(2, 2, 2);
      const rayDirection = new Vector3(-1, -1, -1);

      // Test
      const result = RayCast.intersectTriangle(rayOrigin, rayDirection, triangle);
      const intersectionPoint = result === undefined ? undefined : rayDirection.scale(result).addSelf(rayOrigin);

      // Assert
      expect(result).toBe(2);
      expect(intersectionPoint).toEqual(new Vector3(0, 0, 0));
    });
    test("Triangle on an angle", () => {
      // Setup
      const triangle: Triangle = [
        new Vector3(0.5, 1, -0.5), // Top
        new Vector3(0.5, 0, -1), // Left
        new Vector3(1, 0, -0.5), // Right
      ];
      const midPoint = triangle[0].add(triangle[1]).addSelf(triangle[2]).scaleSelf(1 / 3);
      // Ray will intersect with midPoint
      const rayOrigin = new Vector3(0, 0, 0);
      const rayDirection = new Vector3(2, 1, -2);

      // Test
      const result = RayCast.intersectTriangle(rayOrigin, rayDirection, triangle);
      const intersectionPoint = result === undefined ? undefined : rayDirection.scale(result).addSelf(rayOrigin);

      // Assert
      expect(result).toBe(1 / 3);
      expect(intersectionPoint).toEqual(midPoint);
    });
    test("No intersection", () => {
      // Setup
      const triangle: Triangle = [
        new Vector3(0.5, 1, -0.5), // Top
        new Vector3(0.5, 0, -1), // Left
        new Vector3(1, 0, -0.5), // Right
      ];
      // Ray will not intersect
      const rayOrigin = new Vector3(0, 0, 0);
      const rayDirection = new Vector3(-1, 0, 0);

      // Test
      const result = RayCast.intersectTriangle(rayOrigin, rayDirection, triangle);

      // Assert
      expect(result).toBeUndefined();
    });
    test("Negative / reverse intersection", () => {
      // Setup
      const triangle: Triangle = [
        new Vector3(0.5, 1, -0.5), // Top
        new Vector3(0.5, 0, -1), // Left
        new Vector3(1, 0, -0.5), // Right
      ];
      // Ray would intersect with midPoint, but is pointing the other direction
      const rayOrigin = new Vector3(0, 0, 0);
      const rayDirection = new Vector3(-2, -1, 2);

      // Test
      const result = RayCast.intersectTriangle(rayOrigin, rayDirection, triangle);

      // Assert
      expect(result).toBeUndefined();
    });
    test("Ray origin on surface of triangle", () => {
      // Setup
      const triangle: Triangle = [
        new Vector3(0, 0, 1), // Top
        new Vector3(-1, 0, -0.5), // Left
        new Vector3(1, 0, -0.5), // Right
      ];
      const rayOrigin = new Vector3(0, 0, 0);
      const rayDirection = new Vector3(0, 1, 0);

      // Test
      const result = RayCast.intersectTriangle(rayOrigin, rayDirection, triangle);

      // Assert
      expect(result).toBeUndefined();
    });
  });
});

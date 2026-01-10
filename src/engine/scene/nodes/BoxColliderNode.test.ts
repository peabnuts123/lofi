import { describe, expect, test } from 'vitest';
import { BoxColliderNode } from './BoxColliderNode';
import { createMockScene } from '@test/util';
import { Vector3 } from '@polyzone/engine/util/vector';

describe("BoxColliderNode", () => {
  /*
    @TODO Test Backlog
      // - AABB has correct bounds
      // - Rotating shape has correct bounds
      // - AABB + offset produces correct result
      - Few simple scenarios for `calculateIntersection` produce correct result
      - `getSATNormals` are all normalized
      - `getSATNormals` returns correct count
      - `getSATEdges` are normalized
      - `getSATEdges` returns correct count
      - Few scenarios for `projectToAxis`
   */
  test("`getAABB()` returned correct result for unrotated shape", () => {
    // Setup
    const size = 1;
    const { scene } = createMockScene();
    const collide = new BoxColliderNode(scene, "collider", 0, {
      x: size, y: size, z: size,
    });

    // Test
    const aabb = collide.getAABB();

    // Assert
    expect(aabb.xMin).toBe(-size / 2);
    expect(aabb.xMax).toBe(size / 2);
    expect(aabb.yMin).toBe(-size / 2);
    expect(aabb.yMax).toBe(size / 2);
    expect(aabb.zMin).toBe(-size / 2);
    expect(aabb.zMax).toBe(size / 2);
  });

  test("`getAABB()` returns correct result for rotated shape", () => {
    // @NOTE I'd love to do a better test here but I can't figure
    // out what the expected values should be for a more complex rotation

    // Setup
    const size = 1;
    const { scene } = createMockScene();
    const collider = new BoxColliderNode(scene, "collider", 0, {
      x: size, y: size, z: size,
    });
    collider.rotation.y = 45;
    const diagonalSize = Math.sqrt((size * size) * 2);

    // Test
    const aabb = collider.getAABB();

    // Assert
    expect(aabb.xMin).toBeCloseTo(-diagonalSize / 2);
    expect(aabb.xMax).toBeCloseTo(diagonalSize / 2);
    expect(aabb.yMin).toBeCloseTo(-size / 2);
    expect(aabb.yMax).toBeCloseTo(size / 2);
    expect(aabb.zMin).toBeCloseTo(-diagonalSize / 2);
    expect(aabb.zMax).toBeCloseTo(diagonalSize / 2);
  });

  test("`getAABB()` with offset returns correct result", () => {
    // Setup
    const size = 1;
    const offset = new Vector3(0.5, 0.7, 0.9);
    const { scene } = createMockScene();
    const collider = new BoxColliderNode(scene, "collider", 0, {
      x: size, y: size, z: size,
    });

    // Test
    const aabb = collider.getAABB(offset);

    // Assert
    expect(aabb.xMin).toBe(-size / 2 + offset.x);
    expect(aabb.xMax).toBe(size / 2 + offset.x);
    expect(aabb.yMin).toBe(-size / 2 + offset.y);
    expect(aabb.yMax).toBe(size / 2 + offset.y);
    expect(aabb.zMin).toBe(-size / 2 + offset.z);
    expect(aabb.zMax).toBe(size / 2 + offset.z);
  });

  describe(`calculateIntersection() produces correct results`, () => {
    test("axis-aligned, intersection along one axis", () => {
      // Setup
      const size = 1;
      const speed = 0.2;
      const { scene } = createMockScene();
      /* Create 2 shapes */
      const colliderA = new BoxColliderNode(scene, "collider_a", 0, {
        x: size, y: size, z: size,
      });
      const colliderB = new BoxColliderNode(scene, "collider_b", 0, {
        x: size, y: size, z: size,
      });
      /* Arrange shapes */
      colliderB.position.x = size + speed / 2; // So that shapes not quite touching
      expect(colliderB.intersects(colliderA)).toBe(false);

      // Test
      const computeMoveResult = colliderB.computeMove(new Vector3(-speed, 0, 0));

      // Assert
      expect.soft(computeMoveResult.result.x).toBeCloseTo(-speed / 2);
      expect.soft(computeMoveResult.result.y).toBeCloseTo(0);
      expect.soft(computeMoveResult.result.z).toBeCloseTo(0);
    });
  });
});

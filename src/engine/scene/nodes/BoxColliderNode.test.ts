import { describe, expect, test } from 'vitest';
import { BoxColliderNode } from './BoxColliderNode';
import { createMockScene } from '@test/util';
import { Vector3 } from '@polyzone/engine/util/vector';
import type { SatProjection } from './SatColliderNode';

describe("BoxColliderNode", () => {
  test("`getAABB()` returns correct result for unrotated shape", () => {
    // Setup
    const size = 1;
    const { scene } = createMockScene();
    const collider = new BoxColliderNode(scene, "collider", 0, {
      x: size, y: size, z: size,
    });

    // Test
    const aabb = collider.getAABB();

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

  describe(`computeMove() produces correct results`, () => {
    test("perpendicular movement, axis-aligned shapes", () => {
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
    test("2d movement, sliding movement against a corner", () => {
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
      const distanceBetweenShapes = 0.2;
      /* - Both shapes rotated */
      colliderA.rotation.y = 45;
      colliderB.rotation.y = 45;
      /* B above A, offset so that shapes will intersect along an edge */
      colliderB.position.x = size / 2 - distanceBetweenShapes;
      colliderB.position.y = size + distanceBetweenShapes;
      colliderB.position.z = size / 2 - distanceBetweenShapes;
      expect(colliderB.intersects(colliderA)).toBe(false);

      // Test
      const computeMoveResult = colliderB.computeMove(new Vector3(speed, -speed, speed));

      // Assert
      expect.soft(computeMoveResult.result.x).toBeCloseTo(speed);
      expect.soft(computeMoveResult.result.y).toBeCloseTo(-distanceBetweenShapes);
      expect.soft(computeMoveResult.result.z).toBeCloseTo(speed);
    });
    test("closer results are preferred over smaller MTVs", () => {
      // Setup
      const size = 1;
      const { scene } = createMockScene();
      /* Create 2 shapes */
      const colliderA = new BoxColliderNode(scene, "collider_a", 0, {
        x: size, y: size, z: size,
      });
      const colliderB = new BoxColliderNode(scene, "collider_b", 0, {
        x: size, y: size, z: size,
      });
      /* Arrange shapes */
      /*
        B is a above A, colliding along an edge.
        B wants to move by a certain amount such that the intersection would produce 2 meaningful
        solutions:
          - Bump shape B a small amount along axis X
          - Bump shape B a larger amount back up axis Y

        In other words, the speed of B is high enough that it ~mostly tunnels through A
        and the shortest MTV would have it "pop out" the other side.

        However we have some basic code preferring solutions that are shorter
        than the requested move vector, so the "longer" solution along Y
        is preferred, which prevents tunnelling in this scenario.

        @NOTE that this doesn't prevent tunnelling in some other scenarios.
       */
      const distanceBetweenShapes = 0.2;
      colliderB.position.x = size - distanceBetweenShapes * 2;
      colliderB.position.y = size + distanceBetweenShapes;
      expect(colliderB.intersects(colliderA)).toBe(false);
      const speed = distanceBetweenShapes * 1.8;

      // Test
      const computeMoveResult = colliderB.computeMove(new Vector3(distanceBetweenShapes * 1.8, -distanceBetweenShapes * 1.8, 0));

      // Assert
      // Expect "longer" vertical result rather than shorter horizontal result
      expect.soft(computeMoveResult.result.x).toBeCloseTo(speed);
      expect.soft(computeMoveResult.result.y).toBeCloseTo(-distanceBetweenShapes);
      expect.soft(computeMoveResult.result.z).toBeCloseTo(0);
    });
  });

  test("`getSATNormals()` are all normalized", () => {
    // Setup
    const size = 1;
    const { scene } = createMockScene();
    const collider = new MockBoxColliderNode(scene, "collider", 0, {
      x: size, y: size, z: size,
    });

    // Test
    const normals = collider.getSATNormals();

    // Assert
    expect(normals).toHaveLength(3);
    for (const normal of normals) {
      expect(normal.length()).toBeCloseTo(1);
    }
  });
  test("`getSATEdges()` are all normalized", () => {
    // Setup
    const size = 1;
    const { scene } = createMockScene();
    const collider = new MockBoxColliderNode(scene, "collider", 0, {
      x: size, y: size, z: size,
    });

    // Test
    const edges = collider.getSATEdges();

    // Assert
    expect(edges).toHaveLength(3);
    for (const normal of edges) {
      expect(normal.length()).toBeCloseTo(1);
    }
  });

  describe("`projectToAxis()` produces correct results", () => {
    test("simple, axis-aligned", () => {
      // Setup
      const size = 1;
      const { scene } = createMockScene();
      const collider = new MockBoxColliderNode(scene, "collider", 0, {
        x: size, y: size, z: size,
      });
      const axis = new Vector3(1, 0, 0);

      // Test
      const [min, max] = collider.projectToAxis(axis);

      // Assert
      expect(min).toBe(-size / 2);
      expect(max).toBe(size / 2);
    });
    test("offset, axis-aligned", () => {
      // Setup
      const size = 1;
      const { scene } = createMockScene();
      const collider = new MockBoxColliderNode(scene, "collider", 0, {
        x: size, y: size, z: size,
      });
      const axis = new Vector3(1, 0, 0);
      const offset = new Vector3(2, 3, 4);

      // Test
      const [min, max] = collider.projectToAxis(axis, offset);

      // Assert
      expect(min).toBe(offset.x - size / 2);
      expect(max).toBe(offset.x + size / 2);
    });
    test("rotated, offset", () => {
      // Setup
      const size = 1;
      const { scene } = createMockScene();
      const collider = new MockBoxColliderNode(scene, "collider", 0, {
        x: size, y: size, z: size,
      });
      collider.rotation.y = 45;
      const axis = new Vector3(1, 0, 0);
      const offset = new Vector3(2, 3, 4);
      const expectedWidth = Math.sqrt(2 * size * size);

      // Test
      const [min, max] = collider.projectToAxis(axis, offset);

      // Assert
      expect(min).toBe(offset.x - expectedWidth / 2);
      expect(max).toBe(offset.x + expectedWidth / 2);
    });
    test("complex axis", () => {
      // Setup
      const size = 1;
      const { scene } = createMockScene();
      const collider = new MockBoxColliderNode(scene, "collider", 0, {
        x: size, y: size, z: size,
      });
      const axis = new Vector3(1, 2, 3);
      const expectedSize = (axis.x + axis.y + axis.z) * size; // @NOTE Don't ask me why

      // Test
      const [min, max] = collider.projectToAxis(axis);

      // Assert
      expect(min).toBe(-expectedSize / 2);
      expect(max).toBe(expectedSize / 2);
    });
  });
});

/**
 * Subclass of BoxColliderNode that exposes internal state.
 */
class MockBoxColliderNode extends BoxColliderNode {
  public override getSATNormals(): Vector3[] {
    return super.getSATNormals();
  }
  public override getSATEdges(): Vector3[] {
    return super.getSATEdges();
  }
  public override projectToAxis(axis: Vector3, offset?: Vector3): SatProjection {
    return super.projectToAxis(axis, offset);
  }
}

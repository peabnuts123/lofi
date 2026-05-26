import { Vector3 } from "@lofi/core/math/vector";
import type { Triangle } from "@lofi/engine/models";
import type { AxisAlignedBoundingBox } from "../AxisAlignedBoundingBox";

export function rayAABBIntersection(rayOrigin: Vector3, rayDir: Vector3, aabb: AxisAlignedBoundingBox): number | undefined {
  /* Min */
  const tMinX = (aabb.xMin - rayOrigin.x) / rayDir.x;
  const tMinY = (aabb.yMin - rayOrigin.y) / rayDir.y;
  const tMinZ = (aabb.zMin - rayOrigin.z) / rayDir.z;
  /* Max */
  const tMaxX = (aabb.xMax - rayOrigin.x) / rayDir.x;
  const tMaxY = (aabb.yMax - rayOrigin.y) / rayDir.y;
  const tMaxZ = (aabb.zMax - rayOrigin.z) / rayDir.z;

  const tNear = Math.max(
    Math.min(tMinX, tMaxX),
    Math.min(tMinY, tMaxY),
    Math.min(tMinZ, tMaxZ),
  );
  const tFar = Math.min(
    Math.max(tMinX, tMaxX),
    Math.max(tMinY, tMaxY),
    Math.max(tMinZ, tMaxZ),
  );

  if (tNear <= tFar) {
    if (tFar <= 0) {
      // Ignore negative results
      return undefined;
    } else if (tNear < 0) {
      // Ray origin is inside AABB
      return 0;
    } else {
      // Ray intersects AABB
      return tNear;
    }
  } else {
    // Ray does not intersect AABB
    return undefined;
  }
};

const RayTriangleTmp: Vector3[] = [
  Vector3.zero(),
  Vector3.zero(),
  Vector3.zero(),
  Vector3.zero(),
];
// From: https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm
export function rayTriangleIntersection(origin: Vector3, direction: Vector3, triangle: Triangle): number | undefined {
  const edge1 = RayTriangleTmp[0].setValue(triangle[1]).subtractSelf(triangle[0]);
  const edge2 = RayTriangleTmp[1].setValue(triangle[2]).subtractSelf(triangle[0]);

  const ray_cross_e2 = RayTriangleTmp[2].setValue(direction).crossSelf(edge2);
  const det = edge1.dot(ray_cross_e2);

  if (det > -Number.EPSILON && det < Number.EPSILON) {
    return undefined; // Ray is parallel to triangle
  }

  const inv_det = 1 / det;
  const s = RayTriangleTmp[3].setValue(origin).subtractSelf(triangle[0]);
  const u = inv_det * s.dot(ray_cross_e2);
  if (u < 0 || u > 1) {
    return undefined;
  }

  const s_cross_e1 = s.crossSelf(edge1);
  const v = inv_det * direction.dot(s_cross_e1);
  if (v < 0 || u + v > 1) {
    return undefined;
  }

  const t = inv_det * edge2.dot(s_cross_e1);

  if (t > Number.EPSILON) {
    return t;
  } else {
    return undefined;
  }
}

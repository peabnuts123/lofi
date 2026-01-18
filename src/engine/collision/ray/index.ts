import { Vector3 } from "@polyzone/engine/util/vector";
import type { Triangle } from "@polyzone/engine/models";
import type { AxisAlignedBoundingBox } from "../AxisAlignedBoundingBox";

const RayAABBTmp: Vector3[] = [
  Vector3.zero(),
  Vector3.zero(),
];
export function rayAABBIntersection(rayOrigin: Vector3, rayDir: Vector3, aabb: AxisAlignedBoundingBox): number | undefined {
  const tMin = RayAABBTmp[0].setValue(
    (aabb.xMin - rayOrigin.x) / rayDir.x,
    (aabb.yMin - rayOrigin.y) / rayDir.y,
    (aabb.zMin - rayOrigin.z) / rayDir.z,
  );
  const tMax = RayAABBTmp[1].setValue(
    (aabb.xMax - rayOrigin.x) / rayDir.x,
    (aabb.yMax - rayOrigin.y) / rayDir.y,
    (aabb.zMax - rayOrigin.z) / rayDir.z,
  );

  const tNear = Math.max(
    Math.min(tMin.x, tMax.x),
    Math.min(tMin.y, tMax.y),
    Math.min(tMin.z, tMax.z),
  );
  const tFar = Math.min(
    Math.max(tMin.x, tMax.x),
    Math.max(tMin.y, tMax.y),
    Math.max(tMin.z, tMax.z),
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
// @NOTE Raw logic version with full allocations, preserved for posterity
// export function rayTriangleIntersection2(origin: Vector3, direction: Vector3, triangle: Triangle): number | undefined {
//   const edge1 = triangle[1].subtract(triangle[0]);
//   const edge2 = triangle[2].subtract(triangle[0]);

//   const ray_cross_e2 = direction.cross(edge2);
//   const det = edge1.dot(ray_cross_e2);

//   if (det > -Number.EPSILON && det < Number.EPSILON) {
//     return undefined; // This ray is parallel to this triangle.
//   }

//   const inv_det = 1.0 / det;
//   const s = origin.subtract(triangle[0]);
//   const u = inv_det * s.dot(ray_cross_e2);
//   if (u < 0.0 || u > 1.0) {
//     return undefined;
//   }

//   const s_cross_e1 = s.cross(edge1);
//   const v = inv_det * direction.dot(s_cross_e1);
//   if (v < 0.0 || u + v > 1.0) {
//     return undefined;
//   }
//   // At this stage we can compute t to find out where the intersection point is on the line.
//   const t = inv_det * edge2.dot(s_cross_e1);

//   if (t > Number.EPSILON) { // ray intersection
//     return t;
//     // let intersection_point = origin + direction * t;
//     // return Some(intersection_point);
//   }
//   else { // This means that there is a line intersection but not a ray intersection.
//     return undefined;
//   }
// }

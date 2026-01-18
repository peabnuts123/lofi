import { Vector3 } from "@polyzone/engine/util/vector";
import type { AxisAlignedBoundingBox } from "../AxisAlignedBoundingBox";

export function rayAABBIntersection(rayOrigin: Vector3, rayDir: Vector3, aabb: AxisAlignedBoundingBox): number | undefined {
  const tMin = new Vector3(
    (aabb.xMin - rayOrigin.x) / rayDir.x,
    (aabb.yMin - rayOrigin.y) / rayDir.y,
    (aabb.zMin - rayOrigin.z) / rayDir.z,
  );
  const tMax = new Vector3(
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
    // Ray intersects AABB
    return tNear;
  } else {
    // Ray does not intersect AABB
    return undefined;
  }
};

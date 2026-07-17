import { Vector3, type IReadonlyVector3 } from "@lofi/core/math/vector";
import type { Enum } from "@lofi/core/util/types";
import type { IReadonlyAxisAlignedBoundingBox } from "@lofi/engine/collision/AxisAlignedBoundingBox";
import type { Triangle } from "@lofi/engine/models/geometry";
import { AxisAlignedBoundingBox } from "@lofi/engine/collision/AxisAlignedBoundingBox";
import { ModelNode } from "@lofi/engine/scene/nodes/ModelNode";
import type { IScene } from "@lofi/engine/scene/Scene";

export const RayCastMode = {
  /** Ray cast will only return results shorter than the passed ray parameter. */
  Bounded: 'Bounded',
  /** Ray cast will return any result at any positive distance. */
  Infinite: 'Infinite',
} as const;
export type RayCastMode = Enum<typeof RayCastMode>;

export interface RayCastResult {
  target: ModelNode;
  hitPosition: Vector3;
  hitDistance: number;
}

export abstract class RayCast {
  /**
   * Ray cast against all {@linkcode ModelNode} instances in a scene and return the closest result.
   * @param rayOrigin Origin of the ray being cast.
   * @param rayDirection Direction of the ray being cast. Does not need to be normalized.
   * @param scene Scene to cast against.
   * @param mode Ray casting mode e.g. whether the cast should be limited by the length of {@linkcode rayDirection}. See {@linkcode RayCastMode} for details.
   * @returns Information about the ray intersection including target {@linkcode ModelNode}, hit position, and hit distance, or `undefined` if no intersection.
   */
  public static scene(rayOrigin: Vector3, rayDirection: Vector3, scene: IScene, mode: RayCastMode = RayCastMode.Bounded): RayCastResult | undefined {
    const sceneModels: ModelNode[] = [];
    scene.forEachNodeInHierarchy((node) => {
      if (node instanceof ModelNode) {
        sceneModels.push(node);
      }
    });
    return RayCast.models(rayOrigin, rayDirection, sceneModels, mode);
  }

  private static readonly tmp_models_triangleAABB: AxisAlignedBoundingBox = AxisAlignedBoundingBox.zero();
  private static readonly tmp_models_rayDirection: Vector3 = Vector3.zero();
  /**
   * Ray cast against a set of {@linkcode ModelNode} instances and return the closest result.
   * @param rayOrigin Origin of the ray being cast.
   * @param rayDirection Direction of the ray being cast. Does not need to be normalized.
   * @param models Array of models to cast against.
   * @param mode Ray casting mode e.g. whether the cast should be limited by the length of {@linkcode rayDirection}. See {@linkcode RayCastMode} for details.
   * @returns Information about the ray intersection including target {@linkcode ModelNode}, hit position, and hit distance, or `undefined` if no intersection.
   */
  public static models(rayOrigin: Vector3, rayDirection: Vector3, models: ModelNode[], mode: RayCastMode = RayCastMode.Bounded): RayCastResult | undefined {
    let shortestRayLength: number = Number.MAX_SAFE_INTEGER;
    let shortestRayTargetModel: ModelNode | undefined = undefined;

    const rayLength = rayDirection.length();
    const rayDirectionNormalized = RayCast.tmp_models_rayDirection
      .setValue(rayDirection)
      .normalizeSelf();

    /*
      ========
      PHASE 1: Approximate AABB
      ========
     */
    const possibleModels: ModelNode[] = [];
    models.forEach((model) => {
      const approximateAABB = model.geometry.approximateAabb;
      if (approximateAABB) {
        const result = RayCast.intersectAABB(rayOrigin, rayDirectionNormalized, approximateAABB);
        if (result !== undefined && !(mode === RayCastMode.Bounded && result > rayLength)) {
          possibleModels.push(model);
        }
      }
    });

    /*
      ========
      PHASE 2: Triangle AABB
      ========
     */
    const possibleTriangles: Array<[triangle: Triangle, node: ModelNode]> = [];
    for (const possibleModel of possibleModels) {
      for (const triangle of possibleModel.geometry.allTriangles) {
        // Construct AABB for triangle
        RayCast.tmp_models_triangleAABB.xMin = Math.min(triangle[0].x, triangle[1].x, triangle[2].x);
        RayCast.tmp_models_triangleAABB.xMax = Math.max(triangle[0].x, triangle[1].x, triangle[2].x);
        RayCast.tmp_models_triangleAABB.yMin = Math.min(triangle[0].y, triangle[1].y, triangle[2].y);
        RayCast.tmp_models_triangleAABB.yMax = Math.max(triangle[0].y, triangle[1].y, triangle[2].y);
        RayCast.tmp_models_triangleAABB.zMin = Math.min(triangle[0].z, triangle[1].z, triangle[2].z);
        RayCast.tmp_models_triangleAABB.zMax = Math.max(triangle[0].z, triangle[1].z, triangle[2].z);

        const result = RayCast.intersectAABB(rayOrigin, rayDirectionNormalized, RayCast.tmp_models_triangleAABB);
        if (result !== undefined && !(mode === RayCastMode.Bounded && result > rayLength)) {
          possibleTriangles.push([
            triangle,
            possibleModel,
          ]);
        }
      }
    }

    /*
      ========
      PHASE 3: Triangle
      ========
     */
    for (const [triangle, node] of possibleTriangles) {
      const result = RayCast.intersectTriangle(rayOrigin, rayDirectionNormalized, triangle);
      if (result !== undefined && result < shortestRayLength && !(mode === RayCastMode.Bounded && result > rayLength)) {
        shortestRayLength = result;
        shortestRayTargetModel = node;
      }
    }

    if (shortestRayTargetModel) {
      return {
        target: shortestRayTargetModel,
        hitPosition: rayDirectionNormalized.scale(shortestRayLength).addSelf(rayOrigin),
        hitDistance: shortestRayLength,
      };
    } else {
      return undefined;
    }
  }

  /**
   * Test for intersection between a ray and an {@linkcode AxisAlignedBoundingBox} (AABB).
   * @param rayOrigin Origin of the ray being cast.
   * @param rayDirection Direction of the ray being cast. Does not need to be normalized.
   * @param aabb {@linkcode AxisAlignedBoundingBox} to cast against.
   * @returns Intersection point expressed as a scalar of {@linkcode rayDirection}, or `undefined` if no intersection.
   */
  public static intersectAABB(rayOrigin: IReadonlyVector3, rayDirection: IReadonlyVector3, aabb: IReadonlyAxisAlignedBoundingBox): number | undefined {
    /* Min */
    const tMinX = (aabb.xMin - rayOrigin.x) / rayDirection.x;
    const tMinY = (aabb.yMin - rayOrigin.y) / rayDirection.y;
    const tMinZ = (aabb.zMin - rayOrigin.z) / rayDirection.z;
    /* Max */
    const tMaxX = (aabb.xMax - rayOrigin.x) / rayDirection.x;
    const tMaxY = (aabb.yMax - rayOrigin.y) / rayDirection.y;
    const tMaxZ = (aabb.zMax - rayOrigin.z) / rayDirection.z;

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
  }

  private static readonly tmp_intersectTriangle: Vector3[] = [Vector3.zero(), Vector3.zero(), Vector3.zero(), Vector3.zero()];
  /**
   * Test for intersection between a ray and a {@linkcode Triangle}.
   * @param rayOrigin Origin of the ray being cast.
   * @param rayDirection Direction of the ray being cast. Does not need to be normalized.
   * @param triangle {@linkcode Triangle} to cast against.
   * @returns Intersection point expressed as a scalar of {@linkcode rayDirection}, or `undefined` if no intersection.
  */
  // From: https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm
  public static intersectTriangle(rayOrigin: IReadonlyVector3, rayDirection: IReadonlyVector3, triangle: Triangle): number | undefined {
    const edge1 = RayCast.tmp_intersectTriangle[0].setValue(triangle[1]).subtractSelf(triangle[0]);
    const edge2 = RayCast.tmp_intersectTriangle[1].setValue(triangle[2]).subtractSelf(triangle[0]);

    const ray_cross_e2 = RayCast.tmp_intersectTriangle[2].setValue(rayDirection).crossSelf(edge2);
    const det = edge1.dot(ray_cross_e2);

    if (det > -Number.EPSILON && det < Number.EPSILON) {
      return undefined; // Ray is parallel to triangle
    }

    const inv_det = 1 / det;
    const s = RayCast.tmp_intersectTriangle[3].setValue(rayOrigin).subtractSelf(triangle[0]);
    const u = inv_det * s.dot(ray_cross_e2);
    if (u < 0 || u > 1) {
      return undefined;
    }

    const s_cross_e1 = s.crossSelf(edge1);
    const v = inv_det * rayDirection.dot(s_cross_e1);
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
}

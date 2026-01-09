import type { SubMesh } from "@polyzone/engine/models";
import { Vector3 } from "@polyzone/engine/util/vector";

import { AxisAlignedBoundingBox } from "../AxisAlignedBoundingBox";
import { SATColliderShape, type SatProjection } from "./SatColliderShape";
import type { CalculateIntersectionResult, ColliderShape, GetSceneNodeFn } from "./ColliderShape";


export interface ConvexMeshColliderShapeConstructorArgs {
  mesh: SubMesh;
}
export class ConvexMeshColliderShape extends SATColliderShape {
  public mesh: SubMesh;

  public constructor(getSceneNode: GetSceneNodeFn, { mesh }: ConvexMeshColliderShapeConstructorArgs) {
    super(getSceneNode);
    this.mesh = mesh;
  }

  public getAABB(offset?: Vector3): AxisAlignedBoundingBox {
    throw new Error(`Not implemented`);
  }

  public calculateIntersection(other: ColliderShape, hintVector: Vector3): CalculateIntersectionResult | undefined {
    if (other instanceof SATColliderShape) {
      return this.computeSAT(other, hintVector);
    } else {
      throw new Error(`Unimplemented collider shape: ${other.constructor.name}`);
    }
  }

  public getSATNormals(): Vector3[] {
    throw new Error("Method not implemented.");
  }
  public getSATEdges(): Vector3[] {
    throw new Error("Method not implemented.");
  }
  public projectToAxis(axis: Vector3): SatProjection {
    throw new Error("Method not implemented.");
  }
}

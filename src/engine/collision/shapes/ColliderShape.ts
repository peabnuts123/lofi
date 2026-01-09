import { vec3, type mat4 } from "gl-matrix";

import { SceneNode } from "@polyzone/engine/scene";
import type { Rotation } from "@polyzone/engine/util/Rotation";
import { Vector3 } from "@polyzone/engine/util/vector";
import { AxisAlignedBoundingBox } from "../AxisAlignedBoundingBox";

export type GetSceneNodeFn = () => SceneNode;

export interface CalculateIntersectionResult { // @TODO is it different from `ColliderComputeMoveResult`
  /* @TODO do these need better names? */
  // result: Vector3;
  mtv: Vector3; // @TODO if we don't get this for free, don't include it
  isShorter: boolean;
  // intersectionPoint: Vector3;
  // intersectionDistance: number;
}

export abstract class ColliderShape {
  // @TODO If we expose worldMatrixIsDirty then we could cache this
  // private readonly sceneNode: SceneNode;
  private getSceneNode: GetSceneNodeFn;
  protected readonly _pointTmp = vec3.create();

  public constructor(getSceneNode: GetSceneNodeFn) {
    this.getSceneNode = getSceneNode;
  }

  public abstract getAABB(offset?: Vector3): AxisAlignedBoundingBox;
  public abstract calculateIntersection(other: ColliderShape, hintVector: Vector3): CalculateIntersectionResult | undefined;

  /**
   * Given some shape in local space, calculate the AABB that encompasses it in world space.
   * @param points Vertices of representative local shape (e.g. a bounding box)
   * @returns Axis-aligned bounding box containing shape, in world space
   */
  protected calculateAABBFromLocalShape(points: vec3[]): AxisAlignedBoundingBox {
    const min = new Vector3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    const max = new Vector3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);

    for (const p of points) {
      // Transform each point by world matrix
      vec3.transformMat4(this._pointTmp, p, this.worldMatrix);

      // Record mins/maxes
      if (this._pointTmp[0] < min.x) min.x = this._pointTmp[0];
      if (this._pointTmp[0] > max.x) max.x = this._pointTmp[0];
      if (this._pointTmp[1] < min.y) min.y = this._pointTmp[1];
      if (this._pointTmp[1] > max.y) max.y = this._pointTmp[1];
      if (this._pointTmp[2] < min.z) min.z = this._pointTmp[2];
      if (this._pointTmp[2] > max.z) max.z = this._pointTmp[2];
    }

    return new AxisAlignedBoundingBox({
      xMin: min.x,
      xMax: max.x,
      yMin: min.y,
      yMax: max.y,
      zMin: min.z,
      zMax: max.z,
    });
  }

  protected get sceneNode(): SceneNode {
    return this.getSceneNode();
  }
  protected get worldMatrix(): mat4 {
    return this.sceneNode.worldMatrix;
  }
  protected get absoluteRotation(): Rotation {
    return this.sceneNode.absoluteRotation;
  }
  protected get absolutePosition(): Vector3 {
    return this.sceneNode.absolutePosition;
  }
  protected get absoluteScale(): Vector3 {
    return this.sceneNode.absoluteScale;
  }
}

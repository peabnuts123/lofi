import  { Vector3, type IReadonlyVector3 } from "@lopoly/core/math/Vector3";
import  { AxisAlignedBoundingBox } from "@lopoly/engine/collision";

import { ColliderNode, type CalculateIntersectionResult } from "./ColliderNode";

export type SatProjection = [min: number, max: number]
export abstract class SATColliderNode extends ColliderNode {
  protected abstract getSATNormals(): readonly IReadonlyVector3[];
  protected abstract getSATEdges(): readonly IReadonlyVector3[];
  protected abstract getVerticesWorldSpace(offset?: IReadonlyVector3): readonly IReadonlyVector3[];

  public intersects(other: ColliderNode): boolean {
    if (other instanceof SATColliderNode) {
      return this.testSAT(other);
    } else {
      throw new Error(`Unimplemented collider: ${other.constructor.name}`);
    }
  }

  private tmp_getAABB: AxisAlignedBoundingBox = AxisAlignedBoundingBox.zero();
  public override getAABB(offset?: Vector3): AxisAlignedBoundingBox {
    const verticesWorldSpace = this.getVerticesWorldSpace(offset);
    return this.tmp_getAABB.fromVerticesSelf(verticesWorldSpace);
  }

  protected projectToAxis(axis: IReadonlyVector3, offset?: IReadonlyVector3): SatProjection {
    const verticesWorldSpace = this.getVerticesWorldSpace(offset);
    let min: number = Infinity;
    let max: number = -Infinity;

    for (const vertex of verticesWorldSpace) {
      const projection = vertex.dot(axis); // @NOTE don't need to divide by axis length since axis is normalized
      if (projection < min) {
        min = projection;
      }
      if (projection > max) {
        max = projection;
      }
    }

    return [min, max];
  }

  protected calculateIntersection(other: ColliderNode, hintVector: Vector3): CalculateIntersectionResult | undefined {
    if (other instanceof SATColliderNode) {
      return this.computeSAT(other, hintVector);
    } else {
      throw new Error(`Unimplemented collider: ${other.constructor.name}`);
    }
  }

  protected testSAT(other: SATColliderNode): boolean {
    const projectionAxes = this.getSATAxes(other);

    for (const axis of projectionAxes) {
      const [minA, maxA] = this.projectToAxis(axis);
      const [minB, maxB] = other.projectToAxis(axis);

      const overlap = Math.min(maxB - minA, maxA - minB);

      if (overlap <= 0) {
        // Negative overlap = no overlap = early exit since shapes DO NOT intersect
        return false;
      }
    }

    return true;
  }

  protected computeSAT(other: SATColliderNode, hintVector: Vector3): CalculateIntersectionResult | undefined {
    const projectionAxes = this.getSATAxes(other);

    let shortestOverlap: number | undefined = undefined;
    let shortestMTV: Vector3 | undefined = undefined;
    let bestResultIsShorterThanHintVector = false;
    const hintVectorLengthSqr = hintVector.lengthSquared();

    for (const axis of projectionAxes) {
      const [minA, maxA] = this.projectToAxis(axis, hintVector);
      const [minB, maxB] = other.projectToAxis(axis);

      let overlap: number;
      let mtv: Vector3;
      const positiveOverlap = maxB - minA;
      const negativeOverlap = maxA - minB;

      // @NOTE Make sure mtv is pointing the correct way
      // Sorry, the variable names here were hard to name
      if (positiveOverlap < negativeOverlap) {
        overlap = positiveOverlap;
        mtv = axis.scale(overlap);
      } else {
        overlap = negativeOverlap;
        mtv = axis.scale(-overlap);
      }

      if (overlap <= 0) {
        // Negative overlap = no overlap = early exit since shapes DO NOT intersect
        return undefined;
      }

      // Minimum translation vector is distance required to
      // resolve the intersection which is the inverse of the
      // amount of overlap

      const resultVectorLengthSqr = (
        (hintVector.x + mtv.x) * (hintVector.x + mtv.x) +
        (hintVector.y + mtv.y) * (hintVector.y + mtv.y) +
        (hintVector.z + mtv.z) * (hintVector.z + mtv.z)
      );
      const isResultShorterThanHintVector = resultVectorLengthSqr < hintVectorLengthSqr;

      // @NOTE we ideally want a result that is shorter than the hintVector.
      // However we'll take a longer result if that's all we have
      // So we just gotta track whether our best result is shorter or not
      const discardResult = !isResultShorterThanHintVector && bestResultIsShorterThanHintVector;
      // @NOTE If all we have is results that are longer than the hint vector,
      // then any shorter result is better, so we override the current best,
      // even if it isn't shorter
      // @NOTE This doesn't entirely prevent tunnelling, only in some scenarios.
      const overrideCurrentShortest = isResultShorterThanHintVector && !bestResultIsShorterThanHintVector;

      // Track shortest overlap
      if (!discardResult && (overrideCurrentShortest || shortestOverlap === undefined || overlap < shortestOverlap)) {
        shortestOverlap = overlap;
        shortestMTV = mtv;
        bestResultIsShorterThanHintVector = isResultShorterThanHintVector;
      }
    }

    if (shortestMTV === undefined) {
      return undefined;
    }

    return {
      mtv: shortestMTV,
      isShorter: bestResultIsShorterThanHintVector,
    };
  }

  private tmp_getSATAxes_vector = Vector3.zero();
  private tmp_getSATAxes_addProjectionAxis_vector = Vector3.zero();
  private getSATAxes(other: SATColliderNode): readonly IReadonlyVector3[] {
    const projectionAxes: IReadonlyVector3[] = [];

    /**
     * Add a projection axis to the list of all projection axes,
     * ensuring the axis is unique
     */
    const addProjectionAxis = (axis: IReadonlyVector3): void => {
      // Ensure axis is not parallel / duplicate
      for (const existingProjectionAxis of projectionAxes) {
        const crossProduct = this.tmp_getSATAxes_addProjectionAxis_vector
          .setValue(axis)
          .crossSelf(existingProjectionAxis);
        if (crossProduct.lengthSquared() < 0.0001) {
          // Axis is duplicate / parallel, break
          return;
        }
      }

      // Axis is unique
      projectionAxes.push(axis);
    };

    // Collect normals frome each shape
    for (const normal of this.getSATNormals()) {
      addProjectionAxis(normal);
    }
    for (const normal of other.getSATNormals()) {
      addProjectionAxis(normal);
    }

    // Collection edges from each shape, then compute the
    // cross product of each pair of edges
    for (const edgeA of this.getSATEdges()) {
      for (const edgeB of other.getSATEdges()) {
        const axis = this.tmp_getSATAxes_vector
          .setValue(edgeA)
          .crossSelf(edgeB);

        // Ignore degenerate axes (parallel edges where lengthSqr === 0)
        if (axis.lengthSquared() > 0.0001) {
          addProjectionAxis(axis.normalizeSelf());
        }
      }
    }

    return projectionAxes;
  }
}

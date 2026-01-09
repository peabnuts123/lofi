
import { Vector3 } from "@polyzone/engine/util/vector";
import { ColliderShape, type CalculateIntersectionResult } from "./ColliderShape";


export type SatProjection = [min: number, max: number]
export abstract class SATColliderShape extends ColliderShape {
  public abstract getSATNormals(): Vector3[];
  public abstract getSATEdges(): Vector3[];
  public abstract projectToAxis(axis: Vector3): SatProjection;

  protected computeSAT(other: SATColliderShape, hintVector: Vector3): CalculateIntersectionResult | undefined {
    /*
    // @TODO remove
      ALGORITHM
      gather axes (must be normalized so a.b is a measurement of MTV)
        normals of each shape
        cross product of each edge combination (ignore parallel edges where lengthSqr === 0)

      for each axis:
        project shapes onto axis, receive min/max T values
        if ranges don't overlap, early exit
        OTHERWISE, keep track of shortest overlap (MTV = overlap * axis)
          - preference for `MTV.dot(hintVector) <= 0` if any result is (approximation of "shorter")

      return shortest overlap, if any.
     */

    /* @TODO remove parallel axes */
    const tmpVec = Vector3.zero();
    const tmpVec__addProjectionAxis = Vector3.zero();
    const projectionAxes: Vector3[] = [];

    /**
     * Add a projection axis to the list of all projection axes,
     * ensuring the axis is unique
     */
    function addProjectionAxis(axis: Vector3): void {
      // Ensure axis is not parallel / duplicate
      for (const existingProjectionAxis of projectionAxes) {
        tmpVec__addProjectionAxis.setValue(axis);
        tmpVec__addProjectionAxis.crossSelf(existingProjectionAxis);
        if (tmpVec__addProjectionAxis.lengthSquared() < 0.0001) {
          // Axis is duplicate / parallel, break
          return;
        }
      }

      // Axis is unique
      projectionAxes.push(axis);
    }

    // Collect normals frome each shape
    for (const normal of this.getSATNormals().concat(other.getSATNormals())) {
      addProjectionAxis(normal);
    }

    // Collection edges from each shape, then compute the
    // cross product of each pair of edges
    for (const edgeA of this.getSATEdges()) {
      for (const edgeB of other.getSATEdges()) {
        tmpVec.setValue(edgeA);
        tmpVec.crossSelf(edgeB);
        // Ignore degenerate axes (parallel edges where lengthSqr === 0)
        if (tmpVec.lengthSquared() > 0.0001) {
          addProjectionAxis(tmpVec.normalizeSelf());
        }
      }
    }

    let shortestOverlap: number | undefined = undefined;
    let shortestMTV: Vector3 | undefined = undefined;
    let bestResultIsShorterThanHintVector = false;
    const hintVectorLengthSqr = hintVector.lengthSquared();

    for (const axis of projectionAxes) {
      const [minA, maxA] = this.projectToAxis(axis);
      const [minB, maxB] = other.projectToAxis(axis);

      let overlap: number;
      let mtv: Vector3;
      const positiveOverlap = maxB - minA;
      const negativeOverlap = maxA - minB;

      // @NOTE Make sure mtv is pointing the correct way
      // Sorry, the variable names here were hard to name
      if (positiveOverlap < negativeOverlap) {
        overlap = positiveOverlap;
        mtv = axis.multiply(overlap);
      } else {
        overlap = negativeOverlap;
        mtv = axis.multiply(-overlap);
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

      // Track shortest overlap
      if (!discardResult && (shortestOverlap === undefined || overlap < shortestOverlap)) {
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

}

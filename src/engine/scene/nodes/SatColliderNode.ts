import { Vector3 } from "@polyzone/engine/util/vector";
import { ColliderNode, type CalculateIntersectionResult } from "./ColliderNode";

export type SatProjection = [min: number, max: number]
export abstract class SATColliderNode extends ColliderNode {
  protected abstract getSATNormals(): Vector3[];
  protected abstract getSATEdges(): Vector3[];
  protected abstract projectToAxis(axis: Vector3, offset?: Vector3): SatProjection;

  public intersects(other: ColliderNode): boolean {
    if (other instanceof SATColliderNode) {
      return this.testSAT(other);
    } else {
      throw new Error(`Unimplemented collider: ${other.constructor.name}`);
    }
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

  private getSATAxes(other: SATColliderNode): Vector3[] {
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

    return projectionAxes;
  }
}

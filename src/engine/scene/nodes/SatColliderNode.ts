import { Vector3 } from "@polyzone/engine/util/vector";
import { AxisAlignedBoundingBox } from "@polyzone/engine/collision";
import { ColliderNode, type CalculateIntersectionResult } from "./ColliderNode";

export type SatProjection = [min: number, max: number]
export abstract class SATColliderNode extends ColliderNode {
  protected abstract getSATNormals(): Vector3[];
  protected abstract getSATEdges(): Vector3[];
  protected abstract getVerticesWorldSpace(offset?: Vector3): Vector3[];

  public intersects(other: ColliderNode): boolean {
    if (other instanceof SATColliderNode) {
      return this.testSAT(other);
    } else {
      throw new Error(`Unimplemented collider: ${other.constructor.name}`);
    }
  }

  public override getAABB(offset?: Vector3): AxisAlignedBoundingBox {
    const verticesWorldSpace = this.getVerticesWorldSpace();
    const min = new Vector3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    const max = new Vector3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);

    for (const vertex of verticesWorldSpace) {
      if (vertex.x < min.x) min.x = vertex.x;
      if (vertex.x > max.x) max.x = vertex.x;
      if (vertex.y < min.y) min.y = vertex.y;
      if (vertex.y > max.y) max.y = vertex.y;
      if (vertex.z < min.z) min.z = vertex.z;
      if (vertex.z > max.z) max.z = vertex.z;
    }

    if (offset !== undefined) {
      min.addSelf(offset);
      max.addSelf(offset);
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

  protected projectToAxis(axis: Vector3, offset?: Vector3): SatProjection {
    const verticesWorldSpace = this.getVerticesWorldSpace(offset);
    let min: number = Number.MAX_SAFE_INTEGER;
    let max: number = Number.MIN_SAFE_INTEGER;

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

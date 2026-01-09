import { quat, vec3 } from "gl-matrix";

import { type IWireframeDrawable } from "@polyzone/engine/util/DrawDebug";
import { Vector3 } from "@polyzone/engine/util/vector";

import { AxisAlignedBoundingBox } from "../AxisAlignedBoundingBox";
import { SATColliderShape, type SatProjection } from "./SatColliderShape";
import type { CalculateIntersectionResult, ColliderShape, GetSceneNodeFn } from "./ColliderShape";


export interface BoxColliderShapeConstructorArgs {
  x: number;
  y: number;
  z: number;
}
export class BoxColliderShape extends SATColliderShape implements IWireframeDrawable {
  public x: number;
  public y: number;
  public z: number;

  private _tmpVec: vec3 = vec3.create();
  private _tmpQuat: quat = quat.create();

  public constructor(getSceneNode: GetSceneNodeFn, { x, y, z }: BoxColliderShapeConstructorArgs) {
    super(getSceneNode);
    this.x = x;
    this.y = y;
    this.z = z;
  }

  public getAABB(offset?: Vector3): AxisAlignedBoundingBox {
    const verticesWorldSpace = this.verticesWorldSpace;
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

  public calculateIntersection(other: ColliderShape, hintVector: Vector3): CalculateIntersectionResult | undefined {
    if (other instanceof SATColliderShape) {
      return this.computeSAT(other, hintVector);
    } else {
      throw new Error(`Unimplemented collider shape: ${other.constructor.name}`);
    }
  }

  public getSATNormals(): Vector3[] {
    quat.set(this._tmpQuat, this.absoluteRotation.q.x, this.absoluteRotation.q.y, this.absoluteRotation.q.z, this.absoluteRotation.q.w);

    // Forward
    vec3.set(this._tmpVec, 0, 0, 1);
    vec3.transformQuat(this._tmpVec, this._tmpVec, this._tmpQuat);
    const forward = new Vector3(this._tmpVec[0], this._tmpVec[1], this._tmpVec[2]);

    // Up
    vec3.set(this._tmpVec, 0, 1, 0);
    vec3.transformQuat(this._tmpVec, this._tmpVec, this._tmpQuat);
    const up = new Vector3(this._tmpVec[0], this._tmpVec[1], this._tmpVec[2]);

    // Right
    vec3.set(this._tmpVec, 1, 0, 0);
    vec3.transformQuat(this._tmpVec, this._tmpVec, this._tmpQuat);
    const right = new Vector3(this._tmpVec[0], this._tmpVec[1], this._tmpVec[2]);
    return [
      forward,
      up,
      right,
    ];
  }

  public getSATEdges(): Vector3[] {
    // @NOTE for a box, the edges are just the same as the normals.
    // Normals are already normalized.
    return this.getSATNormals();
  }

  public projectToAxis(axis: Vector3): SatProjection {
    const verticesWorldSpace = this.verticesWorldSpace;
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

  public getWireframeFaces(): Vector3[][] {
    const verticesWorldSpace = this.verticesWorldSpace;
    return [
      // Front face
      [verticesWorldSpace[1], verticesWorldSpace[5], verticesWorldSpace[7], verticesWorldSpace[3]],
      // Back face
      [verticesWorldSpace[4], verticesWorldSpace[0], verticesWorldSpace[2], verticesWorldSpace[6]],
      // Right face
      [verticesWorldSpace[0], verticesWorldSpace[1], verticesWorldSpace[3], verticesWorldSpace[2]],
      // Left face
      [verticesWorldSpace[5], verticesWorldSpace[4], verticesWorldSpace[6], verticesWorldSpace[7]],
      // Top face
      [verticesWorldSpace[4], verticesWorldSpace[5], verticesWorldSpace[1], verticesWorldSpace[0]],
      // Bottom face
      [verticesWorldSpace[2], verticesWorldSpace[3], verticesWorldSpace[7], verticesWorldSpace[6]],
    ];
  }

  private get verticesWorldSpace(): Vector3[] {
    const halfX = this.x / 2;
    const halfY = this.y / 2;
    const halfZ = this.z / 2;

    const verticesLocalSpace = [
      new Vector3(halfX, halfY, halfZ),   /* 0 */
      new Vector3(halfX, halfY, -halfZ),  /* 1 */
      new Vector3(halfX, -halfY, halfZ),  /* 2 */
      new Vector3(halfX, -halfY, -halfZ), /* 3 */
      new Vector3(-halfX, halfY, halfZ),  /* 4 */
      new Vector3(-halfX, halfY, -halfZ), /* 5 */
      new Vector3(-halfX, -halfY, halfZ), /* 6 */
      new Vector3(-halfX, -halfY, -halfZ),/* 7 */
    ];

    return verticesLocalSpace.map((vertexLocalSpace) => {
      vec3.set(this._tmpVec, vertexLocalSpace.x, vertexLocalSpace.y, vertexLocalSpace.z);
      vec3.transformMat4(this._tmpVec, this._tmpVec, this.worldMatrix);
      vertexLocalSpace.setValue(this._tmpVec[0], this._tmpVec[1], this._tmpVec[2]);
      return vertexLocalSpace;
    });
  }
}

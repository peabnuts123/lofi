import { AxisAlignedBoundingBox } from "@polyzone/engine/collision";
import { type IScene } from "@polyzone/engine/scene";
import { Vector3 } from "@polyzone/engine/util/vector";
import { SATColliderNode, type SatProjection } from "./SatColliderNode";
import type { CollisionGroup } from "./ColliderNode";

export interface BoxColliderShapeConstructorArgs {
  x: number;
  y: number;
  z: number;
}
export class BoxColliderNode extends SATColliderNode {
  public x: number;
  public y: number;
  public z: number;

  private static readonly NormalsLocalSpace: Vector3[] = [
    new Vector3(1, 0, 0),
    new Vector3(0, 1, 0),
    new Vector3(0, 0, 1),
  ];
  private _normalsWorldSpaceCache: Vector3[];


  private static readonly NormalisedVerticesLocalSpace: Vector3[] = [
    new Vector3(1, 1, 1),   /* 0 */
    new Vector3(1, 1, -1),  /* 1 */
    new Vector3(1, -1, 1),  /* 2 */
    new Vector3(1, -1, -1), /* 3 */
    new Vector3(-1, 1, 1),  /* 4 */
    new Vector3(-1, 1, -1), /* 5 */
    new Vector3(-1, -1, 1), /* 6 */
    new Vector3(-1, -1, -1),/* 7 */
  ];
  /** Cached array to prevent allocations when recomputing vertices in world space */
  private _verticesWorldSpaceCache: Vector3[];

  public constructor(scene: IScene, name: string, group: CollisionGroup, { x, y, z }: BoxColliderShapeConstructorArgs) {
    super(scene, name, group);
    this.x = x;
    this.y = y;
    this.z = z;
    this._normalsWorldSpaceCache = BoxColliderNode.NormalsLocalSpace.map((_normal) => Vector3.zero());
    this._verticesWorldSpaceCache = BoxColliderNode.NormalisedVerticesLocalSpace.map((_) => Vector3.zero());
  }

  public getAABB(offset?: Vector3): AxisAlignedBoundingBox {
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

  protected getSATNormals(): Vector3[] {
    BoxColliderNode.NormalsLocalSpace.forEach((normal, i) =>
      this._normalsWorldSpaceCache[i]
        .setValue(normal)
        .multiplySelf(this.absoluteRotation.q),
    );
    return this._normalsWorldSpaceCache;
  }

  protected getSATEdges(): Vector3[] {
    // @NOTE for a box, the edges are just the same as the normals.
    // Normals are already normalized.
    return this.getSATNormals();
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

  protected getWireframeFaces(): Vector3[][] {
    const verticesWorldSpace = this.getVerticesWorldSpace();
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

  // @TODO If we could observe worldMatrixDirty we could cache this
  private getVerticesWorldSpace(offset: Vector3 = Vector3.zero()): Vector3[] {
    const halfDimensions = new Vector3(this.x / 2, this.y / 2, this.z / 2);

    BoxColliderNode.NormalisedVerticesLocalSpace.forEach((normalizedLocalVertex, i) => {
      this._verticesWorldSpaceCache[i]
        .setValue(normalizedLocalVertex)
        .multiplySelf(halfDimensions)
        .multiplySelf(this.worldMatrix)
        .addSelf(offset);
    });

    return this._verticesWorldSpaceCache;
  }
}

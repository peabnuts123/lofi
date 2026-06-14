import { Vector3 } from "@lofi/core/math/vector";
import { SceneNode, type IScene } from "@lofi/engine/scene";
import type { IWireframeDrawable, WireframeFaces } from "@lofi/engine/util/DrawDebug";
import { SATColliderNode } from "./SatColliderNode";
import type { CollisionGroup } from "./ColliderNode";

export interface BoxColliderShapeConstructorArgs {
  x: number;
  y: number;
  z: number;
}
export class BoxColliderNode extends SATColliderNode implements IWireframeDrawable {
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

  public constructor(scene: IScene, name: string, group: CollisionGroup, { x, y, z }: BoxColliderShapeConstructorArgs, parent?: SceneNode) {
    super(scene, name, group, parent);
    this.x = x;
    this.y = y;
    this.z = z;
    this._normalsWorldSpaceCache = BoxColliderNode.NormalsLocalSpace.map((_normal) => Vector3.zero());
    this._verticesWorldSpaceCache = BoxColliderNode.NormalisedVerticesLocalSpace.map((_) => Vector3.zero());
  }

  protected override getSATNormals(): Vector3[] {
    BoxColliderNode.NormalsLocalSpace.forEach((normal, i) =>
      this._normalsWorldSpaceCache[i]
        .setValue(normal)
        .multiplySelf(this.absoluteRotation.q),
    );
    return this._normalsWorldSpaceCache;
  }

  protected override getSATEdges(): Vector3[] {
    // @NOTE for a box, the edges are just the same as the normals.
    // Normals are already normalized.
    return this.getSATNormals();
  }

  public getWireframeFaces(): WireframeFaces {
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
  private _getVerticesWorldSpace__HalfDimensionsTmp = Vector3.zero();
  protected getVerticesWorldSpace(offset?: Vector3): Vector3[] {
    this._getVerticesWorldSpace__HalfDimensionsTmp.setValue(this.x / 2, this.y / 2, this.z / 2);

    BoxColliderNode.NormalisedVerticesLocalSpace.forEach((normalizedLocalVertex, i) => {
      this._verticesWorldSpaceCache[i]
        .setValue(normalizedLocalVertex)
        .multiplySelf(this._getVerticesWorldSpace__HalfDimensionsTmp)
        .multiplySelf(this.worldMatrix);

      if (offset) {
        this._verticesWorldSpaceCache[i]
          .addSelf(offset);
      }
    });

    return this._verticesWorldSpaceCache;
  }
}

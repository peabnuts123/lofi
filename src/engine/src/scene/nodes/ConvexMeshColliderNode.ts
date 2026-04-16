import { Vector3 } from "@lofi/core/math/vector";
import { SceneNode, type IScene } from "@lofi/engine/scene";
import type { MeshGeometry, Model, Triangle } from "@lofi/engine/models";
import type { IWireframeDrawable } from "@lofi/engine/util/DrawDebug";

import { SATColliderNode } from "./SatColliderNode";
import type { CollisionGroup } from "./ColliderNode";

export interface ConvexMeshColliderShapeConstructorArgs {
  mesh: MeshGeometry;
}
export class ConvexMeshColliderNode extends SATColliderNode implements IWireframeDrawable {
  /** Cached arrays to prevent allocations when recomputing values in world space */
  private _verticesWorldSpaceCache: Vector3[];
  private _normalsWorldSpaceCache: Vector3[];
  private _edgesWorldSpaceCache: Vector3[];

  // private readonly mesh: MeshGeometry;
  private readonly model: Model;

  public constructor(scene: IScene, name: string, group: CollisionGroup, model: Model, parent?: SceneNode) {
    super(scene, name, group, parent);

    this.model = model;

    // Initialise caches to correct sizes
    this._verticesWorldSpaceCache = this.model.allVertexPositions.map((_) => Vector3.zero());
    this._normalsWorldSpaceCache = this.model.allTriangleNormals.map((_) => Vector3.zero());
    this._edgesWorldSpaceCache = this.model.allEdges.map((_) => Vector3.zero());
  }

  protected override getSATNormals(): Vector3[] {
    // const
    this.model.allTriangleNormals.forEach((normal, i) =>
      this._normalsWorldSpaceCache[i]
        .setValue(normal)
        .multiplySelf(this.absoluteRotation.q),
    );
    return this._normalsWorldSpaceCache;
  }

  protected override getSATEdges(): Vector3[] {
    this.model.allEdges.forEach((edge, i) =>
      this._edgesWorldSpaceCache[i]
        // Compute Edge = B - A
        .setValue(edge[1])
        .subtractSelf(edge[0])
        // Normalize edge
        .normalizeSelf()
        // Rotate by world rotation
        .multiplySelf(this.absoluteRotation.q),
    );
    return this._edgesWorldSpaceCache;
  }

  // @TODO If we could observe worldMatrixDirty we could cache this
  protected getVerticesWorldSpace(offset: Vector3 = Vector3.zero()): Vector3[] {
    this.model.allVertexPositions.forEach((vertexPosition, i) => {
      this._verticesWorldSpaceCache[i]
        .setValue(vertexPosition)
        .multiplySelf(this.worldMatrix)
        .addSelf(offset);
    });

    return this._verticesWorldSpaceCache;
  }

  public getWireframeFaces(): Vector3[][] {
    const vertices = this.getVerticesWorldSpace();
    return this.model.allTriangleIndices.map((triangle) => ([
      vertices[triangle[0]],
      vertices[triangle[1]],
      vertices[triangle[2]],
    ]) satisfies Triangle);
  }
}

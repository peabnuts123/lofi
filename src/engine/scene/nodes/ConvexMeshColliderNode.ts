import { type IScene } from "@polyzone/engine/scene";
import { Vector3 } from "@polyzone/engine/util/vector";
import type { Edge, MeshGeometry, Model, Triangle, TriangleIndices } from "@polyzone/engine/models";
import type { IWireframeDrawable } from "@polyzone/engine/util/DrawDebug";
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

  public constructor(scene: IScene, name: string, group: CollisionGroup, model: Model) {
    super(scene, name, group);

    this.model = model;

    // Initialise caches to correct sizes
    this._verticesWorldSpaceCache = this.allVertexPositions.map((_) => Vector3.zero());
    this._normalsWorldSpaceCache = this.allTriangleNormals.map((_) => Vector3.zero());
    this._edgesWorldSpaceCache = this.allEdges.map((_) => Vector3.zero());
  }

  protected override getSATNormals(): Vector3[] {
    // const
    this.allTriangleNormals.forEach((normal, i) =>
      this._normalsWorldSpaceCache[i]
        .setValue(normal)
        .multiplySelf(this.absoluteRotation.q),
    );
    return this._normalsWorldSpaceCache;
  }

  protected override getSATEdges(): Vector3[] {
    this.allEdges.forEach((edge, i) =>
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
    this.allVertexPositions.forEach((vertexPosition, i) => {
      this._verticesWorldSpaceCache[i]
        .setValue(vertexPosition)
        .multiplySelf(this.worldMatrix)
        .addSelf(offset);
    });

    return this._verticesWorldSpaceCache;
  }

  public getWireframeFaces(): Vector3[][] {
    const vertices = this.getVerticesWorldSpace();
    return this.allTriangleIndices.map((triangle) => ([
      vertices[triangle[0]],
      vertices[triangle[1]],
      vertices[triangle[2]],
    ]) satisfies Triangle);
  }

  private get allVertexPositions(): Vector3[] {
    return this.model.subMeshes.flatMap((subMesh) => subMesh.geometry.vertexPositions);
  }
  private get allTriangleNormals(): Vector3[] {
    return this.model.subMeshes.flatMap((subMesh) => subMesh.geometry.triangleNormals);
  }
  private get allTriangleIndices(): TriangleIndices[] {
    return this.model.subMeshes.flatMap((subMesh) => subMesh.geometry.triangleIndices);
  }
  private get allEdges(): Edge[] {
    return this.model.subMeshes.flatMap((subMesh) => subMesh.geometry.edges);
  }
}

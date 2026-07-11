import { Vector3, type IReadonlyVector3 } from "@lofi/core/math/vector";
import { SceneNode, type IScene } from "@lofi/engine/scene";
import type { Model } from "@lofi/engine/models";
import type { IWireframeDrawable, WireframeFaces } from "@lofi/engine/util/DrawDebug";
import { ModelNodeGeometry } from "@lofi/engine/models/geometry";

import { SATColliderNode } from "./SatColliderNode";
import type { CollisionGroup } from "./ColliderNode";

export class ConvexMeshColliderNode extends SATColliderNode implements IWireframeDrawable {
  private _model: Model;
  private geometry: ModelNodeGeometry;

  public constructor(scene: IScene, name: string, group: CollisionGroup, model: Model, parent?: SceneNode) {
    super(scene, name, group, parent);

    this._model = model;
    this.geometry = new ModelNodeGeometry({
      model,
      worldMatrixComputed: this.worldMatrixComputed,
    });
  }

  protected override getSATNormals(): readonly IReadonlyVector3[] {
    return this.geometry.allTriangleNormals;
  }

  private readonly tmp_getSATEdges: Vector3[] = [];
  protected override getSATEdges(): readonly IReadonlyVector3[] {
    // Look up vertex positions of collider mesh
    const allEdges = this.geometry.allEdges;

    // Ensure tmp allocated values are the correct size
    if (this.tmp_getSATEdges.length > allEdges.length) {
      // Truncate array
      this.tmp_getSATEdges.length = allEdges.length;
    } else if (this.tmp_getSATEdges.length < allEdges.length) {
      // Allocate new values
      for (let i = this.tmp_getSATEdges.length; i < allEdges.length; i++) {
        this.tmp_getSATEdges[i] = Vector3.zero();
      }
    } // else arrays are the same length

    allEdges.forEach((edge, i) => {
      this.tmp_getSATEdges[i]
        // Compute Edge = B - A
        .setValue(edge[1])
        .subtractSelf(edge[0])
        // Normalize edge
        .normalizeSelf();

      // Rotate by world rotation
      this.absoluteRotation.q.rotateVectorInPlace(this.tmp_getSATEdges[i]);
    });

    return this.tmp_getSATEdges;
  }

  private readonly tmp_getVerticesWorldSpace: Vector3[] = [];
  protected getVerticesWorldSpace(offset?: IReadonlyVector3): readonly IReadonlyVector3[] {
    // Look up vertex positions of collider mesh
    const allVertexPositions = this.geometry.allVertexPositions;

    // Ensure tmp allocated values are the correct size
    if (this.tmp_getVerticesWorldSpace.length > allVertexPositions.length) {
      // Truncate array
      this.tmp_getVerticesWorldSpace.length = allVertexPositions.length;
    } else if (this.tmp_getVerticesWorldSpace.length < allVertexPositions.length) {
      // Allocate new values
      for (let i = this.tmp_getVerticesWorldSpace.length; i < allVertexPositions.length; i++) {
        this.tmp_getVerticesWorldSpace[i] = Vector3.zero();
      }
    } // else arrays are the same length


    // Assign / compute values
    allVertexPositions.forEach((vertexPosition, i) => {
      this.tmp_getVerticesWorldSpace[i]
        .setValue(vertexPosition);

      if (offset) {
        this.tmp_getVerticesWorldSpace[i]
          .addSelf(offset);
      }
    });

    return this.tmp_getVerticesWorldSpace;
  }

  public getWireframeFaces(): WireframeFaces {
    return this.geometry.allTriangles;
  }

  public get model(): Model { return this._model; }
  public set model(value: Model) {
    this._model = value;
    this.geometry = new ModelNodeGeometry({
      model: this._model,
      worldMatrixComputed: this.worldMatrixComputed,
    });
  }
}

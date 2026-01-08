import { quat, vec3, type mat4 } from "gl-matrix";

import { CollisionSystem } from "@polyzone/engine/collision";
import type { IEngine } from "@polyzone/engine/Engine";
import type { SubMesh } from "@polyzone/engine/models";
import { DrawableSceneNode, type DrawTask, type IScene, SceneNode } from "@polyzone/engine/scene";
import { DrawDebug, isWireframeDrawable, type IWireframeDrawable } from "@polyzone/engine/util/DrawDebug";
import type { Rotation } from "@polyzone/engine/util/Rotation";
import { Vector3 } from "@polyzone/engine/util/vector";

/*
  NOTES
  Sphere to convex polyhedron
    for each triangle of polyhedron
      ? Ensure dot(normal, sphere.center - v0) is not negative (to make sure sphere is on right side of face)
      Find shortest (sqr)distance to triangle from sphere.center: https://stackoverflow.com/questions/2924795/fastest-way-to-compute-point-to-triangle-distance-in-3d
        - MTV = radius - dot(normal, sphere.center - v0)
      Track smallest MTV
      If no MTV, no collision

    @NOTE might be able to skip some steps from the code above, see also other code samples in thread.
      Ideally we just deal with sqrDistance to triangle
    OR compute barycentric coords of projection of center to triangle plane and if u, v, w all > 0 then…
      center is perpendicular to triangle (? useful ?)

  Capsule to convex polyhedron
    ? Someone's code: https://photodiode.github.io/article/triangle-capsule-intersection.html
    ? Slow, but: https://blog.bearcats.nl/capsule-triangle-sweep/
 */


export interface AxisAlignedBoundingBoxConstructorArgs {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}
export class AxisAlignedBoundingBox {
  public xMin: number;
  public xMax: number;
  public yMin: number;
  public yMax: number;
  public zMin: number;
  public zMax: number;

  public constructor({
    xMin,
    xMax,
    yMin,
    yMax,
    zMin,
    zMax,
  }: AxisAlignedBoundingBoxConstructorArgs) {
    this.xMin = xMin;
    this.xMax = xMax;
    this.yMin = yMin;
    this.yMax = yMax;
    this.zMin = zMin;
    this.zMax = zMax;
  }

  public intersects(other: AxisAlignedBoundingBox): boolean {
    return !(
      this.xMax < other.xMin ||
      this.xMin > other.xMax ||
      this.yMax < other.yMin ||
      this.yMin > other.yMax ||
      this.zMax < other.zMin ||
      this.zMin > other.zMax
    );
  }
}

export type GetSceneNodeFn = () => SceneNode;

export abstract class ColliderShape {
  // @TODO If we expose worldMatrixIsDirty then we could cache this
  // private readonly sceneNode: SceneNode;
  private getSceneNode: GetSceneNodeFn;
  protected readonly _pointTmp = vec3.create();

  public constructor(getSceneNode: GetSceneNodeFn) {
    this.getSceneNode = getSceneNode;
  }

  public abstract getAABB(offset?: Vector3): AxisAlignedBoundingBox;
  public abstract calculateIntersection(other: ColliderShape, hintVector: Vector3): CalculateIntersectionResult | undefined;

  /**
   * Given some shape in local space, calculate the AABB that encompasses it in world space.
   * @param points Vertices of representative local shape (e.g. a bounding box)
   * @returns Axis-aligned bounding box containing shape, in world space
   */
  protected calculateAABBFromLocalShape(points: vec3[]): AxisAlignedBoundingBox {
    const min = new Vector3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    const max = new Vector3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);

    for (const p of points) {
      // Transform each point by world matrix
      vec3.transformMat4(this._pointTmp, p, this.worldMatrix);

      // Record mins/maxes
      if (this._pointTmp[0] < min.x) min.x = this._pointTmp[0];
      if (this._pointTmp[0] > max.x) max.x = this._pointTmp[0];
      if (this._pointTmp[1] < min.y) min.y = this._pointTmp[1];
      if (this._pointTmp[1] > max.y) max.y = this._pointTmp[1];
      if (this._pointTmp[2] < min.z) min.z = this._pointTmp[2];
      if (this._pointTmp[2] > max.z) max.z = this._pointTmp[2];
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

  protected get sceneNode(): SceneNode {
    return this.getSceneNode();
  }
  protected get worldMatrix(): mat4 {
    return this.sceneNode.worldMatrix;
  }
  protected get absoluteRotation(): Rotation {
    return this.sceneNode.absoluteRotation;
  }
  protected get absolutePosition(): Vector3 {
    return this.sceneNode.absolutePosition;
  }
  protected get absoluteScale(): Vector3 {
    return this.sceneNode.absoluteScale;
  }
}

export type SatProjection = [min: number, max: number]
export abstract class SATColliderShape extends ColliderShape {
  public abstract getSATNormals(): Vector3[];
  public abstract getSATEdges(): Vector3[];
  public abstract projectToAxis(axis: Vector3): SatProjection;
}

function computeSAT(shapeA: SATColliderShape, shapeB: SATColliderShape, hintVector: Vector3): CalculateIntersectionResult | undefined {
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
  for (const normal of shapeA.getSATNormals().concat(shapeB.getSATNormals())) {
    addProjectionAxis(normal);
  }

  // Collection edges from each shape, then compute the
  // cross product of each pair of edges
  for (const edgeA of shapeA.getSATEdges()) {
    for (const edgeB of shapeB.getSATEdges()) {
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
    const [minA, maxA] = shapeA.projectToAxis(axis);
    const [minB, maxB] = shapeB.projectToAxis(axis);

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
      return computeSAT(this, other, hintVector);
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

export interface ConvexMeshColliderShapeConstructorArgs {
  mesh: SubMesh;
}
export class ConvexMeshColliderShape extends SATColliderShape {
  public mesh: SubMesh;

  public constructor(getSceneNode: GetSceneNodeFn, { mesh }: ConvexMeshColliderShapeConstructorArgs) {
    super(getSceneNode);
    this.mesh = mesh;
  }

  public getAABB(offset?: Vector3): AxisAlignedBoundingBox {
    throw new Error(`Not implemented`);
  }

  public calculateIntersection(other: ColliderShape, hintVector: Vector3): CalculateIntersectionResult | undefined {
    if (other instanceof SATColliderShape) {
      return computeSAT(this, other, hintVector);
    } else {
      throw new Error(`Unimplemented collider shape: ${other.constructor.name}`);
    }
  }

  public getSATNormals(): Vector3[] {
    throw new Error("Method not implemented.");
  }
  public getSATEdges(): Vector3[] {
    throw new Error("Method not implemented.");
  }
  public projectToAxis(axis: Vector3): SatProjection {
    throw new Error("Method not implemented.");
  }
}

export interface ColliderComputeMoveResult {
  /* @TODO do these need better names? */
  result: Vector3;
  delta: Vector3; // @TODO if we don't get this for free, don't include it
  // intersectionPoint: Vector3;
  // intersectionDistance: number;
}
export interface CalculateIntersectionResult { // @TODO is it different from `ColliderComputeMoveResult`
  /* @TODO do these need better names? */
  // result: Vector3;
  mtv: Vector3; // @TODO if we don't get this for free, don't include it
  isShorter: boolean;
  // intersectionPoint: Vector3;
  // intersectionDistance: number;
}


export type CollisionGroup = number;

const MaxComputeMoveIterations = 4;
interface ComputeMoveOptions {
  allColliders: Array<{
    node: ColliderNode,
    aabb: AxisAlignedBoundingBox,
  }>;
  iteration: number;
}

export class ColliderNode extends DrawableSceneNode {
  public group: CollisionGroup;
  public shape: ColliderShape;

  public constructor(scene: IScene, name: string, group: CollisionGroup, shape: ColliderShape) {
    super(scene, name);
    if (group < 0 || group >= CollisionSystem.MaxCollisionGroups) {
      throw new Error(`Collision group must be in range 0-${CollisionSystem.MaxCollisionGroups - 1}`);
    }
    this.group = group;
    this.shape = shape;
  }

  public move(target: SceneNode, vector: Vector3): void {
    const movement = this.computeMove(vector);
    target.position.addSelf(movement.result);
  }

  public computeMove(vector: Vector3): ColliderComputeMoveResult {
    // Precompute list of all colliders that could possibly interact
    // and their AABB
    const allColliders: ComputeMoveOptions['allColliders'] = [];
    this.scene.forEachNodeInHierarchy((node) => {
      if (node instanceof ColliderNode) {
        if (this.scene.engine.collision.canInteract(this.group, node.group)) {
          allColliders.push({
            node,
            aabb: node.shape.getAABB(),
          });
        }
      }
    });

    const result = this.__computeMove(vector, {
      iteration: 0,
      allColliders,
    });

    if (result === undefined) {
      return {
        result: vector,
        delta: Vector3.zero(),
      };
    } else {
      return result;
    }
  }
  private __computeMove(vector: Vector3, options: ComputeMoveOptions): ColliderComputeMoveResult | undefined {
    const selfAABB = this.shape.getAABB(vector);

    /* Broad phase */
    // Gather all possible colliders that MIGHT POSSIBLY intersect,
    // using cheap calculations
    const possibleColliders: ColliderNode[] = [];
    for (const { node, aabb } of options.allColliders) {
      if (selfAABB.intersects(aabb)) {
        possibleColliders.push(node);
      }
    }

    /* Narrow phase */
    // Perform expensive collision checking on all potential collision candidates
    let shortestResult: ColliderComputeMoveResult | undefined = undefined;
    let shortestResultSqrLength: number | undefined = undefined;
    for (const collider of possibleColliders) {
      /*
        - perform some kind of SAT check
        - keep track of shortest result + MTV
       */
      const intersectionResult = collider.shape.calculateIntersection(this.shape, vector);
      if (intersectionResult !== undefined) {
        const resultVector = vector.add(intersectionResult.mtv);
        const sqrLength = resultVector.lengthSquared();
        if (shortestResultSqrLength === undefined || sqrLength < shortestResultSqrLength) {
          shortestResult = {
            result: resultVector,
            delta: intersectionResult.mtv,
          };
          shortestResultSqrLength = sqrLength;
        }
      }
    }

    if (shortestResult === undefined) {
      // No collision result, requested `vector` is valid
      return undefined;
    } else {
      // We need to check at least one more time to test for subsequent collisions
      // Eventually we will find a result that either collides with nothing
      // or we'll hit the max number of iterations

      if (options.iteration + 1 >= MaxComputeMoveIterations) {
        return shortestResult;
      }

      const recursiveResult = this.__computeMove(shortestResult.result, {
        allColliders: options.allColliders,
        iteration: options.iteration + 1,
      });

      if (recursiveResult === undefined) {
        // This result was the best
        return shortestResult;
      } else {
        // New result was the best
        return recursiveResult;
      }
    }
  }

  public getDrawTasks(engine: IEngine): DrawTask[] {
    const drawTasks: DrawTask[] = [];

    const { shape } = this;
    if (isWireframeDrawable(shape)) {
      drawTasks.push({
        draw: () => DrawDebug.drawWireframe(engine, shape, { overlay: true }),
        layer: 10,
      });
    }

    return drawTasks;
  }
}

export class BoxColliderNode extends ColliderNode {
  public override shape: BoxColliderShape;

  public constructor(scene: IScene, name: string, group: CollisionGroup, colliderOptions: BoxColliderShapeConstructorArgs) {
    const collider = new BoxColliderShape(() => this, colliderOptions);
    super(scene, name, group, collider);
    this.shape = collider;
  }
}

// export class SphereColliderNode extends ColliderNode {
//   public override shape: SphereColliderShape;

//   public constructor(scene: Scene, name: string, group: CollisionGroup, colliderOptions: SphereColliderShapeConstructorArgs) {
//     const collider = new SphereColliderShape(() => this.worldMatrix, colliderOptions);
//     super(scene, name, group, collider);
//     this.shape = collider;
//   }
// }

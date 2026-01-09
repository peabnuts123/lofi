import { AxisAlignedBoundingBox, ColliderShape, CollisionSystem } from "@polyzone/engine/collision";
import { BoxColliderShape, type BoxColliderShapeConstructorArgs } from "@polyzone/engine/collision/shapes";
import { DrawableSceneNode, type DrawTask, type IScene, SceneNode } from "@polyzone/engine/scene";
import { DrawDebug, isWireframeDrawable } from "@polyzone/engine/util/DrawDebug";
import type { IEngine } from "@polyzone/engine/Engine";
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



export interface ColliderComputeMoveResult {
  /* @TODO do these need better names? */
  result: Vector3;
  delta: Vector3; // @TODO if we don't get this for free, don't include it
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

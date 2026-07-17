import { Vector3 } from "@lofi/core/math/vector";
import { AxisAlignedBoundingBox, CollisionSystem } from "@lofi/engine/collision";
import type { DrawTask, IEngine } from "@lofi/engine/Engine";
import { DrawableSceneNode, type IScene, SceneNode } from "@lofi/engine/scene";
import { isWireframeDrawable } from "@lofi/engine/util/DebugDraw";

export interface CalculateIntersectionResult {
  mtv: Vector3;
  isShorter: boolean;
}

export interface ColliderComputeMoveResult {
  result: Vector3;
  delta: Vector3; // @TODO Do we even need this?
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

export abstract class ColliderNode extends DrawableSceneNode {
  public group: CollisionGroup;
  public drawWireframe: boolean = false;

  public constructor(scene: IScene, name: string, group: CollisionGroup, parent?: SceneNode) {
    super(scene, name, parent);
    if (group < 0 || group >= CollisionSystem.MaxCollisionGroups) {
      throw new Error(`Collision group must be in range 0-${CollisionSystem.MaxCollisionGroups - 1}`);
    }
    this.group = group;
  }

  public abstract getAABB(offset?: Vector3): AxisAlignedBoundingBox;
  protected abstract calculateIntersection(other: ColliderNode, hintVector: Vector3): CalculateIntersectionResult | undefined;
  public abstract intersects(other: ColliderNode): boolean;

  public move(target: SceneNode, vector: Vector3): void {
    const movement = this.computeMove(vector);
    target.position.addSelf(movement.result);
  }

  public computeMove(vector: Vector3): ColliderComputeMoveResult {
    // Precompute list of all colliders that could possibly interact
    // and their AABB
    const allColliders: ComputeMoveOptions['allColliders'] = [];
    this.scene.forEachNodeInHierarchy((node) => {
      if (node === this) return;
      if (node instanceof ColliderNode) {
        if (this.scene.engine.collisionSystem.canInteract(this.group, node.group)) {
          allColliders.push({
            node,
            aabb: node.getAABB(),
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
    const selfAABB = this.getAABB(vector);

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
      const intersectionResult = this.calculateIntersection(collider, vector);
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
        console.warn(`WARN: Exceeded max iterations for 'computeMove()'`, vector);
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

  public override draw(engine: IEngine, _drawQueue: DrawTask[]): void {
    if (this.drawWireframe && isWireframeDrawable(this)) {
      engine.debugDraw.drawWireframe(this, { overlay: true });
    }
  }
}


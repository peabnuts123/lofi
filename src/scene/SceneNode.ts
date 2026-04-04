import { Vector3 } from "@polyzone/engine/util/vector";
import { Rotation } from "@polyzone/engine/util/Rotation";
import { Matrix4 } from "@polyzone/engine/util/Matrix4";
import { Transform } from "@polyzone/engine/util/Transform";

import type { IScene } from "./Scene";

export abstract class SceneNode {
  protected scene: IScene;
  public name: string;

  private transform: Transform<SceneNode>;

  public constructor(scene: IScene, name: string) {
    this.scene = scene;
    this.name = name;

    this.transform = new Transform<SceneNode>(this);

    // Add node to scene
    this.scene.addTopLevelNode(this);
  }

  /**
   * Add a child node to this node.
   * The child's absolute transform values are preserved while its local transform values
   * are recalculated relative to this node's transform.
   *
   * @param child - The child node to add
   * @throws {Error} If the child already has a different parent
   */
  public addChild<TNode extends SceneNode>(child: TNode): TNode {
    this.transform.addChild(child.transform);
    this.scene.removeTopLevelNode(child);
    return child;
  }

  /**
   * Remove a child node from this node.
   * The child's absolute transform values are preserved while its local transform values
   * are recalculated to maintain the same world position/rotation/scale.
   * The child becomes a top-level node in the scene.
   *
   * @param child - The scene node to remove
   */
  public removeChild(child: SceneNode): void {
    this.transform.removeChild(child.transform);
    this.scene.addTopLevelNode(child);
  }

  /**
   * Execute a callback function for each child node of this node.
   *
   * @param fn - The callback function to execute for each child
   */
  public forEachChild(fn: (child: SceneNode) => void): void {
    this.transform.forEachChild((childTransform) => {
      fn(childTransform.node);
    });
  }

  /**
   * Called each frame to update this node's state. Override this method in subclasses
   * to implement per-frame update logic.
   *
   * @param dt - The time elapsed since the last frame, in seconds
   */
  public onUpdate(dt: number): void {
    /* No-op */
    // @NOTE Just shushing the linter about `dt` being unused.
    // eslint-disable doesn't work great because `ts` also
    // complains about it.
    void dt;
  }

  public get parent(): SceneNode | undefined { return this.transform.parent?.node; }

  public get position(): Vector3 { return this.transform.position; }
  public set position(value: Vector3) { this.transform.position = value; }
  public get rotation(): Rotation { return this.transform.rotation; }
  public get scale(): Vector3 { return this.transform.scale; }
  public set scale(value: Vector3) { this.transform.scale = value; }

  public get absolutePosition(): Vector3 { return this.transform.absolutePosition; }
  public set absolutePosition(value: Vector3) { this.transform.absolutePosition = value; }
  public get absoluteRotation(): Rotation { return this.transform.absoluteRotation; }
  public get absoluteScale(): Vector3 { return this.transform.absoluteScale; }
  public set absoluteScale(value: Vector3) { this.transform.absoluteScale = value; }

  public get worldMatrix(): Matrix4 { return this.transform.worldMatrix; }
}

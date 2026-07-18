import { Vector3 } from "@lofi/core/math/Vector3";
import { Matrix4 } from "@lofi/core/math/Matrix4";
import { Rotation } from "@lofi/core/transform/Rotation";
import { Transform } from "@lofi/core/transform/Transform";
import type { Computed } from "@lofi/core/util/Computed";

import type { IScene } from "./Scene";

export abstract class SceneNode {
  protected scene: IScene;
  public name: string;

  private transform: Transform<SceneNode>;

  public constructor(scene: IScene, name: string, parent?: SceneNode) {
    this.scene = scene;
    this.name = name;

    this.transform = new Transform<SceneNode>(this, parent?.transform);

    // Add node to scene (if top-level)
    if (parent === undefined) {
      this.scene.addTopLevelNode(this);
    }
  }

  /**
   * Execute a callback function for each child node of this node.
   *
   * @param fn - The callback function to execute for each child
   * @param recursive - Whether to iterate recursively through the entire hierarchy or just this SceneNode's direct children.
   */
  public forEachChild(fn: (child: SceneNode) => void, recursive?: boolean): void {
    this.transform.forEachChild((childTransform) => {
      fn(childTransform.node);
    }, recursive);
  }

  public findChild(fn: (child: SceneNode) => boolean, recursive?: boolean): SceneNode | undefined {
    return this.transform.findChild((childTransform) => {
      return fn(childTransform.node);
    }, recursive)?.node;
  }

  /**
   * Called each frame to update this node's state. Override this method in subclasses
   * to implement per-frame update logic.
   *
   * @param dt - The time elapsed since the last frame, in seconds
   * @param time - Arbitrary number that increases in real time.
   */
  public onUpdate(dt: number, time: number): void {
    /* No-op */
    // @NOTE Just shushing the linter about `dt` being unused.
    // eslint-disable doesn't work great because `ts` also
    // complains about it.
    void dt;
    void time;
  }

  public destroy(): void {
    if (this.parent === undefined) {
      this.scene.removeTopLevelNode(this);
    } else {
      this.parent = undefined;
    }
  }

  public get parent(): SceneNode | undefined { return this.transform.parent?.node; }
  public set parent(value: SceneNode | undefined) { this.transform.parent = value?.transform; }

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
  public get worldMatrixComputed(): Computed<Matrix4> { return this.transform.worldMatrixComputed; }
}

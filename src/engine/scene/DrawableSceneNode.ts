import type { Vector3 } from "@polyzone/engine/util/vector";
import type { Engine } from "@polyzone/engine/Engine";

import { SceneNode, type ISceneNodeWithPosition, type ISceneNodeWithRotation, type ISceneNodeWithScale } from "./SceneNode";

export abstract class DrawableSceneNode extends SceneNode implements ISceneNodeWithPosition, ISceneNodeWithRotation, ISceneNodeWithScale {
  public position: Vector3;
  public rotation: Vector3;
  public scale: Vector3;

  public constructor(name: string) {
    super(name);
    this.position = { x: 0, y: 0, z: 0 };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
  }

  public abstract draw(engine: Engine): void;
}

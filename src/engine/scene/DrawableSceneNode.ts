import type { Engine } from "@polyzone/engine/Engine";

import { SceneNode } from "./SceneNode";
import type { Scene } from "./Scene";

export abstract class DrawableSceneNode extends SceneNode {

  public constructor(scene: Scene, name: string) {
    super(scene, name);
  }

  public abstract draw(engine: Engine): void;
}

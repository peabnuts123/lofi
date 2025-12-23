import type { Engine } from "@polyzone/engine/Engine";

import { SceneNode } from "./SceneNode";

export abstract class DrawableSceneNode extends SceneNode {

  public constructor(name: string) {
    super(name);
  }

  public abstract draw(engine: Engine): void;
}

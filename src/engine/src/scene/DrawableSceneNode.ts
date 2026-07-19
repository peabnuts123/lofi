import  type { DrawTask, IEngine } from "@lopoly/engine/Engine";

import { SceneNode } from "./SceneNode";
import type { IScene } from "./Scene";

export abstract class DrawableSceneNode extends SceneNode {

  public constructor(scene: IScene, name: string, parent?: SceneNode) {
    super(scene, name, parent);
  }

  public abstract draw(engine: IEngine, drawQueue: DrawTask[]): void;
}

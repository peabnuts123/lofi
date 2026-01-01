import type { Engine } from "@polyzone/engine/Engine";

import { SceneNode } from "./SceneNode";
import type { Scene } from "./Scene";

export interface UnorderedDrawTask {
  draw: () => void;
  layer: number;
}
export interface OrderedDrawTask extends UnorderedDrawTask {
  order: number;
}

export type DrawTask = UnorderedDrawTask | OrderedDrawTask;

export abstract class DrawableSceneNode extends SceneNode {

  public constructor(scene: Scene, name: string) {
    super(scene, name);
  }

  public abstract getDrawTasks(engine: Engine): DrawTask[];
}

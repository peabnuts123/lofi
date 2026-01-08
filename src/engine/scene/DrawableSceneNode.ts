import type { IEngine } from "@polyzone/engine/Engine";

import { SceneNode } from "./SceneNode";
import type { IScene } from "./Scene";

export interface UnorderedDrawTask {
  draw: () => void;
  layer: number;
}
export interface OrderedDrawTask extends UnorderedDrawTask {
  order: number;
}

export type DrawTask = UnorderedDrawTask | OrderedDrawTask;

export abstract class DrawableSceneNode extends SceneNode {

  public constructor(scene: IScene, name: string) {
    super(scene, name);
  }

  public abstract getDrawTasks(engine: IEngine): DrawTask[];
}

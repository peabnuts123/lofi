import type { DrawTask, IEngine } from "@lofi/engine/Engine";

import { SceneLighting } from "./SceneLighting";
import type { SceneNode } from "./SceneNode";
import { DrawableSceneNode } from "./DrawableSceneNode";
import { CameraNode } from "./nodes/CameraNode";

export interface IScene {

  addTopLevelNode(node: SceneNode): SceneNode;
  removeTopLevelNode(node: SceneNode): void;
  onUpdate(dt: number, time: number): void;
  draw(drawQueue: DrawTask[]): void;
  forEachNodeInHierarchy(fn: (node: SceneNode) => void): void;

  get activeCamera(): CameraNode | undefined;
  set activeCamera(value: CameraNode | undefined);
  get engine(): IEngine;
  set engine(value: IEngine);
  get lighting(): SceneLighting;
  set lighting(value: SceneLighting);
}

export class Scene implements IScene {
  public activeCamera: CameraNode | undefined;
  public readonly engine: IEngine;
  private topLevelNodes: SceneNode[];
  public readonly lighting: SceneLighting;

  public constructor(engine: IEngine) {
    this.engine = engine;
    this.topLevelNodes = [];
    this.lighting = new SceneLighting();

    if (engine.activeScene === undefined) {
      engine.loadScene(this);
    }
  }

  public addTopLevelNode<TNode extends SceneNode>(node: TNode): TNode {
    if (node.parent !== undefined) {
      throw new Error(`Cannot add node '${node.name}' to scene as top-level node, it is already the child of '${node.parent.name}'`);
    } else if (this.topLevelNodes.some((topLevelNode) => topLevelNode === node)) {
      console.warn(`Tried to add node '${node.name}' to scene as top-level node but it is already a top-level node`);
    } else {
      this.topLevelNodes.push(node);
    }
    return node;
  }

  public removeTopLevelNode(node: SceneNode): void {
    const index = this.topLevelNodes.indexOf(node);
    if (index >= 0) {
      this.topLevelNodes.splice(index, 1);
    } else {
      console.warn(`Tried to remove node '${node.name}' from scene top-level nodes but it is not a top-level node`);
    }
  }

  public onUpdate(dt: number, time: number): void {
    this.forEachNodeInHierarchy((node) => {
      node.onUpdate(dt, time);
    });
  }

  public draw(drawQueue: DrawTask[]): void {
    this.forEachNodeInHierarchy((node) => {
      if (node instanceof DrawableSceneNode) {
        node.draw(this.engine, drawQueue);
      }
    });
  }

  public forEachNodeInHierarchy(fn: (node: SceneNode) => void): void {
    for (const node of this.topLevelNodes) {
      fn(node);
      node.forEachChild(fn, true);
    }
  }
}

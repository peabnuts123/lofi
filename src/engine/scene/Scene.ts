import { Camera } from "@polyzone/engine/camera";
import type { Engine } from "@polyzone/engine/Engine";
import { Lighting, PointLight } from "@polyzone/engine/lighting";

import type { SceneNode } from "./SceneNode";
import { DrawableSceneNode } from "./DrawableSceneNode";

export class Scene {
  public activeCamera: Camera | undefined;
  public readonly engine: Engine;
  private topLevelNodes: SceneNode[];
  public readonly lighting: Lighting;

  public constructor(engine: Engine) {
    this.engine = engine;
    this.topLevelNodes = [];
    this.lighting = new Lighting();

    if (engine.activeScene === undefined) {
      engine.loadScene(this);
    }
  }

  public addNode(node: SceneNode): void {
    if (node.parent !== undefined) {
      throw new Error(`Cannot add node '${node.name}' to scene as top-level node, it is already the child of '${node.parent.name}'`);
    } else if (this.topLevelNodes.some((topLevelNode) => topLevelNode === node)) {
      console.warn(`Tried to add node '${node.name}' to scene as top-level node but it is already a top-level node`);
    } else {
      this.topLevelNodes.push(node);

      // Always switch to new camera
      if (node instanceof Camera) {
        this.activeCamera = node;
      }

      // @TODO @DEBUG This should be based on camera distance or something.
      if (this.lighting.pointLights.length < Lighting.MaxPointLights) {
        if (node instanceof PointLight) {
          this.lighting.pointLights.push(node);
        }
      }
    }
  }

  public removeNode(node: SceneNode): void {
    const index = this.topLevelNodes.indexOf(node);
    if (index >= 0) {
      this.topLevelNodes.splice(index, 1);
    } else {
      console.warn(`Tried to remove node '${node.name}' from scene top-level nodes but it is not a top-level node`);
    }
  }

  public onUpdate(dt: number): void {
    this.forEachNodeInHierarchy((node) => {
      node.onUpdate(dt);
    });
  }

  public draw(): void {
    this.forEachNodeInHierarchy((node) => {
      if (node instanceof DrawableSceneNode) {
        node.draw(this.engine);
      }
    });
  }

  private forEachNodeInHierarchy(fn: (node: SceneNode) => void): void {
    function iterateNode(node: SceneNode): void {
      fn(node);
      node.forEachChild(fn);
    }

    for (const node of this.topLevelNodes) {
      iterateNode(node);
    }
  }
}

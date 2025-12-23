import type { Engine } from "@polyzone/engine/Engine";

import { SceneLighting } from "./SceneLighting";
import type { SceneNode } from "./SceneNode";
import { DrawableSceneNode } from "./DrawableSceneNode";
import { CameraNode } from "./nodes/CameraNode";
import { PointLightNode } from "./nodes/PointLightNode";

export class Scene {
  public activeCamera: CameraNode | undefined;
  public readonly engine: Engine;
  private topLevelNodes: SceneNode[];
  public readonly lighting: SceneLighting;

  public constructor(engine: Engine) {
    this.engine = engine;
    this.topLevelNodes = [];
    this.lighting = new SceneLighting();

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
      if (node instanceof CameraNode) {
        this.activeCamera = node;
      }

      // @TODO @DEBUG This should be based on camera distance or something.
      if (this.lighting.pointLights.length < SceneLighting.MaxPointLights) {
        if (node instanceof PointLightNode) {
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

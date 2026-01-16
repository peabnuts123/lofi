import type { IEngine } from "@polyzone/engine/Engine";

import { SceneLighting } from "./SceneLighting";
import type { SceneNode } from "./SceneNode";
import { DrawableSceneNode, type OrderedDrawTask, type UnorderedDrawTask } from "./DrawableSceneNode";
import { CameraNode } from "./nodes/CameraNode";

export interface RenderLayer {
  order: number;
  unorderedDrawTasks: UnorderedDrawTask[];
  orderedDrawTasks: OrderedDrawTask[];
}

export interface IScene {

  addTopLevelNode(node: SceneNode): SceneNode;
  removeTopLevelNode(node: SceneNode): void;
  onUpdate(dt: number): void;
  draw(): void;
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

  public onUpdate(dt: number): void {
    this.forEachNodeInHierarchy((node) => {
      node.onUpdate(dt);
    });
  }

  public draw(): void {
    const renderLayers: RenderLayer[] = [];
    this.forEachNodeInHierarchy((node) => {
      if (node instanceof DrawableSceneNode) {
        const drawTasks = node.getDrawTasks(this.engine);
        for (const drawTask of drawTasks) {
          // Find the layer this drawTask is part of OR
          // the position in the `layers` array where the layer
          // SHOULD be.
          let layer: RenderLayer | undefined = undefined;
          let layerIndex = 0;
          for (; layerIndex < renderLayers.length; layerIndex++) {
            if (renderLayers[layerIndex].order === drawTask.layer) {
              // Found layer with matching order
              layer = renderLayers[layerIndex];
              break;
            }
            if (renderLayers[layerIndex].order > drawTask.layer) {
              // We found the place where the layer SHOULD be
              // so break early, a new layer will be added
              break;
            }
          }
          // If we didn't find `layer` then we know `layerIndex` is where it should live
          if (layer === undefined) {
            layer = {
              order: drawTask.layer,
              unorderedDrawTasks: [],
              orderedDrawTasks: [],
            };
            renderLayers.splice(layerIndex, 0, layer);
          }

          // Queue ordered vs unordered tasks into appropriate lists
          if ('order' in drawTask) {
            // Find place in task list using insertion sort
            let taskIndex = 0;
            for (; taskIndex < layer.orderedDrawTasks.length; taskIndex++) {
              if (layer.orderedDrawTasks[taskIndex].order > drawTask.order) {
                // Found place in list
                break;
              }
            }
            // `taskIndex` is now either the index in the list at which to insert,
            // or the length of the array (if we're adding to the end)
            layer.orderedDrawTasks.splice(taskIndex, 0, drawTask);

          } else {
            // Draw task has no order, just add it to the end of the collection
            layer.unorderedDrawTasks.push(drawTask);
          }
        }
      }
    });

    // Render each layer in order
    for (const renderLayer of renderLayers) {
      for (const drawTask of renderLayer.unorderedDrawTasks) {
        drawTask.draw();
      }
      for (const drawTask of renderLayer.orderedDrawTasks) {
        drawTask.draw();
      }
    }
  }

  public forEachNodeInHierarchy(fn: (node: SceneNode) => void): void {
    function iterateNode(node: SceneNode): void {
      fn(node);
      node.forEachChild(fn);
    }

    for (const node of this.topLevelNodes) {
      iterateNode(node);
    }
  }
}

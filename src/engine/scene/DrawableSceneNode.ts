import type { DrawQueues, IEngine } from "@polyzone/engine/Engine";
import type { Matrix4 } from "@polyzone/engine/util/Matrix4";
import type { Material, ShaderVariant } from "@polyzone/engine/materials";

import { SceneNode } from "./SceneNode";
import type { IScene } from "./Scene";

export interface DrawTask {
  renderPass: number; // @TODO how is this actually used?
  shaderVariant: ShaderVariant
  material: Material;
  // @TODO maybe refactor `mesh` into a more generic `draw` thing
  // e.g. to support drawing wireframe - can `draw()` handle setting `vao` and stuff?
  mesh: {
    id: number;
    vao: WebGLVertexArrayObject;
    draw: () => void,
  },
  uniforms: {
    worldMatrix: Matrix4;
    skinWeights?: Float32Array;
  }
}

export interface TransparentDrawTask extends DrawTask {
  depth: number;
}

export abstract class DrawableSceneNode extends SceneNode {

  public constructor(scene: IScene, name: string) {
    super(scene, name);
  }

  public abstract draw(engine: IEngine, drawQueues: DrawQueues): void;
}

import type { Color3 } from "@lofi/core/math/Color3";
import { type IScene, SceneNode } from "@lofi/engine/scene";

export class DirectionalLightNode extends SceneNode {
  // @TODO Intensity. Range?
  public color: Color3;

  public constructor(scene: IScene, name: string, color: Color3, parent?: SceneNode) {
    super(scene, name, parent);
    this.color = color;

    // @TODO @DEBUG This should be based on camera distance or something.
    if (scene.lighting.directionalLights.length < this.scene.engine.config.lighting.maxDirectionalLights) {
      scene.lighting.directionalLights.push(this);
    }
  }
}

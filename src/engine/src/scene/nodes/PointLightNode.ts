import type { Color3 } from "@lofi/core/math/Color3";
import { type IScene, SceneNode } from "@lofi/engine/scene";
import { SceneLighting } from "@lofi/engine/scene/SceneLighting";

export class PointLightNode extends SceneNode {
  // @TODO Intensity. Range?
  public color: Color3;

  public constructor(scene: IScene, name: string, color: Color3, parent?: SceneNode) {
    super(scene, name, parent);
    this.color = color;

    // @TODO @DEBUG This should be based on camera distance or something.
    if (scene.lighting.pointLights.length < SceneLighting.MaxPointLights) {
      scene.lighting.pointLights.push(this);
    }
  }
}

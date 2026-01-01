import type { Color3 } from "@polyzone/engine/util/Color3";
import { Scene, SceneNode } from "@polyzone/engine/scene";
import { SceneLighting } from "@polyzone/engine/scene/SceneLighting";

export class PointLightNode extends SceneNode {
  public color: Color3;

  public constructor(scene: Scene, name: string, color: Color3) {
    super(scene, name);
    this.color = color;

    // @TODO @DEBUG This should be based on camera distance or something.
    if (scene.lighting.pointLights.length < SceneLighting.MaxPointLights) {
      scene.lighting.pointLights.push(this);
    }
  }
}

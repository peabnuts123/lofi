import { Color3 } from "@lofi/core/math/Color3";
import { type IScene, SceneNode } from "@lofi/engine/scene";
import type { LightIntensity } from "./PointLightNode";

export interface DirectionalLightConstructorOptions {
  color?: Color3;
  intensity?: LightIntensity;
}

export class DirectionalLightNode extends SceneNode {
  public color: Color3;
  public intensity: LightIntensity;


  public constructor(scene: IScene, name: string, options?: DirectionalLightConstructorOptions, parent?: SceneNode) {
    super(scene, name, parent);

    this.color = options?.color ?? Color3.white();
    this.intensity = options?.intensity ?? 1;

    // @TODO @DEBUG This should be based on camera distance or something.
    if (scene.lighting.directionalLights.length < this.scene.engine.config.lighting.maxDirectionalLights) {
      scene.lighting.directionalLights.push(this);
    }
  }
}

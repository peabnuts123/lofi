import  { Color3 } from "@lopoly/core/math/Color3";
import  { type IScene, SceneNode } from "@lopoly/engine/scene";

/** A value between 0 and 1, inclusive. */
export type LightIntensity = number;

export interface PointLightConstructorOptions {
  color?: Color3;
  intensity?: LightIntensity;
  range?: number;
}

export class PointLightNode extends SceneNode {
  public color: Color3;
  public intensity: LightIntensity;
  public range: number;

  public constructor(scene: IScene, name: string, options?: PointLightConstructorOptions, parent?: SceneNode) {
    super(scene, name, parent);

    this.color = options?.color ?? Color3.white();
    this.intensity = options?.intensity ?? 1;
    this.range = options?.range ?? this.scene.engine.config.lighting.defaultPointLightRange;

    // @TODO @DEBUG This should be based on camera distance or something.
    if (scene.lighting.pointLights.length < this.scene.engine.config.lighting.maxPointLights) {
      scene.lighting.pointLights.push(this);
    }
  }
}

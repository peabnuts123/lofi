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
  /**
   * @TODO Meant to be between 0 and 1 but won't be clamped.
   */
  public intensity: LightIntensity;
  /**
   * How far this light propagates in space.
   * Light falloff is a quadratic equation with no fixed limit/cutoff, so this property
   * represents the distance at which the light's intensity will be at 10%.
   *
   * The equation for a point light's intensity is the classic OpenGL lighting attenuation equation:
   * ```
   * 1 / (K_c + K_l * d + K_q * d^2)
   * ```
   *
   * Where:
   *  - `K_c` is the Constant coefficient
   *  - `K_l` is the Linear coefficient
   *  - `K_q` is the Quadratic coefficient
   *  - `d` is the distance from the light source
   *
   * In LoPoly's lighting model:
   *  - `K_c` = 1
   *  - `K_l` = 0
   *  - `K_q` = `((1 / L) - 1) / r^2`
   *    - `L` = Lighting intensity at max range = 0.1
   *    - `r` = `range` parameter of light
   *    - This ensures that at distance `r` the intensity will be `L`
   */
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

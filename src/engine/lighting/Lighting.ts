import type { Ubo } from "@polyzone/engine/materials/Ubo";
import type { Color3 } from "@polyzone/engine/util/color";

import type { PointLight } from "./PointLight";

export const LightingUboPropertyNames = [
  'ambientLightColor',
  'pointLight0Position',
  'pointLight0Color',
  'pointLight1Position',
  'pointLight1Color',
  'pointLight2Position',
  'pointLight2Color',
  'pointLight3Position',
  'pointLight3Color',
] as const;
export type LightingUboPropertyName = (typeof LightingUboPropertyNames)[number];

export const LightingUboIndex = 2;

export class Lighting {
  public static readonly MaxPointLights = 4;

  private readonly ubo: Ubo<LightingUboPropertyName>;

  public ambientColor: Color3;
  public pointLights: PointLight[];

  public constructor(ubo: Ubo<LightingUboPropertyName>) {
    this.ubo = ubo;
    this.pointLights = [];
    this.ambientColor = { r: 0, g: 0, b: 0 };
  }

  public recalculateLightingData(gl: WebGL2RenderingContext): void {
    // Ambient light
    this.ubo.setProperty(gl, 'ambientLightColor', new Float32Array([this.ambientColor.r, this.ambientColor.g, this.ambientColor.b]));

    // Point lights
    /* Truncate list of lights */
    if (this.pointLights.length > Lighting.MaxPointLights) {
      console.error(`More than ${Lighting.MaxPointLights} active in renderer. This is an error. Pruning...`);
      this.pointLights.splice(Lighting.MaxPointLights);
    }
    /* Bind light data */
    for (let i = 0; i < Lighting.MaxPointLights; i++) {
      const light = this.pointLights[i];
      if (light !== undefined) {
        /* Light is present */
        this.ubo.setProperty(gl, `pointLight${i}Position` as LightingUboPropertyName, new Float32Array([light.position.x, light.position.y, light.position.z]));
        this.ubo.setProperty(gl, `pointLight${i}Color` as LightingUboPropertyName, new Float32Array([light.color.r, light.color.g, light.color.b]));
      } else {
        /* Light is empty - disable */
        this.ubo.setProperty(gl, `pointLight${i}Position` as LightingUboPropertyName, new Float32Array([0, 0, 0]));
        this.ubo.setProperty(gl, `pointLight${i}Color` as LightingUboPropertyName, new Float32Array([0, 0, 0]));
      }
    }
  }
}

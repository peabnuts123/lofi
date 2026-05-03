import type { Ubo } from "@lofi/engine/materials/Ubo";
import { Color3 } from "@lofi/core/math/Color3";

import type { PointLightNode } from "./nodes/PointLightNode";

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
export type LightingUbo = Ubo<LightingUboPropertyName>;
export const LightingUboName = 'Lighting';
export const LightingUboIndex = 2;

export class SceneLighting {
  public static readonly MaxPointLights = 4;

  public ambientColor: Color3;
  public pointLights: PointLightNode[];

  /*
    @TODO Lighting system
    Once we add DirectionalLight we need to shuffle this around
     - Don't leave `pointLights` as a public property, add some kind of `registerLight()` function
     - Probably lights need some kind of AnyLight abstraction or interface that they implement
     - What're we doing about Max Lights?
   */

  public constructor() {
    this.pointLights = [];
    this.ambientColor = new Color3(0, 0, 0);
  }

  public bindToUbo(gl: WebGL2RenderingContext, ubo: LightingUbo): void {
    // Ambient light
    ubo.setProperty(gl, 'ambientLightColor', new Float32Array([
      this.ambientColor.r / 0xFF,
      this.ambientColor.g / 0xFF,
      this.ambientColor.b / 0xFF,
    ]));

    // Point lights
    /* Truncate list of lights */
    if (this.pointLights.length > SceneLighting.MaxPointLights) {
      console.error(`More than ${SceneLighting.MaxPointLights} active in renderer. This is an error. Pruning...`);
      // @TODO I don't reckon we should do this, we should just throw or something.
      this.pointLights.splice(SceneLighting.MaxPointLights);
    }
    /* Bind light data */
    for (let i = 0; i < SceneLighting.MaxPointLights; i++) {
      const light = this.pointLights[i];
      if (light !== undefined) {
        /* Light is present */
        ubo.setProperty(gl, `pointLight${i}Position` as LightingUboPropertyName, new Float32Array([
          light.absolutePosition.x,
          light.absolutePosition.y,
          light.absolutePosition.z,
        ]));
        ubo.setProperty(gl, `pointLight${i}Color` as LightingUboPropertyName, new Float32Array([
          light.color.r / 0xFF,
          light.color.g / 0xFF,
          light.color.b / 0xFF,
        ]));
      } else {
        /* Light is empty - disable */
        ubo.setProperty(gl, `pointLight${i}Position` as LightingUboPropertyName, new Float32Array([0, 0, 0]));
        ubo.setProperty(gl, `pointLight${i}Color` as LightingUboPropertyName, new Float32Array([0, 0, 0]));
      }
    }
  }
}

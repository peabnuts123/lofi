import  type { EngineConfig } from "@lopoly/engine/Engine";
import  type { Ubo } from "@lopoly/engine/materials/Ubo";
import  { Color3 } from "@lopoly/core/math/Color3";
import  { Vector3 } from "@lopoly/core/math/Vector3";

import type { PointLightNode, DirectionalLightNode } from "./nodes";

const SizeOfVec4 = 4;

export const LightingUboPropertyNames = [
  'ambientLightColor',
  'pointLightPositions',
  'pointLightColors',
  'pointLightIntensities',
  'pointLightRanges',
  'directionalLightOrientations',
  'directionalLightColors',
  'directionalLightIntensities',
] as const;
export type LightingUboPropertyName = (typeof LightingUboPropertyNames)[number];
export type LightingUbo = Ubo<LightingUboPropertyName>;
export const LightingUboName = 'Lighting';
export const LightingUboIndex = 2;

export class SceneLighting {
  public ambientColor: Color3;
  public pointLights: PointLightNode[];
  public directionalLights: DirectionalLightNode[];

  private tmp_pointLightPositionData: Float32Array = new Float32Array();
  private tmp_pointLightColorData: Float32Array = new Float32Array();
  private tmp_pointLightIntensityData: Float32Array = new Float32Array();
  private tmp_pointLightRangeData: Float32Array = new Float32Array();
  private tmp_directionalLightOrientationData: Float32Array = new Float32Array();
  private tmp_directionalLightColorData: Float32Array = new Float32Array;
  private tmp_directionalLightIntensityData: Float32Array = new Float32Array();
  private tmp_directionalLightVectors: Vector3[] = [];

  public constructor() {
    this.pointLights = [];
    this.directionalLights = [];
    this.ambientColor = new Color3(0, 0, 0);
  }

  public bindToUbo(gl: WebGL2RenderingContext, ubo: LightingUbo, lightingConfig: EngineConfig['lighting']): void {
    this.ensureTmpValuesAreInitialised(lightingConfig);

    // Ambient light
    ubo.setProperty(gl, 'ambientLightColor', new Float32Array([
      this.ambientColor.r / 0xFF,
      this.ambientColor.g / 0xFF,
      this.ambientColor.b / 0xFF,
    ]));

    // Point lights
    /* Truncate lists of lights */
    if (this.pointLights.length > lightingConfig.maxPointLights) {
      console.error(`[${SceneLighting.name}] (${this.bindToUbo.name}) More than ${lightingConfig.maxPointLights} point lights active in renderer. This is an error. Pruning...`);
      this.pointLights.splice(lightingConfig.maxPointLights);
    }
    /* Bind light data */
    for (let i = 0; i < lightingConfig.maxPointLights; i++) {
      const light = this.pointLights[i];
      if (light !== undefined) {
        /* Light is present */
        /* - Position */
        this.tmp_pointLightPositionData[i * SizeOfVec4 + 0] = light.absolutePosition.x;
        this.tmp_pointLightPositionData[i * SizeOfVec4 + 1] = light.absolutePosition.y;
        this.tmp_pointLightPositionData[i * SizeOfVec4 + 2] = light.absolutePosition.z;
        /* - Color */
        this.tmp_pointLightColorData[i * SizeOfVec4 + 0] = light.color.r / 0xFF;
        this.tmp_pointLightColorData[i * SizeOfVec4 + 1] = light.color.g / 0xFF;
        this.tmp_pointLightColorData[i * SizeOfVec4 + 2] = light.color.b / 0xFF;
        /* Intensity */
        this.tmp_pointLightIntensityData[i * SizeOfVec4 + 0] = light.intensity;
        /* Range */
        this.tmp_pointLightRangeData[i * SizeOfVec4 + 0] = light.range;
      } else {
        /* Light is empty - disable */
        /* - Position */
        this.tmp_pointLightPositionData[i * SizeOfVec4 + 0] = 0;
        this.tmp_pointLightPositionData[i * SizeOfVec4 + 1] = 0;
        this.tmp_pointLightPositionData[i * SizeOfVec4 + 2] = 0;
        /* - Color */
        this.tmp_pointLightColorData[i * SizeOfVec4 + 0] = 0;
        this.tmp_pointLightColorData[i * SizeOfVec4 + 1] = 0;
        this.tmp_pointLightColorData[i * SizeOfVec4 + 2] = 0;
        /* Intensity */
        this.tmp_pointLightIntensityData[i * SizeOfVec4 + 0] = 0;
        /* Range */
        this.tmp_pointLightRangeData[i * SizeOfVec4 + 0] = 0;
      }
    }
    ubo.setProperty(gl, 'pointLightPositions', this.tmp_pointLightPositionData);
    ubo.setProperty(gl, 'pointLightColors', this.tmp_pointLightColorData);
    ubo.setProperty(gl, 'pointLightIntensities', this.tmp_pointLightIntensityData);
    ubo.setProperty(gl, 'pointLightRanges', this.tmp_pointLightRangeData);


    // Directional lights
    /* Truncate lists of lights */
    if (this.directionalLights.length > lightingConfig.maxDirectionalLights) {
      console.error(`[${SceneLighting.name}] (${this.bindToUbo.name}) More than ${lightingConfig.maxDirectionalLights} directional lights active in renderer. This is an error. Pruning...`);
      this.directionalLights.splice(lightingConfig.maxDirectionalLights);
    }
    /* Bind light data */
    for (let i = 0; i < lightingConfig.maxDirectionalLights; i++) {
      const light = this.directionalLights[i];
      if (light !== undefined) {
        /* Light is present */
        // Calculate direction vector from Quaternion
        light.absoluteRotation.q.rotateVectorInPlace(
          this.tmp_directionalLightVectors[i]
            .setValue(0, 1, 0),
        );
        /* - Orientation */
        this.tmp_directionalLightOrientationData[i * SizeOfVec4 + 0] = this.tmp_directionalLightVectors[i].x;
        this.tmp_directionalLightOrientationData[i * SizeOfVec4 + 1] = this.tmp_directionalLightVectors[i].y;
        this.tmp_directionalLightOrientationData[i * SizeOfVec4 + 2] = this.tmp_directionalLightVectors[i].z;
        /* - Color */
        this.tmp_directionalLightColorData[i * SizeOfVec4 + 0] = light.color.r / 0xFF;
        this.tmp_directionalLightColorData[i * SizeOfVec4 + 1] = light.color.g / 0xFF;
        this.tmp_directionalLightColorData[i * SizeOfVec4 + 2] = light.color.b / 0xFF;
        /* Intensity */
        this.tmp_directionalLightIntensityData[i * SizeOfVec4 + 0] = light.intensity;
      } else {
        /* Light is empty - disable */
        /* - Position */
        this.tmp_directionalLightOrientationData[i * SizeOfVec4 + 0] = 0;
        this.tmp_directionalLightOrientationData[i * SizeOfVec4 + 1] = 0;
        this.tmp_directionalLightOrientationData[i * SizeOfVec4 + 2] = 0;
        /* - Color */
        this.tmp_directionalLightColorData[i * SizeOfVec4 + 0] = 0;
        this.tmp_directionalLightColorData[i * SizeOfVec4 + 1] = 0;
        this.tmp_directionalLightColorData[i * SizeOfVec4 + 2] = 0;
        /* Intensity */
        this.tmp_directionalLightIntensityData[i * SizeOfVec4 + 0] = 0;
      }
    }
    ubo.setProperty(gl, 'directionalLightOrientations', this.tmp_directionalLightOrientationData);
    ubo.setProperty(gl, 'directionalLightColors', this.tmp_directionalLightColorData);
    ubo.setProperty(gl, 'directionalLightIntensities', this.tmp_directionalLightIntensityData);
  }

  private ensureTmpValuesAreInitialised(lightingConfig: EngineConfig['lighting']): void {
    /* Point lights */
    if (this.tmp_pointLightPositionData.length !== lightingConfig.maxPointLights * SizeOfVec4) {
      this.tmp_pointLightPositionData = new Float32Array(lightingConfig.maxPointLights * SizeOfVec4);
    }
    if (this.tmp_pointLightColorData.length !== lightingConfig.maxPointLights * SizeOfVec4) {
      this.tmp_pointLightColorData = new Float32Array(lightingConfig.maxPointLights * SizeOfVec4);
    }
    if (this.tmp_pointLightIntensityData.length !== lightingConfig.maxPointLights * SizeOfVec4) {
      this.tmp_pointLightIntensityData = new Float32Array(lightingConfig.maxPointLights * SizeOfVec4);
    }
    if (this.tmp_pointLightRangeData.length !== lightingConfig.maxPointLights * SizeOfVec4) {
      this.tmp_pointLightRangeData = new Float32Array(lightingConfig.maxPointLights * SizeOfVec4);
    }

    /* Directional lights */
    if (this.tmp_directionalLightOrientationData.length !== lightingConfig.maxDirectionalLights * SizeOfVec4) {
      this.tmp_directionalLightOrientationData = new Float32Array(lightingConfig.maxDirectionalLights * SizeOfVec4);
    }
    if (this.tmp_directionalLightColorData.length !== lightingConfig.maxDirectionalLights * SizeOfVec4) {
      this.tmp_directionalLightColorData = new Float32Array(lightingConfig.maxDirectionalLights * SizeOfVec4);
    }
    if (this.tmp_directionalLightIntensityData.length !== lightingConfig.maxDirectionalLights * SizeOfVec4) {
      this.tmp_directionalLightIntensityData = new Float32Array(lightingConfig.maxDirectionalLights * SizeOfVec4);
    }
    if (this.tmp_directionalLightVectors.length !== lightingConfig.maxDirectionalLights) {
      this.tmp_directionalLightVectors.splice(0);
      for (let i = 0; i < lightingConfig.maxDirectionalLights; i++) {
        this.tmp_directionalLightVectors.push(Vector3.zero());
      }
    }
  }
}

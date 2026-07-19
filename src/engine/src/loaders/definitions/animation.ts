import  type { ArrayElementType } from "@lopoly/core/util/types";
import  type { Vector3 } from "@lopoly/core/math/Vector3";
import  type { Vector2 } from "@lopoly/core/math/Vector2";
import  type { Quaternion } from "@lopoly/core/math/Quaternion";

export type AnimationSamplerInterpolation = 'LINEAR' | 'STEP' | 'CUBICSPLINE';
export type AnimationChannelTargetPath = 'translation' | 'rotation' | 'scale';

export interface AnimationDefinition {
  name: string;
  length: number;
  channels: AnimationChannelDefinition[];
}

export interface BaseAnimationChannelDefinition {
  targetPartName: string;
  timestamps: Float32Array;
  interpolation: AnimationSamplerInterpolation;
}
export interface TranslationAnimationChannelDefinition extends BaseAnimationChannelDefinition {
  targetPartProperty: 'translation';
  values: Vec3AnimationChannelValues;
}
export interface RotationAnimationChannelDefinition extends BaseAnimationChannelDefinition {
  targetPartProperty: 'rotation';
  values: QuatAnimationChannelValues;
}
export interface ScaleAnimationChannelDefinition extends BaseAnimationChannelDefinition {
  targetPartProperty: 'scale';
  values: Vec3AnimationChannelValues;
}
export type AnimationChannelDefinition = TranslationAnimationChannelDefinition | RotationAnimationChannelDefinition | ScaleAnimationChannelDefinition;
export type AnimationChannelDefinitionOfType<TAssetType extends AnimationChannelDefinition['targetPartProperty']> = Extract<AnimationChannelDefinition, { targetPartProperty: TAssetType }>;



export interface ScalarAnimationChannelValues {
  type: 'scalar';
  values: number[];
}
export interface Vec2AnimationChannelValues {
  type: 'vec2';
  values: Vector2[];
}
export interface Vec3AnimationChannelValues {
  type: 'vec3';
  values: Vector3[];
}
export interface QuatAnimationChannelValues {
  type: 'quat';
  values: Quaternion[];
}

export type AnimationChannelValues = ScalarAnimationChannelValues | Vec2AnimationChannelValues | Vec3AnimationChannelValues | QuatAnimationChannelValues;
export type AnimationTypeValue = ArrayElementType<AnimationChannelValues['values']>;

import type { GLTF } from "@gltf-transform/core";
import type { ArrayElementType } from "@polyzone/engine/util/types";
import type { Vector2, Vector3 } from "@polyzone/engine/util/vector";
import type { Quaternion } from "@polyzone/engine/util/quaternion";

export interface AnimationDefinition {
  name: string;
  length: number;
  channels: AnimationChannelDefinition[];
}

export interface AnimationChannelDefinition {
  targetNodeName: string;
  targetNodeProperty: GLTF.AnimationChannelTargetPath;
  timestamps: Float32Array;
  interpolation: GLTF.AnimationSamplerInterpolation;
  values: AnimationChannelValues;
}

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

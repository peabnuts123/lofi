import type { GLTF } from "@gltf-transform/core";
import type { AnimationChannelDefinition, AnimationChannelValues, AnimationTypeValue } from "@polyzone/engine/loaders/definitions";
import { inverseLerp, lerp } from "@polyzone/engine/util/math";
import { Vector2, Vector3 } from "@polyzone/engine/util/vector";
import { Quaternion } from "@polyzone/engine/util/quaternion";
import type { Model, MeshNode } from "@polyzone/engine/models";

export class AnimationChannel {
  private readonly targetNodeName: string;
  private readonly timestamps: Float32Array;
  private readonly values: AnimationChannelValues;
  private readonly interpolation: GLTF.AnimationSamplerInterpolation;
  private readonly targetNodeProperty: GLTF.AnimationChannelTargetPath;

  private currentModel: Model | undefined = undefined;
  private currentModelTarget: MeshNode | undefined = undefined;

  public constructor(
    definition: AnimationChannelDefinition,
  ) {
    this.targetNodeName = definition.targetNodeName;
    this.timestamps = definition.timestamps;
    this.values = definition.values;
    this.interpolation = definition.interpolation;
    this.targetNodeProperty = definition.targetNodeProperty;
  }

  public update(currentAnimationTime: number, target: Model): void {
    if (this.timestamps.length === 1) {
      // @NOTE Special case, animation just has 1 keyframe /shrug
      this.assignAnimatedValue(target, 0, undefined, currentAnimationTime);
      return;
    }

    // Find which 2 timestamps the current animation time lays between
    let previousTimestampIndex: number | undefined = undefined;
    let nextTimestampIndex: number | undefined = undefined;
    for (let i = 0; i < this.timestamps.length; i++) {
      const timestamp = this.timestamps[i];
      if (timestamp <= currentAnimationTime) {
        previousTimestampIndex = i;
      } else {
        nextTimestampIndex = i;
        break;
      }
    }

    // Pass off to animation channel to assign correct value
    // @NOTE For fucks sake TypeScript
    if (previousTimestampIndex !== undefined && nextTimestampIndex === undefined) {
      this.assignAnimatedValue(target, previousTimestampIndex, nextTimestampIndex, currentAnimationTime);
    } else if (previousTimestampIndex === undefined && nextTimestampIndex !== undefined) {
      this.assignAnimatedValue(target, previousTimestampIndex, nextTimestampIndex, currentAnimationTime);
    } else if (previousTimestampIndex !== undefined && nextTimestampIndex !== undefined) {
      this.assignAnimatedValue(target, previousTimestampIndex, nextTimestampIndex, currentAnimationTime);
    } else {
      throw new Error(`Logic error playing animation, can't locate index of current animation time within animation timestamps. (currentAnimationTime='${currentAnimationTime}') (timestamps='${this.timestamps.join(',')}')`);
    }
  }

  public assignAnimatedValue(target: Model, previousTimestampIndex: number, nextTimestampIndex: undefined, animationTime: number): void;
  public assignAnimatedValue(targetNode: Model, previousTimestampIndex: undefined, nextTimestampIndex: number, animationTime: number): void;
  public assignAnimatedValue(targetNode: Model, previousTimestampIndex: number, nextTimestampIndex: number, animationTime: number): void;
  public assignAnimatedValue(targetNode: Model, previousTimestampIndex: number | undefined, nextTimestampIndex: number | undefined, animationTime: number): void {
    if (previousTimestampIndex === undefined) {
      // Peg to initial value
      this.setValue(targetNode, this.values.values[nextTimestampIndex!]);
    } else if (nextTimestampIndex === undefined) {
      // Peg to final value
      this.setValue(targetNode, this.values.values[previousTimestampIndex]);
    } else {
      // Interpolate between two values
      if (this.interpolation === 'LINEAR') {
        /* Linear interpolation */
        const t = inverseLerp(this.timestamps[previousTimestampIndex], this.timestamps[nextTimestampIndex], animationTime);

        // @TODO have some re-usable vectors, quats, laying around
        let value: AnimationTypeValue;
        switch (this.values.type) {
          case 'scalar': {
            const a = this.values.values[previousTimestampIndex];
            const b = this.values.values[nextTimestampIndex];
            value = lerp(a, b, t);
            break;
          }
          case 'vec2': {
            const a = this.values.values[previousTimestampIndex];
            const b = this.values.values[nextTimestampIndex];
            value = new Vector2(
              lerp(a.x, b.x, t),
              lerp(a.y, b.y, t),
            );
            break;
          }
          case 'vec3': {
            const a = this.values.values[previousTimestampIndex];
            const b = this.values.values[nextTimestampIndex];
            value = new Vector3(
              lerp(a.x, b.x, t),
              lerp(a.y, b.y, t),
              lerp(a.z, b.z, t),
            );
            break;
          }
          case 'quat': {
            const a = this.values.values[previousTimestampIndex];
            const b = this.values.values[nextTimestampIndex];
            value = a.slerp(b, t);
            break;
          }
          default:
            throw new Error(`Animation with LINEAR interpolation has unimplemented value type: ${(this.values as { type: string }).type}`);
        }

        this.setValue(targetNode, value);
      } else if (this.interpolation === 'STEP') {
        /* Step interpolation */
        // Step is just constant with previous timestamp
        this.setValue(targetNode, this.values.values[previousTimestampIndex]);
      } else if (this.interpolation === 'CUBICSPLINE') {
        /* Cubic spline interpolation */
        // @TODO
        throw new Error(`CUBICSPLINE interpolation not yet implemented`);
      } else {
        throw new Error(`Animation interpolation type '${this.interpolation}' not yet implemented`);
      }
    }
  }

  private setValue(model: Model, value: AnimationTypeValue): void {
    // Cache target model part so we don't have to compute it per channel per frame
    if (model !== this.currentModel) {
      this.currentModelTarget = model.allNodes.find((node) => node.name === this.targetNodeName);
      this.currentModel = model;
    }
    if (this.currentModelTarget === undefined) {
      // @NOTE Target node is not present. Do not animate.
      // This is not a failure state. For example, retargeted
      // animation rig might not have all the same bones.
      return;
    }

    switch (this.targetNodeProperty) {
      case 'translation':
        this.currentModelTarget.position = value as Vector3;
        break;
      case 'rotation':
        this.currentModelTarget.rotation.set(value as Quaternion);
        break;
      case 'scale':
        this.currentModelTarget.scale = value as Vector3;
        break;
      case 'weights':
        // @TODO
        throw new Error(`Unimplemented animation value setter property 'weights'`);
      default:
        throw new Error(`Unimplemented animation value setter property '${this.targetNodeProperty}'`);
    }
  }
}

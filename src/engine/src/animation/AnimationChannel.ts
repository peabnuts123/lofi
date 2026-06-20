import { inverseLerp, lerp } from "@lofi/core/math/util";
import { Vector2, Vector3 } from "@lofi/core/math/vector";
import { Quaternion } from "@lofi/core/math/Quaternion";
import type { AnimationChannelDefinition, AnimationChannelTargetPath, AnimationChannelValues, AnimationSamplerInterpolation, AnimationTypeValue } from "@lofi/engine/loaders/definitions";
import type { Model, ModelPart } from "@lofi/engine/models";

export class AnimationChannel {
  private readonly targetNodeName: string;
  private readonly timestamps: Float32Array;
  private readonly values: AnimationChannelValues;
  private readonly interpolation: AnimationSamplerInterpolation;
  private readonly targetNodeProperty: AnimationChannelTargetPath;

  private currentModel: Model | undefined = undefined;
  private currentModelTarget: ModelPart | undefined = undefined;

  public constructor(
    definition: AnimationChannelDefinition,
  ) {
    this.targetNodeName = definition.targetPartName;
    this.timestamps = definition.timestamps;
    this.values = definition.values;
    this.interpolation = definition.interpolation;
    this.targetNodeProperty = definition.targetPartProperty;
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
    if (previousTimestampIndex !== undefined || nextTimestampIndex !== undefined) {
      // @NOTE TypeScript is too dumb to figure this one out
      this.assignAnimatedValue(target, previousTimestampIndex!, nextTimestampIndex!, currentAnimationTime);
    } else {
      throw new Error(`Logic error playing animation, can't locate index of current animation time within animation timestamps. (currentAnimationTime='${currentAnimationTime}') (timestamps='${this.timestamps.join(',')}')`);
    }
  }

  private tmp_assignAnimatedValue_vec2 = Vector2.zero();
  private tmp_assignAnimatedValue_vec3 = Vector3.zero();
  private tmp_assignAnimatedValue_quat = Quaternion.identity();
  private assignAnimatedValue(target: Model, previousTimestampIndex: number, nextTimestampIndex: undefined, animationTime: number): void;
  private assignAnimatedValue(targetNode: Model, previousTimestampIndex: undefined, nextTimestampIndex: number, animationTime: number): void;
  private assignAnimatedValue(targetNode: Model, previousTimestampIndex: number, nextTimestampIndex: number, animationTime: number): void;
  private assignAnimatedValue(targetNode: Model, previousTimestampIndex: number | undefined, nextTimestampIndex: number | undefined, animationTime: number): void {
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
            value = this.tmp_assignAnimatedValue_vec2.setValue(
              lerp(a.x, b.x, t),
              lerp(a.y, b.y, t),
            );
            break;
          }
          case 'vec3': {
            const a = this.values.values[previousTimestampIndex];
            const b = this.values.values[nextTimestampIndex];
            value = this.tmp_assignAnimatedValue_vec3.setValue(
              lerp(a.x, b.x, t),
              lerp(a.y, b.y, t),
              lerp(a.z, b.z, t),
            );
            break;
          }
          case 'quat': {
            const a = this.values.values[previousTimestampIndex];
            const b = this.values.values[nextTimestampIndex];
            value = this.tmp_assignAnimatedValue_quat.setValue(a).slerpSelf(b, t);
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
      this.currentModelTarget = model.allParts.find((node) => node.name === this.targetNodeName);
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
        this.currentModelTarget.position.setValue(value as Vector3);
        break;
      case 'rotation':
        this.currentModelTarget.rotation.set(value as Quaternion);
        break;
      case 'scale':
        this.currentModelTarget.scale.setValue(value as Vector3);
        break;
      case 'weights':
        // @TODO
        throw new Error(`Unimplemented animation value setter property 'weights'`);
      default:
        throw new Error(`Unimplemented animation value setter property '${this.targetNodeProperty}'`);
    }
  }
}

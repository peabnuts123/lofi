import { Observable } from "@lofi/core/util/Observable";
import type { AxisAlignedBoundingBoxConstructorArgs } from "@lofi/engine/collision/AxisAlignedBoundingBox";

export interface ScaleBasedAABBApproximationPolicy {
  type: 'scaled';
  scaleFactor: number;
}

export interface FixedSizeAABBApproximationPolicy {
  type: 'fixed';
  dimensions: AxisAlignedBoundingBoxConstructorArgs;
}

export type AABBApproximationPolicy = ScaleBasedAABBApproximationPolicy | FixedSizeAABBApproximationPolicy;

export class ModelConfig extends Observable {
  private _aabbApproximationPolicy: AABBApproximationPolicy = { type: 'scaled', scaleFactor: 2 };

  public get aabbApproximationPolicy(): AABBApproximationPolicy { return this._aabbApproximationPolicy; }
  public set aabbApproximationPolicy(value: AABBApproximationPolicy) {
    // Validation
    if (value.type === 'scaled') {
      if (value.scaleFactor === 0) {
        throw new Error(`AABB approximation policy of type '${value.type}' cannot have a scaleFactor of 0`);
      } else if (value.scaleFactor < 0) {
        throw new Error(`AABB approximation policy of type '${value.type}' cannot have a negative scaleFactor`);
      }
    }

    this._aabbApproximationPolicy = value;
    this.notifyOnChange();
  }
}

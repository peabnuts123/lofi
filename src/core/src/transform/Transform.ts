import { Computed, WritableComputed } from "@lofi/core/util/observable";
import { Vector3, Matrix4, Quaternion } from "@lofi/core/math";

import { Rotation } from "./Rotation";

interface TransformNodeTarget {
  get name(): string;
}

// @TODO Could lift up into `@lofi/engine` ?
export class Transform<T extends TransformNodeTarget> {
  private readonly _position: Vector3;
  private readonly _rotation: Rotation;
  private readonly _scale: Vector3;

  private _parent: Transform<T> | undefined;
  public readonly children: Transform<T>[];

  private readonly _worldMatrix: Computed<Matrix4>;
  private readonly _absolutePosition: WritableComputed<Vector3>;
  private readonly _absoluteRotation: WritableComputed<Rotation>;
  private readonly _absoluteScale: WritableComputed<Vector3>;

  public readonly node: T;

  public constructor(node: T, parent?: Transform<T>) {
    this.node = node;

    this.children = [];

    /* Parent */
    this._parent = parent;
    this._parent?.children.push(this);

    /* Local transforms */
    this._position = Vector3.zero();
    this._rotation = new Rotation();
    this._scale = Vector3.one();

    /* Absolute transforms */
    const absolutePositionTmp = Vector3.zero();
    this._absolutePosition = new WritableComputed(Vector3.zero(), {
      dependencies: [
        this.position,
        /* Parent properties, if parent exists */
        ...(this.parent ? [
          this.parent._absoluteScale,
          this.parent._absoluteRotation,
          this.parent._absolutePosition,
        ] : []),
      ],
      recompute: (value) => {
        if (this.parent) {
          // Node is child of another node
          // Recompute absolute position considering parent's position, rotation, scale
          value
            // 1. Multiply position by parent absolute scale
            .setValue(
              absolutePositionTmp
                .setValue(this.position)
                .multiplySelf(this.parent.absoluteScale)
                // 2. Rotate by parent's absolute rotation
                .multiplySelf(this.parent.absoluteRotation.q)
                // 3. Add parent's absolute position
                .addSelf(this.parent.absolutePosition),
            );
        } else {
          // No parent - absolute is the same as local
          value.setValue(this.position);
        }
      },
      onSetValue: (value) => {
        if (this.parent !== undefined) {
          // Node is child of another node
          // Recompute local position considering parent's position, rotation, scale

          // @NOTE Basically just reverse order of `recompute()`
          // 1. Subtract parent's absolute position
          absolutePositionTmp
            .setValue(value)
            .subtractSelf(this.parent.absolutePosition)
            // 2. "Unrotate" by inverse of parent's absolute rotation
            .multiplySelf(this.parent.absoluteRotation.qInverse);
          // 3. Divide by parent's absolute scale
          if (Math.abs(this.parent.absoluteScale.x) <= Number.EPSILON) {
            console.warn(`Cannot set absolute position to '${value}' for node '${this.node.name}' as its parent(s) scaling.x is currently 0. Its local position.x will be calculated as if parent.absoluteScale.x = 1. This will produce unexpected results when this node's parent(s) scale returns to a non-zero value.`);
          } else {
            absolutePositionTmp.x /= this.parent.absoluteScale.x;
          }
          if (Math.abs(this.parent.absoluteScale.y) <= Number.EPSILON) {
            console.warn(`Cannot set absolute position to '${value}' for node '${this.node.name}' as its parent(s) scaling.y is currently 0. Its local position.y will be calculated as if parent.absoluteScale.y = 1. This will produce unexpected results when this node's parent(s) scale returns to a non-zero value.`);
          } else {
            absolutePositionTmp.y /= this.parent.absoluteScale.y;
          }
          if (Math.abs(this.parent.absoluteScale.z) <= Number.EPSILON) {
            console.warn(`Cannot set absolute position to '${value}' for node '${this.node.name}' as its parent(s) scaling.z is currently 0. Its local position.z will be calculated as if parent.absoluteScale.z = 1. This will produce unexpected results when this node's parent(s) scale returns to a non-zero value.`);
          } else {
            absolutePositionTmp.z /= this.parent.absoluteScale.z;
          }

          this.position.setValue(absolutePositionTmp);
        } else {
          // No parent - absolute is the same as local
          this.position = value;
        }
      },
    });
    const absoluteRotationTmp = Quaternion.identity();
    this._absoluteRotation = new WritableComputed(new Rotation(), {
      dependencies: [
        this.rotation,
        /* Parent properties, if parent exists */
        ...(this.parent ? [
          this.parent._absoluteRotation,
        ] : []),
      ],
      recompute: (value) => {
        if (this.parent) {
          // Node is child of another node
          // Recompute absolute rotation considering parent's rotation
          value.q.setValue(
            absoluteRotationTmp
              .setValue(this.parent.absoluteRotation.q)
              .multiplySelf(this.rotation.q),
          );
        } else {
          // No parent - absolute is the same as local
          value.q.setValue(this.rotation.q);
        }
      },
      onSetValue: (value) => {
        if (this.parent !== undefined) {
          // Node is child of another node
          // Convert to local
          this.rotation.q.setValue(
            absoluteRotationTmp
              .setValue(this.parent.absoluteRotation.qInverse)
              .multiplySelf(value.q),
          );
        } else {
          // No parent - local is the same as absolute
          this.rotation.q.setValue(value.q);
        }
      },
    });
    const absoluteScaleTmp = Vector3.zero();
    this._absoluteScale = new WritableComputed(Vector3.one(), {
      dependencies: [
        this.scale,
        /* Parent properties, if parent exists */
        ...(this.parent ? [
          this.parent._absoluteScale,
        ] : []),
      ],
      recompute: (value) => {
        if (this.parent) {
          // Node is child of another node
          // Recompute absolute scale considering parent's scale
          value.setValue(
            absoluteScaleTmp
              .setValue(this.parent.absoluteScale)
              .multiplySelf(this.scale),
          );
        } else {
          // No parent - absolute is the same as local
          value.setValue(this.scale);
        }
      },
      onSetValue: (value) => {
        if (this.parent !== undefined) {
          // Node is child of another node
          // Recompute local scale considering parent's scale
          absoluteScaleTmp.setValue(1, 1, 1);

          // Avoid division by zero
          /* X */
          if (Math.abs(this.parent.absoluteScale.x) <= Number.EPSILON) {
            console.warn(`Cannot set absolute scaling to '${value}' for node '${this.node.name}' as its parent(s) scaling.x is currently 0. Its local scaling.x will be set to 1. This will produce unexpected results when this node's parent(s) scale returns to a non-zero value.`);
          } else {
            absoluteScaleTmp.x = value.x / this.parent.absoluteScale.x;
          }
          /* Y */
          if (Math.abs(this.parent.absoluteScale.y) <= Number.EPSILON) {
            console.warn(`Cannot set absolute scaling to '${value}' for node '${this.node.name}' as its parent(s) scaling.y is currently 0. Its local scaling.y will be set to 1. This will produce unexpected results when this node's parent(s) scale returns to a non-zero value.`);
          } else {
            absoluteScaleTmp.y = value.y / this.parent.absoluteScale.y;
          }
          /* Z */
          if (Math.abs(this.parent.absoluteScale.z) <= Number.EPSILON) {
            console.warn(`Cannot set absolute scaling to '${value}' for node '${this.node.name}' as its parent(s) scaling.z is currently 0. Its local scaling.z will be set to 1. This will produce unexpected results when this node's parent(s) scale returns to a non-zero value.`);
          } else {
            absoluteScaleTmp.z = value.z / this.parent.absoluteScale.z;
          }

          this.scale = absoluteScaleTmp;
        } else {
          // No parent - absolute is the same as local
          this.scale = value;
        }
      },
    });

    // Ensure position / rotation / scale are correct relative to parent
    if (parent) {
      this._absolutePosition.forceRecompute();
      this._absoluteRotation.forceRecompute();
      this._absoluteScale.forceRecompute();
    }

    this._worldMatrix = new Computed(new Matrix4(), {
      dependencies: [
        this._absolutePosition,
        this._absoluteRotation,
        this._absoluteScale,
      ],
      recompute: (value) => {
        value.fromRotationTranslationScaleSelf(
          this.absoluteRotation.q,
          this.absolutePosition,
          this.absoluteScale,
        );
      },
    });
  }

  /**
   * Add a child node to this node.
   * Unless {@linkcode preserveLocalTransform} is set, the child's local transform values
   * will be recalculated to preserve its absolute transform values.
   *
   * @param child - The child node to add
   * @param preserveLocalTransform - Whether to preserve the child's local transform when reparenting
   * @throws {Error} If the child already has a different parent
   */
  private addChild(child: Transform<T>, preserveLocalTransform: boolean = false): void {
    if (this.children.some((existingChild) => existingChild === child)) {
      console.warn(`Tried to add transform '${child.node.name}' as child of transform '${this.node.name}' but it is already a child of this node`);
    } else if (child.parent !== undefined) {
      throw new Error(`Cannot add transform '${child.node.name}' as child of transform '${this.node.name}': It is already the child of another transform: '${child.parent.node.name}'`);
    } else {
      if (!preserveLocalTransform) {
        // Ensure absolute properties are up to date, as we will immediately
        // use them to recompute local properties after reparenting
        child._absolutePosition.forceRecompute();
        child._absoluteRotation.forceRecompute();
        child._absoluteScale.forceRecompute();
      }

      // Set parent
      this.children.push(child);
      child._parent = this;

      // Update child computed property dependencies
      child._absolutePosition.addDependency(
        this._absoluteScale,
        this._absoluteRotation,
        this._absolutePosition,
      );
      child._absoluteRotation.addDependency(
        this._absoluteRotation,
      );
      child._absoluteScale.addDependency(
        this._absoluteScale,
      );

      if (!preserveLocalTransform) {
        // Force recalculate child local position/rotation/scale
        child._absolutePosition.forceWriteBack();
        child._absoluteRotation.forceWriteBack();
        child._absoluteScale.forceWriteBack();
      }
    }
  }

  /**
   * Remove a child node from this node.
   * Unless {@linkcode preserveLocalTransform} is set, the child's local transform values
   * will be recalculated to preserve its absolute transform values.
   * The child becomes a top-level node in the scene.
   *
   * @param child - The scene node to remove
   * @param preserveLocalTransform - Whether to preserve the child's local transform when reparenting
   */
  private removeChild(child: Transform<T>, preserveLocalTransform: boolean = false): void {
    const index = this.children.indexOf(child);
    if (index < 0) {
      console.warn(`Cannot remove transform '${child.node.name}' from children of node '${this.node.name}': it is not a child of this node`);
    } else {
      if (!preserveLocalTransform) {
        // Ensure absolute properties are up to date, as we will immediately
        // use them to recompute local properties after reparenting
        child._absolutePosition.forceRecompute();
        child._absoluteRotation.forceRecompute();
        child._absoluteScale.forceRecompute();
      }

      // Set parent
      this.children.splice(index, 1);
      child._parent = undefined;

      // Update child computed property dependencies
      child._absolutePosition.removeDependency(
        this._absoluteScale,
        this._absoluteRotation,
        this._absolutePosition,
      );
      child._absoluteRotation.removeDependency(
        this._absoluteRotation,
      );
      child._absoluteScale.removeDependency(
        this._absoluteScale,
      );

      if (!preserveLocalTransform) {
        // Force recalculate child local position/rotation/scale
        child._absolutePosition.forceWriteBack();
        child._absoluteRotation.forceWriteBack();
        child._absoluteScale.forceWriteBack();
      }
    }
  }

  /**
   * Execute a callback function for each child node of this node.
   *
   * @param fn - The callback function to execute for each child.
   * @param recursive - Whether to iterate recursively through the entire hierarchy or just this Transform's direct children.
   */
  public forEachChild(fn: (child: Transform<T>) => void, recursive: boolean = false): void {
    for (const child of this.children) {
      fn(child);
      if (recursive) {
        child.forEachChild(fn, recursive);
      }
    }
  }

  /**
   * Find a node within this transform's hierarchy.
   *
   * @param fn - The test function to execute for each child.
   * @param recursive - Whether to iterate recursively through the entire hierarchy or just this Transform's direct children.
   */
  public findChild(fn: (child: Transform<T>) => boolean, recursive: boolean = false): Transform<T> | undefined {
    for (const child of this.children) {
      if (fn(child)) {
        return child;
      }

      if (recursive) {
        const result = child.findChild(fn, recursive);
        if (result) return result;
      }
    }
  }

  public get parent(): Transform<T> | undefined { return this._parent; }
  public set parent(value: Transform<T> | undefined) {
    // Remove self from current parent
    if (this.parent !== undefined) {
      this.parent.removeChild(this);
    }

    // Add self as child of new parent
    if (value !== undefined) {
      value.addChild(this);
    }
  }

  public get position(): Vector3 { return this._position; }
  public set position(value: Vector3) { this._position.setValue(value); }
  public get rotation(): Rotation { return this._rotation; }
  public get scale(): Vector3 { return this._scale; }
  public set scale(value: Vector3) { this._scale.setValue(value); }

  public get absolutePosition(): Vector3 { return this._absolutePosition.value; }
  public set absolutePosition(value: Vector3) { this._absolutePosition.value.setValue(value); }
  public get absoluteRotation(): Rotation { return this._absoluteRotation.value; }
  public get absoluteScale(): Vector3 { return this._absoluteScale.value; }
  public set absoluteScale(value: Vector3) { this._absoluteScale.value.setValue(value); }

  public get worldMatrix(): Matrix4 { return this._worldMatrix.value; }
  public get worldMatrixComputed(): Computed<Matrix4> { return this._worldMatrix; }
}


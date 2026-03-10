import { Vector3 } from "./vector";
import { Rotation } from "./Rotation";
import { Matrix4 } from "./Matrix4";
import { Computed, WritableComputed } from "./observable";

interface TransformNodeTarget {
  get name(): string;
}

export class Transform<T extends TransformNodeTarget> {
  private readonly _position: Vector3;
  private readonly _rotation: Rotation;
  private readonly _scale: Vector3;

  private _parent: Transform<T> | undefined;
  public readonly children: Transform<T>[];

  private readonly _worldMatrix: Computed<Matrix4>;
  private readonly _absolutePosition: Computed<Vector3>;
  private readonly _absoluteRotation: Computed<Rotation>;
  private readonly _absoluteScale: Computed<Vector3>;

  public readonly node: T;

  public constructor(node: T) {
    this.node = node;

    this.children = [];

    /* Local transforms */
    this._position = Vector3.zero();
    this._rotation = new Rotation();
    this._scale = Vector3.one();

    /* Absolute transforms */
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
            .setValue(this.position)
            .multiplySelf(this.parent.absoluteScale)
            // 2. Rotate by parent's absolute rotation
            .multiplySelf(this.parent.absoluteRotation.q)
            // 3. Add parent's absolute position
            .addSelf(this.parent.absolutePosition);
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
          this.position
            .setValue(value)
            .subtractSelf(this.parent.absolutePosition)
            // 2. "Unrotate" by inverse of parent's absolute rotation
            .multiplySelf(this.parent.absoluteRotation.qInverse)
            // 3. Divide by parent's absolute scale
            .divideSelf(this.parent.absoluteScale);
        } else {
          // No parent - absolute is the same as local
          this.position = value;
        }
      },
    });
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
          value.set(
            this.parent.absoluteRotation.q.multiply(this.rotation.q),
          );
        } else {
          // No parent - absolute is the same as local
          value.set(this.rotation.q);
        }
      },
      onSetValue: (value) => {
        if (this.parent !== undefined) {
          // Node is child of another node
          // Convert to local
          this.rotation.set(
            this.parent.absoluteRotation.qInverse.multiply(value.q),
          );
        } else {
          // No parent - local is the same as absolute
          this.rotation.set(value.q);
        }
      },
    });
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
          value.setValue(this.parent.absoluteScale.multiply(this.scale));
        } else {
          // No parent - absolute is the same as local
          value.setValue(this.scale);
        }
      },
      onSetValue: (value) => {
        if (this.parent !== undefined) {
          // Node is child of another node
          // Recompute local scale considering parent's scale
          const newScale = new Vector3(1, 1, 1);

          // Avoid division by zero
          /* X */
          if (Math.abs(this.parent.absoluteScale.x) <= Number.EPSILON) {
            console.warn(`Cannot set absolute scaling to '${value}' for node '${this.node.name}' as its parent(s) scaling.x is currently 0. Its local scaling.x will be set to 1. This will produce unexpected results when this node's parent(s) scale returns to a non-zero value.`);
          } else {
            newScale.x = value.x / this.parent.absoluteScale.x;
          }
          /* Y */
          if (Math.abs(this.parent.absoluteScale.y) <= Number.EPSILON) {
            console.warn(`Cannot set absolute scaling to '${value}' for node '${this.node.name}' as its parent(s) scaling.y is currently 0. Its local scaling.y will be set to 1. This will produce unexpected results when this node's parent(s) scale returns to a non-zero value.`);
          } else {
            newScale.y = value.y / this.parent.absoluteScale.y;
          }
          /* Z */
          if (Math.abs(this.parent.absoluteScale.z) <= Number.EPSILON) {
            console.warn(`Cannot set absolute scaling to '${value}' for node '${this.node.name}' as its parent(s) scaling.z is currently 0. Its local scaling.z will be set to 1. This will produce unexpected results when this node's parent(s) scale returns to a non-zero value.`);
          } else {
            newScale.z = value.z / this.parent.absoluteScale.z;
          }

          this.scale = newScale;
        } else {
          // No parent - absolute is the same as local
          this.scale = value;
        }
      },
    });

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
   * The child's absolute transform values are preserved while its local transform values
   * are recalculated relative to this node's transform.
   *
   * @param child - The child node to add
   * @throws {Error} If the child already has a different parent
   */
  public addChild(child: Transform<T>): void {
    if (child.parent !== undefined) {
      throw new Error(`Cannot add transform '${child.node.name}' as child of transform '${this.node.name}': It is already the child of another transform: '${child.parent.node.name}'`);
    } else if (this.children.some((existingChild) => existingChild === child)) {
      console.warn(`Tried to add transform '${child.node.name}' as child of transform '${this.node.name}' but it is already a child of this node`);
    } else {
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

      // Force recalculate child local position/rotation/scale
      child.absolutePosition.setValue(child.absolutePosition);
      child.absoluteRotation.set(child.absoluteRotation.q);
      child.absoluteScale.setValue(child.absoluteScale);
    }
  }

  /**
   * Remove a child node from this node.
   * The child's absolute transform values are preserved while its local transform values
   * are recalculated to maintain the same world position/rotation/scale.
   * The child becomes a top-level node in the scene.
   *
   * @param child - The scene node to remove
   */
  public removeChild(child: Transform<T>): void {
    const index = this.children.indexOf(child);
    if (index < 0) {
      console.warn(`Cannot remove transform '${child.node.name}' from children of node '${this.node.name}': it is not a child of this node`);
    } else {
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

      // Force recalculate child local position/rotation/scale
      child.absolutePosition.setValue(child.absolutePosition);
      child.absoluteRotation.set(child.absoluteRotation.q);
      child.absoluteScale.setValue(child.absoluteScale);
    }
  }

  /**
   * Execute a callback function for each child node of this node.
   *
   * @param fn - The callback function to execute for each child
   */
  public forEachChild(fn: (child: Transform<T>) => void): void {
    for (const child of this.children) {
      fn(child);
      child.forEachChild(fn);
    }
  }

  public get parent(): Transform<T> | undefined { return this._parent; }

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
}


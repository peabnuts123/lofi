import { DirtyVector3, ObservedVector3, Vector3 } from "@polyzone/engine/util/vector";
import { Rotation } from "@polyzone/engine/util/Rotation";
import { mat4, quat, vec3 } from "gl-matrix";

import type { IScene } from "./Scene";

export abstract class SceneNode {
  protected scene: IScene;
  public name: string;
  private _position: ObservedVector3;
  private _rotation: Rotation;
  private _scale: ObservedVector3;

  private _parent: SceneNode | undefined;
  private children: SceneNode[];

  private _worldMatrix: mat4 = mat4.create();
  private worldMatrixIsDirty: boolean = true;
  private _absolutePosition: DirtyVector3;
  private absolutePositionIsDirty: boolean = true;
  private _absoluteRotation: Rotation;
  private absoluteRotationIsDirty: boolean = false;
  private _absoluteScale: DirtyVector3;
  private absoluteScaleIsDirty: boolean = false;

  private _positionVecTmp: vec3 = vec3.create();
  private _rotationQuatTmp: quat = quat.create();
  private _scaleVecTmp: vec3 = vec3.create();

  public constructor(scene: IScene, name: string) {
    this.scene = scene;
    this.name = name;
    this.children = [];

    // Setup transforms
    /* Local transforms */
    this._position = new ObservedVector3(0, 0, 0, () => {
      this.markWorldMatrixDirty();
      this.markAbsolutePositionDirty();
    });
    this._rotation = new Rotation({
      onChange: () => {
        this.markWorldMatrixDirty();
        this.markAbsoluteRotationDirty();
      },
    });
    this._scale = new ObservedVector3(1, 1, 1, () => {
      this.markWorldMatrixDirty();
      this.markAbsoluteScaleDirty();
    });
    /* Absolute transforms */
    this._absolutePosition = new DirtyVector3(0, 0, 0,
      /* isDirty */() => this.absolutePositionIsDirty,
      /* refreshValue */() => this.recomputeAbsolutePosition(),
      /* onChange */() => this.recomputeLocalPositionFromParent());
    this._absoluteRotation = new Rotation({
      isDirty: () => this.absoluteRotationIsDirty,
      refreshValue: () => this.recomputeAbsoluteRotation(),
      onChange: () => this.recomputeLocalRotationFromParent(),
    });
    this._absoluteScale = new DirtyVector3(1, 1, 1,
      /* isDirty */() => this.absoluteScaleIsDirty,
      /* refreshValue */() => this.recomputeAbsoluteScale(),
      /* onChange */() => this.recomputeLocalScaleFromParent());

    // Compute initial values
    this.recomputeWorldMatrix();
    this.recomputeAbsolutePosition();
    this.recomputeAbsoluteRotation();
    this.recomputeAbsoluteScale();

    // Add node to scene
    this.scene.addTopLevelNode(this);
  }

  /**
   * Add a child node to this node.
   * The child's absolute transform values are preserved while its local transform values
   * are recalculated relative to this node's transform.
   *
   * @param child - The child node to add
   * @throws {Error} If the child already has a different parent
   */
  public addChild(child: SceneNode): void {
    if (child.parent !== undefined) {
      throw new Error(`Cannot add node '${child.name}' as child of node '${this.name}': It is already the child of another node: '${child.parent.name}'`);
    } else if (this.children.some((existingChild) => existingChild === child)) {
      console.warn(`Tried to add node '${child.name}' as child of node '${this.name}' but it is already a child of this node`);
    } else {
      // Ensure all absolute values are up-to-date
      // They will be used to recompute local transform values after reparenting
      child.recomputeAllDirtyState();

      // Set parent
      this.children.push(child);
      child._parent = this;
      this.scene.removeTopLevelNode(child);

      // Recompute transform values
      child.recomputeLocalPositionFromParent();
      child.recomputeLocalRotationFromParent();
      child.recomputeLocalScaleFromParent();
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
  public removeChild(child: SceneNode): void {
    const index = this.children.indexOf(child);
    if (index < 0) {
      console.warn(`Tried to remove node '${child.name}' from children of node '${this.name}' but it is not a child of this node`);
    } else {
      // Ensure all absolute values are up to date
      // They will be used to recompute local transform values after reparenting
      child.recomputeAllDirtyState();

      // Set parent
      this.children.splice(index, 1);
      child._parent = undefined;
      this.scene.addTopLevelNode(child);

      // Recompute transform values
      child.recomputeLocalPositionFromParent();
      child.recomputeLocalRotationFromParent();
      child.recomputeLocalScaleFromParent();
    }
  }

  /**
   * Execute a callback function for each child node of this node.
   *
   * @param fn - The callback function to execute for each child
   */
  public forEachChild(fn: (child: SceneNode) => void): void {
    for (const child of this.children) {
      fn(child);
      child.forEachChild(fn);
    }
  }

  /**
   * Called each frame to update this node's state. Override this method in subclasses
   * to implement per-frame update logic.
   *
   * @param dt - The time elapsed since the last frame, in seconds
   */
  public onUpdate(dt: number): void {
    /* No-op */
    // @NOTE Just shushing the linter about `dt` being unused.
    // eslint-disable doesn't work great because `ts` also
    // complains about it.
    void dt;
  }

  /**
   * Mark this node's world matrix as dirty, which will trigger recomputation on next access.
   * Recursively marks all descendant nodes' world matrices as dirty, since
   * changes to a parent's transform affect all children.
   */
  private markWorldMatrixDirty(): void {
    this.worldMatrixIsDirty = true;
    for (const child of this.children) {
      child.markWorldMatrixDirty();
    }
  }

  /**
   * Mark this node's absolute position as dirty, which will trigger recomputation on next access.
   * Recursively marks all descendant nodes' absolute positions as dirty as well, since
   * changes to a parent's position affect all children's absolute positions.
   */
  private markAbsolutePositionDirty(): void {
    this.absolutePositionIsDirty = true;
    for (const child of this.children) {
      child.markAbsolutePositionDirty();
    }
  }

  /**
   * Mark this node's absolute rotation as dirty, which will trigger recomputation on next access.
   * Recursively marks all descendant nodes' absolute rotations as dirty. Also marks
   * children's absolute positions as dirty since parent rotation can affect child position.
   * Child scale dirty flags are NOT affected.
   */
  private markAbsoluteRotationDirty(): void {
    this.absoluteRotationIsDirty = true;
    for (const child of this.children) {
      child.markAbsoluteRotationDirty();
      child.markAbsolutePositionDirty(); // Rotation can effect child position but NOT scale
    }
  }

  /**
   * Mark this node's absolute scale as dirty, which will trigger recomputation on next access.
   * Recursively marks all descendant nodes' absolute scales as dirty. Also marks
   * children's absolute positions as dirty since parent scale can affect child position.
   * Child rotation flags are NOT affected.
   */
  private markAbsoluteScaleDirty(): void {
    this.absoluteScaleIsDirty = true;
    for (const child of this.children) {
      child.markAbsoluteScaleDirty();
      child.markAbsolutePositionDirty(); // Scale can effect child position but NOT rotation
    }
  }

  /**
   * Recompute all dirty transform state for this node. This includes world matrix,
   * absolute position, absolute rotation, and absolute scale. Only recomputes values
   * that are currently marked as dirty.
   */
  private recomputeAllDirtyState(): void {
    if (this.worldMatrixIsDirty) this.recomputeWorldMatrix();
    if (this.absolutePositionIsDirty) this.recomputeAbsolutePosition();
    if (this.absoluteRotationIsDirty) this.recomputeAbsoluteRotation();
    if (this.absoluteScaleIsDirty) this.recomputeAbsoluteScale();
  }

  /**
   * Recompute the world transformation matrix from this node's absolute position,
   * rotation, and scale. The world matrix represents the complete transformation from
   * local space to world space and is used for rendering. Clears the dirty flag after
   * computation.
   */
  private recomputeWorldMatrix(): void {
    // @NOTE Re-use tmp values as memory optimisation
    // Convert to gl-matrix native types
    vec3.set(this._positionVecTmp, this.position.x, this.position.y, this.position.z);
    quat.set(this._rotationQuatTmp, this.rotation.q.x, this.rotation.q.y, this.rotation.q.z, this.rotation.q.w);
    vec3.set(this._scaleVecTmp, this.scale.x, this.scale.y, this.scale.z);

    // Calculate local matrix
    mat4.fromRotationTranslationScale(
      this._worldMatrix,
      this._rotationQuatTmp,
      this._positionVecTmp,
      this._scaleVecTmp,
    );

    if (this.parent) {
      mat4.multiply(
        this._worldMatrix,
        this.parent.worldMatrix,
        this._worldMatrix,
      );
    }

    this.worldMatrixIsDirty = false;
  }

  /**
   * Recompute this node's absolute (world-space) position from its local position
   * and parent's transform. Clears the dirty flag after computation.
   */
  private recomputeAbsolutePosition(): void {
    if (this.parent) {
      // Node is child of another node
      // Recompute position considering parent's position, rotation, scale

      // 1. Multiply position by parent absolute scale
      vec3.set(
        this._positionVecTmp,
        this.position.x * this.parent.absoluteScale.x,
        this.position.y * this.parent.absoluteScale.y,
        this.position.z * this.parent.absoluteScale.z,
      );

      // 2. Rotate by parent's absolute rotation
      quat.set(this._rotationQuatTmp, this.parent.absoluteRotation.q.x, this.parent.absoluteRotation.q.y, this.parent.absoluteRotation.q.z, this.parent.absoluteRotation.q.w);
      vec3.transformQuat(this._positionVecTmp, this._positionVecTmp, this._rotationQuatTmp);

      // 3. Add parent's absolute position
      this._absolutePosition.setValue(
        this._positionVecTmp[0] + this.parent.absolutePosition.x,
        this._positionVecTmp[1] + this.parent.absolutePosition.y,
        this._positionVecTmp[2] + this.parent.absolutePosition.z,
        false,
      );
    } else {
      // No parent - absolute is the same as local
      this._absolutePosition.setValue(
        this.position,
        false,
      );
    }

    this.absolutePositionIsDirty = false;
  }
  /**
   * Recompute this node's local position from its absolute (world-space) position
   * and parent's transform.
   */
  private recomputeLocalPositionFromParent(): void {
    if (this.parent !== undefined) {
      // Node is child of another node
      // Recompute local position considering parent's position, rotation, scale
      // @NOTE Reverse order of `recomputeAbsolutePosition()`

      // 1. Subtract parent's absolute position
      vec3.set(
        this._positionVecTmp,
        this.absolutePosition.x - this.parent.absolutePosition.x,
        this.absolutePosition.y - this.parent.absolutePosition.y,
        this.absolutePosition.z - this.parent.absolutePosition.z,
      );

      // 2. "Unrotate" by inverse of parent's absolute rotation
      quat.set(
        this._rotationQuatTmp,
        this.parent.absoluteRotation.qConjugate.x,
        this.parent.absoluteRotation.qConjugate.y,
        this.parent.absoluteRotation.qConjugate.z,
        this.parent.absoluteRotation.qConjugate.w,
      );
      vec3.transformQuat(this._positionVecTmp, this._positionVecTmp, this._rotationQuatTmp);

      // 3. Divide by parent's absolute scale
      this.position.setValue(
        this._positionVecTmp[0] / this.parent.absoluteScale.x,
        this._positionVecTmp[1] / this.parent.absoluteScale.y,
        this._positionVecTmp[2] / this.parent.absoluteScale.z,
      );
    } else {
      // No parent - absolute is the same as local
      this.position = this.absolutePosition;
    }
  }

  /**
   * Recompute this node's absolute (world-space) rotation from its local rotation
   * and parent's absolute rotation. Clears the dirty flag after computation.
   */
  private recomputeAbsoluteRotation(): void {
    if (this.parent) {
      // @TODO is addition the correct operator here?
      this._absoluteRotation.set(
        this.parent.absoluteRotation.q.multiply(this.rotation.q),
        false,
      );
    } else {
      this._absoluteRotation.set(
        this.rotation.q,
        false,
      );
    }
    this.absoluteRotationIsDirty = false;
  }
  /**
   * Recompute this node's local rotation from its absolute (world-space) rotation
   * and parent's absolute rotation.
   */
  private recomputeLocalRotationFromParent(): void {
    if (this.parent !== undefined) {
      // Convert to local
      this.rotation.set(
        this.parent.absoluteRotation.qConjugate.multiply(this.absoluteRotation.q),
        false,
      );
    } else {
      // No parent - local is the same as absolute
      this.rotation.set(
        this.absoluteRotation.q,
        false,
      );
    }
  }

  /**
   * Recompute this node's absolute (world-space) scale from its local scale
   * and parent's absolute scale. Clears the dirty flag after computation.
   */
  private recomputeAbsoluteScale(): void {
    if (this.parent) {
      this._absoluteScale.setValue(
        this.parent.absoluteScale.multiply(this.scale),
        false,
      );
    } else {
      this._absoluteScale.setValue(
        this.scale,
        false,
      );
    }
    this.absoluteScaleIsDirty = false;
  }
  /**
   * Recompute this node's local scale from its absolute (world-space) scale
   * and parent's absolute scale.
   * If the parent has 0 scale in any axis, the value 1 will be used as the result
   * for that axis to avoid division by zero, and a warning will be logged.
   */
  private recomputeLocalScaleFromParent(): void {
    if (this.parent !== undefined) {
      const newScale = new Vector3(1, 1, 1);
      // Avoid division by zero
      /* X */
      if (Math.abs(this.parent.absoluteScale.x) <= Number.EPSILON) {
        console.warn(`Cannot set absolute scaling to '${this.absoluteScale}' for node '${this.name}' as its parent(s) scaling.x is currently 0. Its local scaling.x will be set to 1. This will produce unexpected results when this node's parent(s) scale returns to a non-zero value.`);
      } else {
        newScale.x = this.absoluteScale.x / this.parent.absoluteScale.x;
      }
      /* Y */
      if (Math.abs(this.parent.absoluteScale.y) <= Number.EPSILON) {
        console.warn(`Cannot set absolute scaling to '${this.absoluteScale}' for node '${this.name}' as its parent(s) scaling.y is currently 0. Its local scaling.y will be set to 1. This will produce unexpected results when this node's parent(s) scale returns to a non-zero value.`);
      } else {
        newScale.y = this.absoluteScale.y / this.parent.absoluteScale.y;
      }
      /* Z */
      if (Math.abs(this.parent.absoluteScale.z) <= Number.EPSILON) {
        console.warn(`Cannot set absolute scaling to '${this.absoluteScale}' for node '${this.name}' as its parent(s) scaling.z is currently 0. Its local scaling.z will be set to 1. This will produce unexpected results when this node's parent(s) scale returns to a non-zero value.`);
      } else {
        newScale.z = this.absoluteScale.z / this.parent.absoluteScale.z;
      }

      this.scale = newScale;
    } else {
      // No parent - absolute is the same as local
      this.scale = this.absoluteScale;
    }
  }

  public get parent(): SceneNode | undefined {
    return this._parent;
  }
  private set parent(value: SceneNode) {
    const existingParent = this._parent;
    // Remove node from parent's children
    if (existingParent !== undefined) {
      existingParent.removeChild(this);
    }

    value.addChild(this);
  }

  public get position(): Vector3 { return this._position; }
  public set position(value: Vector3) { this._position.setValue(value); }
  public get rotation(): Rotation { return this._rotation; }
  public get scale(): Vector3 { return this._scale; }
  public set scale(value: Vector3) { this._scale.setValue(value); }

  public get absolutePosition(): Vector3 {
    if (this.absolutePositionIsDirty) {
      this.recomputeAbsolutePosition();
    }
    return this._absolutePosition;
  }
  public set absolutePosition(value: Vector3) { this._absolutePosition.setValue(value); }

  public get absoluteRotation(): Rotation {
    if (this.absoluteRotationIsDirty) {
      this.recomputeAbsoluteRotation();
    }
    return this._absoluteRotation;
  }

  public get absoluteScale(): Vector3 {
    if (this.absoluteScaleIsDirty) {
      this.recomputeAbsoluteScale();
    }
    return this._absoluteScale;
  }
  public set absoluteScale(value: Vector3) { this._absoluteScale.setValue(value); }

  public get worldMatrix(): mat4 {
    if (this.worldMatrixIsDirty) {
      this.recomputeWorldMatrix();
    }
    return this._worldMatrix;
  }
}

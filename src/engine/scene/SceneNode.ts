import type { Vector3 } from "@polyzone/engine/util/vector";

export interface ISceneNodeWithPosition {
  position: Vector3;
}
export interface ISceneNodeWithRotation {
  rotation: Vector3;
}
export interface ISceneNodeWithScale {
  scale: Vector3;
}

export abstract class SceneNode {
  public name: string;
  private _parent: SceneNode | undefined;
  private children: SceneNode[];

  public constructor(name: string) {
    this.name = name;
    this.children = [];
  }

  public addChild(child: SceneNode): void {
    if (child.parent !== undefined) {
      throw new Error(`Cannot add node '${child.name}' as child of node '${this.name}': It is already the child of another node: '${child.parent.name}'`);
    } else if (this.children.some((existingChild) => existingChild === child)) {
      console.warn(`Tried to add node '${child.name}' as child of node '${this.name}' but it is already a child of this node`);
    } else {
      this.children.push(child);
    }
  }

  public removeChild(child: SceneNode): void {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
    } else {
      console.warn(`Tried to remove node '${child.name}' from children of node '${this.name}' but it is not a child of this node`);
    }
  }

  public forEachChild(fn: (child: SceneNode) => void): void {
    for (const child of this.children) {
      fn(child);
    }
  }

  public onUpdate(dt: number): void {/* No-op */ }

  public get parent(): SceneNode | undefined {
    return this._parent;
  }
}

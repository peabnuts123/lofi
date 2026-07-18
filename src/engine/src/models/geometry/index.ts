import type { IReadonlyVector3 } from "@lofi/core/math/Vector3";
import { Observable } from "@lofi/core/util/observable";

export * from './MeshPrimitiveGeometry';
export * from './ModelGeometry';
export * from './ModelNodeGeometry';
export * from './ModelPartGeometry';

/* Triangles */
/** A set of three vertex positions. */
export type Triangle = readonly [aPos: IReadonlyVector3, bPos: IReadonlyVector3, cPos: IReadonlyVector3];
/** A set of three vertex indices (read only). */
export interface IReadonlyTriangleIndices {
  clone(): TriangleIndices;
  get aIndex(): number;
  get bIndex(): number;
  get cIndex(): number;
}
/** A set of three vertex indices. */
export class TriangleIndices extends Observable implements IReadonlyTriangleIndices {
  private indices: Uint32Array;

  public constructor(aIndex: number, bIndex: number, cIndex: number) {
    super();
    this.indices = new Uint32Array(3);

    this.indices[0] = aIndex;
    this.indices[1] = bIndex;
    this.indices[2] = cIndex;
  }

  public setValue(a: number, b: number, c: number): void {
    this.indices[0] = a;
    this.indices[1] = b;
    this.indices[2] = c;
    this.notifyOnChange();
  }

  public clone(): TriangleIndices {
    return new TriangleIndices(this.aIndex, this.bIndex, this.cIndex);
  }

  public get aIndex(): number {
    return this.indices[0];
  }
  public set aIndex(value: number) {
    this.indices[0] = value;
    this.notifyOnChange();
  }
  public get bIndex(): number {
    return this.indices[1];
  }
  public set bIndex(value: number) {
    this.indices[1] = value;
    this.notifyOnChange();
  }
  public get cIndex(): number {
    return this.indices[2];
  }
  public set cIndex(value: number) {
    this.indices[2] = value;
    this.notifyOnChange();
  }
}

/* Edges */
/** A set of two vertex positions. */
export type Edge = readonly [startPos: IReadonlyVector3, endPos: IReadonlyVector3];
/** A set of two vertex indices. */
export type EdgeIndices = readonly [aIndex: number, bIndex: number];

/* Joints */
/** A set of four joint indices, referencing a skeleton (read only). */
export interface IReadonlyJointIndices {
  clone(): JointIndices;
  get [0](): number;
  get [1](): number;
  get [2](): number;
  get [3](): number;
}
export type JointIndicesKey = 0 | 1 | 2 | 3;
/** A set of four joint indices, referencing a skeleton. */
export class JointIndices extends Observable implements IReadonlyJointIndices {
  private indices: Uint32Array;

  public constructor(_0: number, _1: number, _2: number, _3: number) {
    super();
    this.indices = new Uint32Array(4);
    this.indices[0] = _0;
    this.indices[1] = _1;
    this.indices[2] = _2;
    this.indices[3] = _3;
  }

  public clone(): JointIndices {
    return new JointIndices(this[0], this[1], this[2], this[3]);
  }

  public get [0](): number {
    return this.indices[0];
  }
  public set [0](value: number) {
    this.indices[0] = value;
    this.notifyOnChange();
  }
  public get [1](): number {
    return this.indices[1];
  }
  public set [1](value: number) {
    this.indices[1] = value;
    this.notifyOnChange();
  }
  public get [2](): number {
    return this.indices[2];
  }
  public set [2](value: number) {
    this.indices[2] = value;
    this.notifyOnChange();
  }
  public get [3](): number {
    return this.indices[3];
  }
  public set [3](value: number) {
    this.indices[3] = value;
    this.notifyOnChange();
  }
}

/** A set of four joint weights, paired with a corresponding {@linkcode JointIndices} (read only). */
export interface IReadonlyJointWeights {
  clone(): JointWeights;
  get [0](): number;
  get [1](): number;
  get [2](): number;
  get [3](): number;
}
export type JointWeightsKey = 0 | 1 | 2 | 3;
/** A set of four joint weights, paired with a corresponding {@linkcode JointIndices}. */
export class JointWeights extends Observable implements IReadonlyJointWeights {
  private _0: number;
  private _1: number;
  private _2: number;
  private _3: number;

  public constructor(_0: number, _1: number, _2: number, _3: number) {
    super();
    this._0 = _0;
    this._1 = _1;
    this._2 = _2;
    this._3 = _3;
  }

  public clone(): JointWeights {
    return new JointWeights(this[0], this[1], this[2], this[3]);
  }

  public get [0](): number {
    return this._0;
  }
  public set [0](value: number) {
    this._0 = value;
    this.notifyOnChange();
  }
  public get [1](): number {
    return this._1;
  }
  public set [1](value: number) {
    this._1 = value;
    this.notifyOnChange();
  }
  public get [2](): number {
    return this._2;
  }
  public set [2](value: number) {
    this._2 = value;
    this.notifyOnChange();
  }
  public get [3](): number {
    return this._3;
  }
  public set [3](value: number) {
    this._3 = value;
    this.notifyOnChange();
  }
}

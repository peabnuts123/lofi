import { Computed, PlainObservable, WritableComputed } from "./observable";
import { Quaternion, ReadOnlyQuaternion } from "./quaternion";
import { EulerVector3, Vector3, type Vector3Definition } from "./vector";

// I dub thee... "Eulernion"
// @TODO put an interface around this for control over exposed types / params
export class Rotation extends PlainObservable {
  private readonly _q: Quaternion;
  private readonly _qInverse: Computed<ReadOnlyQuaternion>;
  private readonly _euler: WritableComputed<EulerVector3>;

  public constructor() {
    super();
    this._q = Quaternion.identity();
    this._q.onChange(() => this.notifyOnChange());

    /** Temp value used when recomputing qInverse. */
    const qInverseTmp = Quaternion.identity();
    this._qInverse = new Computed(new ReadOnlyQuaternion(0, 0, 0, 1), {
      dependencies: [this.q],
      recompute: (value) => {
        ReadOnlyQuaternion.replace(value,
          qInverseTmp.setValue(this.q).invertSelf(),
        );
      },
    });

    this._euler = new WritableComputed(new EulerVector3(0, 0, 0), {
      dependencies: [this.q],
      recompute: (value) => {
        // Update Euler from Quaternion
        value.setValue(this.q.toEuler());
      },
      onSetValue: (value) => {
        // Update Quaternion from Euler
        this.q.setValue(
          Quaternion.fromEuler(value),
        );
      },
    });
  }

  public multiply(q: Quaternion): this {
    this.q.multiplySelf(q);
    return this;
  }

  public slerp(q: Quaternion, t: number): this {
    this.q.slerpSelf(q, t);
    return this;
  }

  public set(quaternion: Quaternion): void;
  public set(x: number, y: number, z: number): void;
  public set(eulerAngles: Partial<Vector3Definition>): void;
  public set(
    eulerAnglesOrQuaternionOrX: Partial<Vector3Definition> | Quaternion | number,
    maybeY?: number,
    maybeZ?: number,
  ): void {
    if (typeof eulerAnglesOrQuaternionOrX === 'number') {
      if (typeof maybeY === 'number' && typeof maybeZ === 'number') {
        // Args are x, y, z
        this.euler.setValue(
          eulerAnglesOrQuaternionOrX,
          maybeY,
          maybeZ,
        );
      } else {
        // Invalid args
        throw new Error(`Unrecognised arguments to 'set()'`);
      }
    } else if (eulerAnglesOrQuaternionOrX instanceof Quaternion) {
      // Args are quaternion
      this.q.setValue(eulerAnglesOrQuaternionOrX);
    } else {
      // Args are {x?, y?, z?}
      this.euler.setValue(
        eulerAnglesOrQuaternionOrX.x ?? this.euler.x,
        eulerAnglesOrQuaternionOrX.y ?? this.euler.y,
        eulerAnglesOrQuaternionOrX.z ?? this.euler.z,
      );
    }
  }

  /* Euler */
  public get euler(): Vector3 { return this._euler.value; }
  public set euler(value: Vector3) { this.euler.setValue(value); }
  public get x(): number { return this.euler.x; }
  public get y(): number { return this.euler.y; }
  public get z(): number { return this.euler.z; }
  public set x(value: number) { this.euler.x = value; }
  public set y(value: number) { this.euler.y = value; }
  public set z(value: number) { this.euler.z = value; }

  /* Quaternion */
  public get q(): Quaternion { return this._q; }
  public set q(value: Quaternion) { this._q.setValue(value); }
  public get qInverse(): Quaternion { return this._qInverse.value; }
}

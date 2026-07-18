import { Computed, Observable, WritableComputed } from "@lofi/core/util";
import { Quaternion, type IReadOnlyQuaternion } from "@lofi/core/math/Quaternion";
import { EulerVector3 } from "@lofi/core/math/EulerVector3";
import type { Vector3Like } from "@lofi/core/math/Vector3";

// I dub thee... "Eulernion"
export class Rotation extends Observable {
  private readonly _q: Quaternion;
  private readonly _qInverse: Computed<IReadOnlyQuaternion>;
  private readonly _euler: WritableComputed<EulerVector3>;

  public constructor() {
    super();
    this._q = Quaternion.identity();
    this._q.onChange(() => this.notifyOnChange());

    /** Temp value used when recomputing qInverse. */
    this._qInverse = new Computed<IReadOnlyQuaternion>(Quaternion.identity(), {
      dependencies: [this.q],
      recompute: (_self) => {
        const self = _self as Quaternion;
        self
          .setValue(this.q)
          .invertSelf();
      },
    });

    this._euler = new WritableComputed(new EulerVector3(0, 0, 0), {
      dependencies: [this.q],
      recompute: (value) => {
        // Update Euler from Quaternion
        value.setValue(this.q);
      },
      onSetValue: (value) => {
        // Update Quaternion from Euler
        this.q.fromEulerSelf(value);
      },
    });
  }

  public multiplySelf(q: Quaternion): this {
    this.q.multiplySelf(q);
    return this;
  }

  public slerpSelf(q: Quaternion, t: number): this {
    this.q.slerpSelf(q, t);
    return this;
  }

  public setValue(quaternion: Quaternion): void;
  public setValue(x: number, y: number, z: number): void;
  public setValue(eulerAngles: Partial<Vector3Like>): void;
  public setValue(
    eulerAnglesOrQuaternionOrX: Partial<Vector3Like> | Quaternion | number,
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
  public get euler(): EulerVector3 { return this._euler.value; }
  public set euler(value: Vector3Like) { this.euler.setValue(value); }
  public get x(): number { return this.euler.x; }
  public set x(value: number) { this.euler.x = value; }
  public get y(): number { return this.euler.y; }
  public set y(value: number) { this.euler.y = value; }
  public get z(): number { return this.euler.z; }
  public set z(value: number) { this.euler.z = value; }

  /* Quaternion */
  public get q(): Quaternion { return this._q; }
  public set q(value: Quaternion) { this._q.setValue(value); }
  public get qInverse(): IReadOnlyQuaternion { return this._qInverse.value; }
}

import { DirtyQuaternion, Quaternion, ReadOnlyQuaternion } from "./quaternion";
import { DirtyVector3, Vector3, type Vector3Definition } from "./vector";

export type RotationOnChangeCallback = () => void;

export interface RotationConstructorArgs {
  isDirty?: () => boolean;
  refreshValue?: () => void;
  onChange?: RotationOnChangeCallback;
}

// I dub thee... "Eulernion"
// @TODO put an interface around this for control over exposed types / params
export class Rotation {
  private _q: DirtyQuaternion;

  private qConjugateIsDirty: boolean = true;
  private _qConjugate: ReadOnlyQuaternion;

  private eulerIsDirty: boolean = true;
  private _euler: DirtyVector3;

  private isDirty: () => boolean;
  private refreshValue: () => void;
  private isOnChangeSuspended: boolean = false;
  private onChange: () => void;

  private debug_name: string;

  public constructor(debug_name: string, { onChange, isDirty, refreshValue }: RotationConstructorArgs) {
    // Constructor argument default values
    this.debug_name = debug_name;

    this.onChange = () => {
      if (!this.isOnChangeSuspended) {
        onChange?.();
      }
    };
    this.isDirty = isDirty ?? (() => false);
    this.refreshValue = refreshValue ?? (() => { });

    // Initialise internal state
    this._q = DirtyQuaternion.identityDirty(
      this.isDirty,
      this.refreshValue,
      () => {
        this.qConjugateIsDirty = true;
        // console.trace(`[${this.debug_name}] Setting Q, marking euler dirty`);
        this.eulerIsDirty = true;

        this.onChange();
      },
    );
    this._qConjugate = ReadOnlyQuaternion.from(Quaternion.identity());
    this._euler = new DirtyVector3(0, 0, 0,
      /* isDirty */() => this.eulerIsDirty,
      /* refreshValue */() => this.recomputeEuler(),
      /* onChange */() => {
        this.recomputeQuaternionFromEuler();
        this.onChange();
      },
    );

    // Compute initial values
    this.recomputeEuler();
    this.recomputeQConjugate();
  }

  private mutate<TResult>(notify: boolean, mutator: () => TResult): TResult {
    this.isOnChangeSuspended = true;
    const result = mutator();
    this.isOnChangeSuspended = false;
    if (notify) {
      this.onChange();
    }
    return result;
  }

  private recomputeEuler(): void {
    this._euler.setValue(this.q.toEuler(), false);
    this.eulerIsDirty = false;
  }
  private recomputeQuaternionFromEuler(): void {
    if (this.eulerIsDirty) {
      throw new Error(`Cannot recompute quaternion from dirty euler value`);
    }
    this._q.setValue(
      Quaternion.fromEuler(this.euler),
      false,
    );
    this.qConjugateIsDirty = true;
  }
  private recomputeQConjugate(): void {
    this._qConjugate = ReadOnlyQuaternion.from(this.q.conjugate());
    this.qConjugateIsDirty = false;
  }

  public multiply(q: Quaternion, notify: boolean = true): this {
    this.mutate(notify, () =>
      this.q.multiplySelf(q),
    );
    return this;
  }

  public slerp(q: Quaternion, t: number, notify: boolean = true): this {
    this.mutate(notify, () =>
      this.q.slerpSelf(q, t),
    );
    return this;
  }

  public set(quaternion: Quaternion, notify?: boolean): void;
  public set(x: number, y: number, z: number, notify?: boolean): void;
  public set(eulerAngles: Partial<Vector3Definition>, notify?: boolean): void;
  public set(
    eulerAnglesOrQuaternionOrX: Partial<Vector3Definition> | Quaternion | number,
    yOrNotify: number | boolean = true,
    maybeZ?: number,
    maybeNotify: boolean = true,
  ): void {
    if (typeof eulerAnglesOrQuaternionOrX === 'number') {
      if (typeof yOrNotify === 'number' && typeof maybeZ === 'number' && typeof maybeNotify === 'boolean') {
        // Args are x, y, z
        return this.mutate(maybeNotify, () =>
          this._euler.setValue(
            eulerAnglesOrQuaternionOrX,
            yOrNotify,
            maybeZ,
          ),
        );
      } else {
        // Invalid args
        throw new Error(`Unrecognised arguments to 'set()'`);
      }
    } else if (eulerAnglesOrQuaternionOrX instanceof Quaternion && typeof yOrNotify === 'boolean') {
      // Args are quaternion
      return this.mutate(yOrNotify, () =>
        this.q.setValue(eulerAnglesOrQuaternionOrX),
      );
    } else if (!(eulerAnglesOrQuaternionOrX instanceof Quaternion) && typeof yOrNotify === 'boolean') {
      // Args are {x?, y?, z?}
      // @NOTE recompute euler as we are going to do a partial update
      if (this.eulerIsDirty) {
        this.recomputeEuler();
      }

      return this.mutate(yOrNotify, () =>
        this._euler.setValue(
          eulerAnglesOrQuaternionOrX.x ?? this.euler.x,
          eulerAnglesOrQuaternionOrX.y ?? this.euler.y,
          eulerAnglesOrQuaternionOrX.z ?? this.euler.z,
        ),
      );
    } else {
      // Invalid args
      throw new Error(`Unrecognised arguments to 'set()'`);
    }
  }

  /* @NOTE values recalculated internally if euler is dirty */
  public get x(): number { return this._euler.x; }
  public get y(): number { return this._euler.y; }
  public get z(): number { return this._euler.z; }

  public set x(value: number) {
    if (this.eulerIsDirty) {
      this.recomputeEuler();
    }
    this._euler.x = value;
  }
  public set y(value: number) {
    if (this.eulerIsDirty) {
      // console.trace(`[${this.debug_name}] Setting Y but euler is dirty`);
      this.recomputeEuler();
    }
    this._euler.y = value;
  }
  public set z(value: number) {
    if (this.eulerIsDirty) {
      this.recomputeEuler();
    }
    this._euler.z = value;
  }

  public get euler(): Vector3 {
    if (this.eulerIsDirty) {
      this.recomputeEuler();
    }
    return this._euler;
  }
  public get q(): Quaternion { return this._q; }
  public get qConjugate(): Quaternion {
    if (this.qConjugateIsDirty) {
      this.recomputeQConjugate();
    }
    return this._qConjugate;
  }
}

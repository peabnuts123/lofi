export type OnChangeCallback = () => void;

export type StopObservingFn = () => void;
export type IObservable = {
  onChange(callback: OnChangeCallback): StopObservingFn;
};
// @TODO REMOVE
// export function isObservable(value: unknown): value is IObservable {
//   return typeof (value) === 'object' &&
//     value !== null &&
//     'onChange' in value &&
//     typeof (value.onChange) === 'function';
// }



/* @TODO REMOVE ALL THIS IF NOTHING IS USING IT */
// // @NOTE We need the complex inferred return type on this function
// // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
// export function Observable<TBase extends ClassReference<any>>(Base: TBase) {
//   abstract class ObservableMixin extends Base {
//     private onChangeHooks: OnChangeCallback[] = [];

//     public onChange(callback: OnChangeCallback): RemoveOnChangeCallbackFn {
//       this.onChangeHooks.push(callback);

//       // Stop listening callback
//       return () => {
//         const hookIndex = this.onChangeHooks.indexOf(callback);
//         if (hookIndex !== -1) {
//           this.onChangeHooks.splice(hookIndex, 1);
//         }
//       };
//     }

//     protected notifyOnChange(): void {
//       // @TODO try/catch
//       for (const hook of this.onChangeHooks) {
//         hook();
//       }
//     }
//   }
//   return ObservableMixin;
// }

// @NOTE The same implementation as `ObservableMixin`
export abstract class PlainObservable implements IObservable {
  private onChangeHooks: OnChangeCallback[] = [];
  private isNotifyDisabled: boolean = false;

  public onChange(callback: OnChangeCallback): StopObservingFn {
    this.onChangeHooks.push(callback);

    // Stop listening callback
    return () => {
      const hookIndex = this.onChangeHooks.indexOf(callback);
      if (hookIndex !== -1) {
        this.onChangeHooks.splice(hookIndex, 1);
      }
    };
  }

  protected mutate(mutator: () => void): void {
    this.isNotifyDisabled = true;
    try {
      mutator();
      this.isNotifyDisabled = false;
      this.notifyOnChange();
    } finally {
      this.isNotifyDisabled = false;
    }
  }

  protected notifyOnChange(): void {
    if (this.isNotifyDisabled) return;

    for (const hook of this.onChangeHooks) {
      try {
        hook();
      } catch (e) {
        console.error(`Error while calling onChange hook: `, e);
      }
    }
  }
}

export interface ComputedArgs<T> {
  debug_name?: string; // @TODO @DEBUG REMOVE
  dependencies: IObservable[],
  recompute: (tmpState: T) => void;
}

export interface ComputedDependency {
  observable: IObservable,
  stopObservingFn: StopObservingFn;
}

export class Computed<T> extends PlainObservable {
  protected isDirty: boolean;
  protected readonly _value: T;
  private readonly recompute: (currentValue: T) => void;

  private dependencies: ComputedDependency[];
  protected ignoreDependencies: boolean = false;

  protected debug_name: string;

  public constructor(initialValue: T, { dependencies, recompute, debug_name }: ComputedArgs<T>) {
    super();
    this.isDirty = true;
    this.debug_name = debug_name ?? `${Math.trunc(Math.random() * 9_000 + 1000)}`;
    this._value = initialValue;
    this.recompute = recompute;

    this.dependencies = [];
    for (const dependency of dependencies) {
      this.addDependency(dependency);
    }
  }

  public addDependency(...dependencies: IObservable[]): void {
    for (const dependency of dependencies) {
      if (this.dependencies.some((existingDependency) => existingDependency.observable === dependency)) {
        /* @NOTE No-op. `dependency` is already registered. */
        return;
      }
      this.dependencies.push({
        observable: dependency,
        stopObservingFn: dependency.onChange(() => this.onDependencyChange()),
      });
    }
    this.isDirty = true;
  }

  public removeDependency(...dependencies: IObservable[]): void {
    for (const dependency of dependencies) {
      const dependencyEntryIndex = this.dependencies.findIndex((existingDependency) => existingDependency.observable === dependency);
      if (dependencyEntryIndex !== -1) {
        // Remove listener
        this.dependencies[dependencyEntryIndex].stopObservingFn();
        // Remove from set of dependencies
        this.dependencies.splice(dependencyEntryIndex, 1);
      }
    }
    this.isDirty = true;
  }

  public forceRecompute(): void {
    this.recompute(this._value);
    this.isDirty = false;
  }

  private onDependencyChange(): void {
    if (this.ignoreDependencies) return;

    this.isDirty = true;
    this.notifyOnChange();
  }

  public get value(): T {
    if (this.isDirty) {
      this.recompute(this._value);
      this.isDirty = false;
    }
    return this._value;
  }
}

export interface WritableComputedArgs<T extends IObservable> extends ComputedArgs<T> {
  onSetValue: (value: T) => void;
}

export class WritableComputed<T extends IObservable> extends Computed<T> {
  private ignoreInternalChanges: boolean = false;
  private onSetValue: (value: T) => void;
  public constructor(initialValue: T, { dependencies, recompute, onSetValue, debug_name }: WritableComputedArgs<T>) {
    super(initialValue, {
      dependencies,
      recompute: (value) => {
        this.ignoreInternalChanges = true;
        try {
          recompute(value);
        } finally {
          this.ignoreInternalChanges = false;
        }
      },
      debug_name,
    });

    this.onSetValue = onSetValue;
    initialValue.onChange(() => {
      if (this.ignoreInternalChanges) return;

      this.ignoreDependencies = true;
      try {
        onSetValue(this._value);
      } finally {
        this.notifyOnChange();
        this.isDirty = false;
        this.ignoreDependencies = false;
      }
    });
  }

  /**
   * Force this WritableComputed to write its current value back to itself
   * as if the internal value had changed.
   * Calls `onSetValue()` but does not notify onChange.
   */
  public forceWriteBack(): void {
    this.ignoreDependencies = true;
    try {
      this.onSetValue(this._value);
    } finally {
      this.isDirty = false;
      this.ignoreDependencies = false;
    }
  }
}

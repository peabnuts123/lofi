export type OnChangeCallback = () => void;
export type DestructorCallback = () => void;

export type StopObservingFn = () => void;
export type IObservable = {
  onChange(callback: OnChangeCallback): StopObservingFn;
};

export abstract class Observable implements IObservable {
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

export class Computed<T> extends Observable {
  protected isDirty: boolean;
  protected readonly _value: T;
  private readonly recompute: (currentValue: T) => void;

  private readonly dependencies: ComputedDependency[];
  protected ignoreDependencies: boolean = false;

  protected debug_name: string;

  /** List of callbacks that are fired when this instance is garbage collected. */
  protected readonly destructorCallbacks: DestructorCallback[] = [];
  private static readonly destructor = new FinalizationRegistry<DestructorCallback[]>((destructorCallbacks) => {
    for (const destructorCallback of destructorCallbacks) {
      try {
        destructorCallback();
      } catch (e) {
        console.error(`[${Computed.name}] (destructor) Error while calling destructor callback:`, e);
      }
    }
  });

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

    // Register instance with finalizer to unsubscribe from dependencies when garbage collected
    Computed.destructor.register(this, this.destructorCallbacks);
  }

  public addDependency(...dependencies: IObservable[]): void {
    const initialNumDependencies = this.dependencies.length;

    for (const dependency of dependencies) {
      if (this.dependencies.some((existingDependency) => existingDependency.observable === dependency)) {
        /* @NOTE No-op. `dependency` is already registered. */
      } else {
        // Use WeakRef to avoid holding a strong reference to this instance
        // which would prevent it from being garbage collected
        const weakThis = new WeakRef(this);
        const stopObservingFn = dependency.onChange(() => {
          const self = weakThis.deref();
          if (self) {
            self.onDependencyChange();
          }
        });

        this.dependencies.push({
          observable: dependency,
          stopObservingFn,
        });

        // Register stopObservingFn as destructor callback
        // to automatically stop listening when this object is garbage collected
        this.destructorCallbacks.push(stopObservingFn);
      }
    }

    // Mark computed as dirty if additional dependencies have been added
    // No need to notify if computed is already dirty
    if (this.dependencies.length !== initialNumDependencies && this.isDirty === false) {
      this.isDirty = true;
      this.notifyOnChange();
    }
  }

  public removeAllDependencies(): void {
    for (const dependency of this.dependencies) {
      dependency.stopObservingFn();
    }
    this.dependencies.length = 0;
    this.destructorCallbacks.length = 0;

    // No need to notify if computed is already dirty
    if (this.isDirty === false) {
      this.isDirty = true;
      this.notifyOnChange();
    }
  }

  public removeDependency(...dependencies: IObservable[]): void {
    const initialNumDependencies = this.dependencies.length;

    for (const dependency of dependencies) {
      const dependencyEntryIndex = this.dependencies.findIndex((existingDependency) => existingDependency.observable === dependency);
      if (dependencyEntryIndex !== -1) {
        // Remove listener
        const { stopObservingFn } = this.dependencies[dependencyEntryIndex];
        stopObservingFn();
        // Remove from set of dependencies
        this.dependencies.splice(dependencyEntryIndex, 1);
        // Remove from cleanup functions
        const destructorCallbackIndex = this.destructorCallbacks.indexOf(stopObservingFn);
        if (destructorCallbackIndex !== -1) {
          this.destructorCallbacks.splice(destructorCallbackIndex, 1);
        }
      }
    }
    // Mark computed as dirty if dependencies have been removed.
    // @NOTE You might think this un-necessary, but a counter example is something
    // like computed Transform properties that have different logic between
    // having a parent vs. having no parent. The recompute logic might
    // be different given fewer dependencies, thus we need to invalidate it.
    if (this.dependencies.length !== initialNumDependencies && this.isDirty === false) {
      // No need to notify if computed is already dirty
      this.isDirty = true;
      this.notifyOnChange();
    }
  }

  public forceRecompute(): void {
    this.recompute(this._value);
    this.isDirty = false;
  }

  private onDependencyChange(): void {
    // No need to notify if computed is already dirty
    if (this.ignoreDependencies || this.isDirty) return;
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
  private onSetValue: (value: T) => void;
  public constructor(initialValue: T, { dependencies, recompute, onSetValue, debug_name }: WritableComputedArgs<T>) {
    // @NOTE We have to store this in a closure, otherwise
    // it would require a reference to `this` which would prevent it from
    // being garbage collected.
    let ignoreInternalChanges = false;

    super(initialValue, {
      dependencies,
      recompute: (value) => {
        ignoreInternalChanges = true;
        try {
          recompute(value);
        } finally {
          ignoreInternalChanges = false;
        }
      },
      debug_name,
    });

    this.onSetValue = onSetValue;

    // Use WeakRef to avoid holding a strong reference to this instance
    // which would prevent it from being garbage collected
    const weakThis = new WeakRef(this);
    const stopObservingFn = initialValue.onChange(() => {
      const self = weakThis.deref();
      if (self === undefined || ignoreInternalChanges) return;

      self.ignoreDependencies = true;
      try {
        onSetValue(self._value);
      } finally {
        self.notifyOnChange();
        self.isDirty = false;
        self.ignoreDependencies = false;
      }
    });

    // Register stopObservingFn as destructor callback
    // to automatically stop listening when this object is garbage collected
    this.destructorCallbacks.push(stopObservingFn);
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

import { Computed, type ComputedArgs } from "./Computed";
import type { IObservable } from "./Observable";


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
      if (ignoreInternalChanges) return;
      const self = weakThis.deref();
      if (self === undefined) return;

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

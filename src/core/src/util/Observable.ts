export type OnChangeCallback = () => void;
export type StopObservingFn = () => void;
export type IObservable = {
  onChange(callback: OnChangeCallback): StopObservingFn;
};

export abstract class Observable implements IObservable {
  private onChangeHooks: OnChangeCallback[] = [];

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

  protected notifyOnChange(): void {
    if (this.onChangeHooks.length === 0) return;
    for (const hook of this.onChangeHooks) {
      try {
        hook();
      } catch (e) {
        console.error(`Error while calling onChange hook: `, e);
      }
    }
  }
}

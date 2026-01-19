export class Lazy<T> {
  private readonly getter: () => T;
  private _value: T | undefined = undefined;

  public constructor(getter: () => T) {
    this.getter = getter;
  }

  public get value(): T {
    if (this._value === undefined) {
      this._value = this.getter();
    }
    return this._value;
  }
}

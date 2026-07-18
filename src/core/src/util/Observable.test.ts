import { describe, test, expect } from 'vitest';
import { Observable } from './Observable';

/* @TODO Test backlog
  - An observable value can be garbage collected even if something depends on it
 */

describe("Observable", () => {
  test("`onChange()` callbacks are fired when `notifyOnChange() is called", () => {
    // Setup
    const observable = new Widget(1, 2);
    const timesOnChangeCalled = {
      a: 0,
      b: 0,
      c: 0,
    };
    observable.onChange(() => {
      timesOnChangeCalled.a++;
    });
    observable.onChange(() => {
      timesOnChangeCalled.b++;
    });
    observable.onChange(() => {
      timesOnChangeCalled.c++;
    });

    // Test
    observable['notifyOnChange']();
    const timesOnChangeCalledAAfterFirstCall = timesOnChangeCalled.a;
    const timesOnChangeCalledBAfterFirstCall = timesOnChangeCalled.b;
    const timesOnChangeCalledCAfterFirstCall = timesOnChangeCalled.c;
    observable['notifyOnChange']();
    const timesOnChangeCalledAAfterSecondCall = timesOnChangeCalled.a;
    const timesOnChangeCalledBAfterSecondCall = timesOnChangeCalled.b;
    const timesOnChangeCalledCAfterSecondCall = timesOnChangeCalled.c;


    // Assert
    expect(timesOnChangeCalledAAfterFirstCall).toBe(1);
    expect(timesOnChangeCalledBAfterFirstCall).toBe(1);
    expect(timesOnChangeCalledCAfterFirstCall).toBe(1);
    expect(timesOnChangeCalledAAfterSecondCall).toBe(2);
    expect(timesOnChangeCalledBAfterSecondCall).toBe(2);
    expect(timesOnChangeCalledCAfterSecondCall).toBe(2);
  });
  test("`onChange()` callback is not fired when stopListeningFn is called", () => {
    // Setup
    const observable = new Widget(1, 2);
    const timesOnChangeCalled = {
      a: 0,
      b: 0,
      c: 0,
    };
    const stopListeningA = observable.onChange(() => {
      timesOnChangeCalled.a++;
    });
    const stopListeningB = observable.onChange(() => {
      timesOnChangeCalled.b++;
    });
    const stopListeningC = observable.onChange(() => {
      timesOnChangeCalled.c++;
    });

    observable['notifyOnChange']();
    const timesOnChangeCalledAAfterFirstCall = timesOnChangeCalled.a;
    const timesOnChangeCalledBAfterFirstCall = timesOnChangeCalled.b;
    const timesOnChangeCalledCAfterFirstCall = timesOnChangeCalled.c;

    // Test
    stopListeningA();
    stopListeningB();
    stopListeningC();

    observable['notifyOnChange']();
    const timesOnChangeCalledAAfterSecondCall = timesOnChangeCalled.a;
    const timesOnChangeCalledBAfterSecondCall = timesOnChangeCalled.b;
    const timesOnChangeCalledCAfterSecondCall = timesOnChangeCalled.c;


    // Assert
    expect(timesOnChangeCalledAAfterFirstCall).toBe(1);
    expect(timesOnChangeCalledBAfterFirstCall).toBe(1);
    expect(timesOnChangeCalledCAfterFirstCall).toBe(1);
    expect(timesOnChangeCalledAAfterSecondCall).toBe(1);
    expect(timesOnChangeCalledBAfterSecondCall).toBe(1);
    expect(timesOnChangeCalledCAfterSecondCall).toBe(1);
  });
});


export class Widget extends Observable {
  protected _a: number;
  protected _b: number;
  public constructor(a: number, b: number) {
    super();
    this._a = a;
    this._b = b;
  }

  public setValue(a: number, b: number): this {
    this._a = a;
    this._b = b;
    this.notifyOnChange();
    return this;
  }

  public clone(): Widget {
    return new Widget(
      this.a,
      this.b,
    );
  }

  public override toString(): string {
    return `Widget(${this.a},${this.b})`;
  }

  public get a(): number { return this._a; }
  public set a(value: number) {
    this._a = value;
    this.notifyOnChange();
  }
  public get b(): number { return this._b; }
  public set b(value: number) {
    this._b = value;
    this.notifyOnChange();
  }
}

export function expectWidgetsToBeEqual(actual: Widget, expected: Widget): void {
  expect(actual.a, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.a, 8);
  expect(actual.b, `Expected '${actual}' to equal ${expected}`).toBeCloseTo(expected.b, 8);
}

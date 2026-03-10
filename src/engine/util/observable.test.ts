import { describe, test, expect } from 'vitest';
import { Computed, PlainObservable, WritableComputed } from './observable';

describe("observable", () => {
  test("Lazily recomputes the correct value", () => {
    // Setup
    const parentPosition = new Widget(1, 1);
    const position = new Widget(2, 3);
    const absolutePosition = new Computed(new Widget(0, 0), {
      dependencies: [position, parentPosition],
      recompute: (value) => {
        return value.setValue(parentPosition.a + position.a, parentPosition.b + position.b);
      },
    });

    /* Spy on internal `recomputed` callback */
    let timesRecomputed = 0;
    spyOnRecompute(absolutePosition, () => {
      timesRecomputed++;
    });

    /* Initial state */
    const initialTimesRecomputed = timesRecomputed;
    const initialValue = absolutePosition.value.clone();
    const timesRecomputedAfterOneRead = timesRecomputed;

    // Test
    position.setValue(4, 4);
    const timesRecomputedAfterSetting = timesRecomputed;
    const internalUpdatedValue = getInternalCachedValue(absolutePosition).clone();
    const timesRecomputedAfterInternalRead = timesRecomputed;
    const updatedValue = absolutePosition.value.clone();
    const timesRecomputedAfterUpdatedRead = timesRecomputed;

    // Assert
    expect(initialValue).toEqual(new Widget(3, 4));
    expect(internalUpdatedValue).toEqual(new Widget(3, 4));
    expect(updatedValue).toEqual(new Widget(5, 5));
    expect(initialTimesRecomputed).toBe(0);
    expect(timesRecomputedAfterOneRead).toBe(1);
    expect(timesRecomputedAfterSetting).toBe(1);
    expect(timesRecomputedAfterInternalRead).toBe(1);
    expect(timesRecomputedAfterUpdatedRead).toBe(2);
  });

  test("Transitive dependencies cause correct recomputation", () => {
    // Setup
    const source = new Widget(1, 2);
    const sourcePlusOne = new Computed(new Widget(0, 0), {
      debug_name: 'sourcePlusOne',
      dependencies: [source],
      recompute(value) {
        return value.setValue(source.a + 1, source.b + 1);
      },
    });
    const sourcePlusOnePlusTwo = new Computed(new Widget(0, 0), {
      debug_name: 'sourcePlusOnePlusTwo',
      dependencies: [sourcePlusOne],
      recompute(value) {
        return value.setValue(sourcePlusOne.value.a + 2, sourcePlusOne.value.b + 2);
      },
    });

    /* Spy on internal `recomputed` callback */
    let timesRecomputed = 0;
    spyOnRecompute(sourcePlusOnePlusTwo, () => {
      timesRecomputed++;
    });

    const initialValue = sourcePlusOnePlusTwo.value.clone();
    const initialTimesRecomputed = timesRecomputed;

    // Test
    source.setValue(11, 12);
    const timesRecomputedAfterSetValue = timesRecomputed;
    const updatedValue = sourcePlusOnePlusTwo.value.clone();
    const timesRecomputedAfterUpdatedRead = timesRecomputed;

    // Assert
    expect(initialValue).toEqual(new Widget(4, 5));
    expect(updatedValue).toEqual(new Widget(14, 15));
    expect(initialTimesRecomputed).toBe(1);
    expect(timesRecomputedAfterSetValue).toBe(1);
    expect(timesRecomputedAfterUpdatedRead).toBe(2);
  });

  test("Mutating a computed value is correct and efficient", () => {
    // Setup
    const parentPosition = new Widget(1, 1);
    const position = new Widget(2, 3);
    const absolutePosition = new WritableComputed(new Widget(0, 0), {
      debug_name: `absolutePosition`,
      dependencies: [position, parentPosition],
      recompute: (value) => {
        value.setValue(parentPosition.a + position.a, parentPosition.b + position.b);
      },
      onSetValue(value) {
        position.setValue(
          value.a - parentPosition.a,
          value.b - parentPosition.b,
        );
      },
    });

    /* Spy on internal `recomputed` callback */
    let timesRecomputed = 0;
    spyOnRecompute(absolutePosition, () => {
      timesRecomputed++;
    });

    const initialLocalValue = position.clone();
    const initialAbsoluteValue = absolutePosition.value.clone();
    const initialTimesRecomputed = timesRecomputed;

    // Test
    absolutePosition.value.setValue(6, 5);
    const updatedLocalValue = position.clone();
    const updatedAbsoluteValue = absolutePosition.value.clone();
    const timesRecomputedAfterSetValue = timesRecomputed;

    // Assert
    expect(initialLocalValue).toEqual(new Widget(2, 3));
    expect(initialAbsoluteValue).toEqual(new Widget(3, 4));
    expect(initialTimesRecomputed).toBe(1);
    expect(updatedLocalValue).toEqual(new Widget(5, 4));
    expect(updatedAbsoluteValue).toEqual(new Widget(6, 5));
    expect(timesRecomputedAfterSetValue).toBe(1);
  });

  test("Mutating the middle link in a chain of dependencies has correct side effects", () => {
    // Setup
    const source = new Widget(1, 2);
    const sourcePlusOne = new WritableComputed(new Widget(0, 0), {
      debug_name: 'sourcePlusOne',
      dependencies: [source],
      recompute(value) {
        value.setValue(source.a + 1, source.b + 1);
      },
      onSetValue(value) {
        source.setValue(value.a - 1, value.b - 1);
      },
    });
    const sourcePlusOnePlusTwo = new Computed(new Widget(0, 0), {
      debug_name: 'sourcePlusOnePlusTwo',
      dependencies: [sourcePlusOne],
      recompute(value) {
        return value.setValue(sourcePlusOne.value.a + 2, sourcePlusOne.value.b + 2);
      },
    });

    /* Spy on internal `recomputed` callback */
    let timesSourcePlusOneRecomputed = 0;
    let timesSourcePlusOnePlusTwoRecomputed = 0;
    spyOnRecompute(sourcePlusOne, () => timesSourcePlusOneRecomputed++);
    spyOnRecompute(sourcePlusOnePlusTwo, () => timesSourcePlusOnePlusTwoRecomputed++);

    const initialSourceValue = source.clone();
    const initialSourcePlusOneValue = sourcePlusOne.value.clone();
    const initialSourcePlusOnePlusTwoValue = sourcePlusOnePlusTwo.value.clone();

    const initialTimesSourcePlusOneRecomputed = timesSourcePlusOneRecomputed;
    const initialTimesSourcePlusOnePlusTwoRecomputed = timesSourcePlusOnePlusTwoRecomputed;

    // Test
    sourcePlusOne.value.setValue(6, 7);

    const timesSourcePlusOneRecomputedAfterSet = timesSourcePlusOneRecomputed;
    const timesSourcePlusOnePlusTwoRecomputedAfterSet = timesSourcePlusOnePlusTwoRecomputed;

    const updatedSourceValue = source.clone();
    const updatedSourcePlusOneValue = sourcePlusOne.value.clone();
    const updatedSourcePlusOnePlusTwoValue = sourcePlusOnePlusTwo.value.clone();

    const timesSourcePlusOneRecomputedAfterRead = timesSourcePlusOneRecomputed;
    const timesSourcePlusOnePlusTwoRecomputedAfterRead = timesSourcePlusOnePlusTwoRecomputed;

    // Assert
    expect(initialSourceValue).toEqual(new Widget(1, 2));
    expect(initialSourcePlusOneValue).toEqual(new Widget(2, 3));
    expect(initialSourcePlusOnePlusTwoValue).toEqual(new Widget(4, 5));
    expect(updatedSourceValue).toEqual(new Widget(5, 6));
    expect(updatedSourcePlusOneValue).toEqual(new Widget(6, 7));
    expect(updatedSourcePlusOnePlusTwoValue).toEqual(new Widget(8, 9));

    expect(initialTimesSourcePlusOneRecomputed).toBe(1);
    expect(initialTimesSourcePlusOnePlusTwoRecomputed).toBe(1);
    expect(timesSourcePlusOneRecomputedAfterSet).toBe(1);
    expect(timesSourcePlusOnePlusTwoRecomputedAfterSet).toBe(1);

    expect(timesSourcePlusOneRecomputedAfterRead).toBe(1);
    expect(timesSourcePlusOnePlusTwoRecomputedAfterRead).toBe(2);
  });

  test("Sibling computed is updated when computed updates common parent", () => {
    // Setup
    const source = new Widget(1, 2);
    const sourcePlusOne = new WritableComputed(new Widget(0, 0), {
      debug_name: 'sourcePlusOne',
      dependencies: [source],
      recompute(value) {
        value.setValue(source.a + 1, source.b + 1);
      },
      onSetValue(value) {
        source.setValue(value.a - 1, value.b - 1);
      },
    });
    const sourcePlusTwo = new Computed(new Widget(0, 0), {
      debug_name: 'sourcePlusTwo',
      dependencies: [source],
      recompute(value) {
        return value.setValue(source.a + 2, source.b + 2);
      },
    });

    const initialSourceValue = source.clone();
    const initialSourcePlusOneValue = sourcePlusOne.value.clone();
    const initialSourcePlusTwoValue = sourcePlusTwo.value.clone();

    // Test
    sourcePlusOne.value.setValue(5,4);

    const updatedSourceValue = source.clone();
    const updatedSourcePlusOneValue = sourcePlusOne.value.clone();
    const updatedSourcePlusTwoValue = sourcePlusTwo.value.clone();

    // Assert
    expect(initialSourceValue).toEqual(new Widget(1,2));
    expect(initialSourcePlusOneValue).toEqual(new Widget(2,3));
    expect(initialSourcePlusTwoValue).toEqual(new Widget(3,4));
    expect(updatedSourceValue).toEqual(new Widget(4, 3));
    expect(updatedSourcePlusOneValue).toEqual(new Widget(5, 4));
    expect(updatedSourcePlusTwoValue).toEqual(new Widget(6, 5));
  });
});

function spyOnRecompute<T>(computed: Computed<T>, callback: () => void): void {
  const PropertyName = `recompute`;
  const spiedComputed = (computed as unknown as { [PropertyName]: (value: T) => void });
  const internalRecompute = spiedComputed[PropertyName];
  spiedComputed[PropertyName] = (tmpState) => {
    callback();
    internalRecompute(tmpState);
  };
}
function getInternalCachedValue<T>(computed: Computed<T>): T {
  const PropertyName = `_value`;
  return (computed as unknown as { [PropertyName]: T })[PropertyName];
}

class Widget extends PlainObservable {
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

import { describe, test, expect } from 'vitest';
import { forceGCAndWaitForCondition } from '@test/util/gc';
import { expectWidgetsToBeEqual, Widget } from './Observable.test';
import { Computed } from './Computed';
import { WritableComputed } from './WritableComputed';
import { spyOnRecompute } from './Computed.test';


describe("WritableComputed", () => {
  test("Mutating the internal value calls `onSetValue()`, notifies listeners of change, marks not dirty", () => {
    // Setup
    const observable = new Widget(1, 2);
    let timesRecomputeCalled = 0;
    let timesOnSetValueCalled = 0;
    const internalValue = new Widget(0, 0);
    const computedPlusOne = new WritableComputed(internalValue, {
      dependencies: [observable],
      recompute: (value) => {
        timesRecomputeCalled++;
        value.setValue(
          observable.a + 1,
          observable.b + 1,
        );
      },
      onSetValue: (value) => {
        timesOnSetValueCalled++;
        observable.setValue(value.a - 1, value.b - 1);
      },
    });
    let timesOnChangeCalled = 0;
    computedPlusOne.onChange(() => {
      timesOnChangeCalled++;
    });

    const initialTimesRecomputeCalled = timesRecomputeCalled;
    const initialTimesOnSetValueCalled = timesOnSetValueCalled;
    const initialTimesOnChangeCalled = timesOnChangeCalled;
    const initialIsDirty = computedPlusOne['isDirty'];

    // Test
    internalValue.setValue(6, 5);

    const updatedTimesRecomputeCalled = timesRecomputeCalled;
    const updatedTimesOnSetValueCalled = timesOnSetValueCalled;
    const updatedTimesOnChangeCalled = timesOnChangeCalled;
    const updatedIsDirty = computedPlusOne['isDirty'];

    // Assert
    expect(initialTimesRecomputeCalled).toBe(0);
    expect(initialTimesOnSetValueCalled).toBe(0);
    expect(initialTimesOnChangeCalled).toBe(0);
    expect(initialIsDirty).toBe(true);

    expect(updatedTimesRecomputeCalled).toBe(0);
    expect(updatedTimesOnSetValueCalled).toBe(1);
    expect(updatedTimesOnChangeCalled).toBe(1);
    expect(updatedIsDirty).toBe(false);
  });
  test("Mutating the internal value inside `recompute()` does not call `onSetValue()`", () => {
    // Setup
    const observable = new Widget(1, 2);
    let timesRecomputeCalled = 0;
    let timesOnSetValueCalled = 0;
    const internalValue = new Widget(0, 0);
    const computedPlusOne = new WritableComputed(internalValue, {
      dependencies: [observable],
      recompute: (value) => {
        timesRecomputeCalled++;
        value.setValue(
          observable.a + 1,
          observable.b + 1,
        );
      },
      onSetValue: (value) => {
        timesOnSetValueCalled++;
        observable.setValue(value.a - 1, value.b - 1);
      },
    });
    let timesOnChangeCalled = 0;
    computedPlusOne.onChange(() => {
      timesOnChangeCalled++;
    });

    const initialTimesRecomputeCalled = timesRecomputeCalled;
    const initialTimesOnSetValueCalled = timesOnSetValueCalled;
    const initialTimesOnChangeCalled = timesOnChangeCalled;
    const initialIsDirty = computedPlusOne['isDirty'];

    // Test
    observable.setValue(2, 3);
    computedPlusOne.forceRecompute();

    const updatedTimesRecomputeCalled = timesRecomputeCalled;
    const updatedTimesOnSetValueCalled = timesOnSetValueCalled;
    const updatedTimesOnChangeCalled = timesOnChangeCalled;
    const updatedIsDirty = computedPlusOne['isDirty'];

    // Assert
    expect(initialTimesRecomputeCalled).toBe(0);
    expect(initialTimesOnSetValueCalled).toBe(0);
    expect(initialTimesOnChangeCalled).toBe(0);
    expect(initialIsDirty).toBe(true);

    expect(updatedTimesRecomputeCalled).toBe(1);
    expect(updatedTimesOnSetValueCalled).toBe(0);
    expect(updatedTimesOnChangeCalled).toBe(0);
    expect(updatedIsDirty).toBe(false);
  });
  test("Mutating dependency inside `onSetValue()` does not trigger `recompute()", () => {
    // Setup
    const observable = new Widget(1, 2);
    let timesRecomputeCalled = 0;
    let timesOnSetValueCalled = 0;
    const internalValue = new Widget(0, 0);
    const computedPlusOne = new WritableComputed(internalValue, {
      dependencies: [observable],
      recompute: (value) => {
        timesRecomputeCalled++;
        value.setValue(
          observable.a + 1,
          observable.b + 1,
        );
      },
      onSetValue: (value) => {
        timesOnSetValueCalled++;
        observable.setValue(value.a - 1, value.b - 1);
      },
    });

    const initialTimesRecomputeCalled = timesRecomputeCalled;
    const initialTimesOnSetValueCalled = timesOnSetValueCalled;
    const initialIsDirty = computedPlusOne['isDirty'];

    // Test
    internalValue.setValue(6, 5);

    const updatedTimesRecomputeCalled = timesRecomputeCalled;
    const updatedTimesOnSetValueCalled = timesOnSetValueCalled;
    const updatedIsDirty = computedPlusOne['isDirty'];

    // Assert
    expect(initialTimesOnSetValueCalled).toBe(0);
    expect(initialTimesRecomputeCalled).toBe(0);
    expect(updatedTimesOnSetValueCalled).toBe(1);
    expect(updatedTimesRecomputeCalled).toBe(0);
    expect(initialIsDirty).toBe(true); // Kind of irrelevant, shrug
    expect(updatedIsDirty).toBe(false); // Kind of irrelevant, shrug
  });
  test("Calling `forceWriteBack()` calls `onSetValue()` with the current value, marks not dirty", () => {
    // Setup
    const observable = new Widget(1, 2);
    let timesRecomputeCalled = 0;
    let timesOnSetValueCalled = 0;
    const computedPlusOne = new WritableComputed(new Widget(6, 5), { // @NOTE a strange initial value
      dependencies: [observable],
      recompute: (value) => {
        timesRecomputeCalled++;
        value.setValue(
          observable.a + 1,
          observable.b + 1,
        );
      },
      onSetValue: (value) => {
        timesOnSetValueCalled++;
        observable.setValue(value.a - 1, value.b - 1);
      },
    });

    const initialTimesRecomputeCalled = timesRecomputeCalled;
    const initialTimesOnSetValueCalled = timesOnSetValueCalled;
    const initialIsDirty = computedPlusOne['isDirty'];

    // Test
    computedPlusOne.forceWriteBack();

    const updatedTimesRecomputeCalled = timesRecomputeCalled;
    const updatedTimesOnSetValueCalled = timesOnSetValueCalled;
    const updatedIsDirty = computedPlusOne['isDirty'];

    // Assert
    expect(initialTimesRecomputeCalled).toBe(0);
    expect(initialTimesOnSetValueCalled).toBe(0);
    expect(initialIsDirty).toBe(true);
    expectWidgetsToBeEqual(observable, new Widget(5, 4));
    expect(updatedTimesRecomputeCalled).toBe(0);
    expect(updatedTimesOnSetValueCalled).toBe(1);
    expect(updatedIsDirty).toBe(false);
    expectWidgetsToBeEqual(computedPlusOne.value, new Widget(6, 5));
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
    sourcePlusOne.value.setValue(5, 4);

    const updatedSourceValue = source.clone();
    const updatedSourcePlusOneValue = sourcePlusOne.value.clone();
    const updatedSourcePlusTwoValue = sourcePlusTwo.value.clone();

    // Assert
    expect(initialSourceValue).toEqual(new Widget(1, 2));
    expect(initialSourcePlusOneValue).toEqual(new Widget(2, 3));
    expect(initialSourcePlusTwoValue).toEqual(new Widget(3, 4));
    expect(updatedSourceValue).toEqual(new Widget(4, 3));
    expect(updatedSourcePlusOneValue).toEqual(new Widget(5, 4));
    expect(updatedSourcePlusTwoValue).toEqual(new Widget(6, 5));
  });
  test("WritableComputed instances can be garbage collected when no strong references remain", async () => {
    // Setup
    const source = new Widget(1, 2);
    let computedWasCollected = false;
    let timesDependencyChanged = 0;
    const registry = new FinalizationRegistry(() => {
      computedWasCollected = true;
    });

    (() => {
      // @NOTE Create computed value in a local scope
      // so it can be collected by the GC later.
      const computed = new WritableComputed(new Widget(0, 0), {
        dependencies: [source],
        recompute(value) {
          value.setValue(source.a + 1, source.b + 1);
        },
        onSetValue(value) {
          source.setValue(value.a - 1, value.b - 1);
        },
      });
      // @NOTE Replace `onDependencyChange` with spy function
      computed['onDependencyChange'] = () => {
        timesDependencyChanged++;
      };
      registry.register(computed, 'computed');
    })();

    expect(timesDependencyChanged).toBe(0);

    // Test
    /* Ensure computed is still firing */
    source.b++;
    expect(timesDependencyChanged).toBe(1);

    /* Wait for object to be collected by GC */
    await forceGCAndWaitForCondition(() => computedWasCollected);

    /* Ensure computed is not still reacting (it has been garbage collected) */
    source.a++;
    expect(timesDependencyChanged).toBe(1);

    // Assert
    expect(computedWasCollected).toBe(true);
  });
});

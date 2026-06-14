import { describe, test, expect } from 'vitest';
import { Computed, Observable, WritableComputed } from './observable';
import { forceGCAndWaitForCondition } from '@test/util/gc';

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
  test("`notifyOnChange()` is only called once when calling `mutate()`", () => {
    // Setup
    const observable = new Widget(1, 2);

    let timesOnChangeCalled = 0;
    observable.onChange(() => {
      timesOnChangeCalled++;
    });

    // Test
    observable['mutate'](() => {
      // @NOTE Modifying either `a` or `b` should fire `onChange()`
      observable.a = 2;
      observable.b = 4;
    });

    // Assert
    expect(timesOnChangeCalled).toBe(1);
  });
  test("`notifyOnChange()` is not broken after an error is thrown while calling `mutate()`", () => {
    // Setup
    const observable = new Widget(1, 2);

    let timesOnChangeCalled = 0;
    observable.onChange(() => {
      timesOnChangeCalled++;
    });

    // Test
    /* Throw an error while mutating */
    try {
      observable['mutate'](() => {
        throw new Error(`Mock error`);
      });
    } catch {
      /* @NOTE swallow error */
    }
    const timesOnChangeCalledAfterError = timesOnChangeCalled;
    /* Modify */
    observable.setValue(2, 4);
    const timesOnChangeCalledAfterModify = timesOnChangeCalled;

    // Assert
    expect(timesOnChangeCalledAfterError).toBe(0);
    expect(timesOnChangeCalledAfterModify).toBe(1);
  });
});

describe("Computed", () => {
  test("Calling `addDependency()` on a dependency that's already present has no effect (does not mark as dirty)", () => {
    // Setup
    const observable = new Widget(1, 2);
    let timesRecomputeCalled = 0;
    const computedPlusOne = new Computed(new Widget(0, 0), {
      dependencies: [observable],
      recompute: (value) => {
        timesRecomputeCalled++;
        value.setValue(
          observable.a + 1,
          observable.b + 1,
        );
      },
    });

    // @NOTE Force computed to recompute to clear `isDirty`
    computedPlusOne.forceRecompute();

    const initialDependencies = [...computedPlusOne['dependencies']];
    const initialIsDirty = computedPlusOne['isDirty'];
    const initialTimesRecomputeCalled = timesRecomputeCalled;

    // Test
    computedPlusOne.addDependency(observable);

    const updatedDependencies = [...computedPlusOne['dependencies']];
    const updatedIsDirty = computedPlusOne['isDirty'];
    const updatedTimesRecomputeCalled = timesRecomputeCalled;

    // Assert
    expect(initialDependencies).toHaveLength(1);
    expect(initialIsDirty).toBe(false);
    expect(initialTimesRecomputeCalled).toBe(1);
    expect(updatedDependencies).toHaveLength(1);
    expect(updatedIsDirty).toBe(false);
    expect(updatedTimesRecomputeCalled).toBe(1);
  });
  test("Calling `addDependency()` marks the computed as dirty", () => {
    // Setup
    const observable = new Widget(5, 2);
    let timesRecomputeCalled = 0;
    const computedPlusOne = new Computed(new Widget(0, 0), {
      dependencies: [],
      recompute: (value) => {
        timesRecomputeCalled++;
        value.setValue(
          observable.a + 1,
          observable.b + 1,
        );
      },
    });

    // @NOTE Force computed to recompute to clear `isDirty`
    computedPlusOne.forceRecompute();

    const initialIsDirty = computedPlusOne['isDirty'];
    const initialTimesRecomputeCalled = timesRecomputeCalled;

    // Test
    computedPlusOne.addDependency(observable);

    const updatedIsDirty = computedPlusOne['isDirty'];
    const updatedTimesRecomputeCalled = timesRecomputeCalled;

    // Assert
    expect(initialIsDirty).toBe(false);
    expect(updatedIsDirty).toBe(true);
    expect(initialTimesRecomputeCalled).toBe(1);
    expect(updatedTimesRecomputeCalled).toBe(1);
  });
  test("Calling `addDependency()` causes the computed to recompute when the new dependency changes", () => {
    // Setup
    const observableA = new Widget(1, 2);
    const observableB = new Widget(3, 4);
    const computedPlusOne = new Computed(new Widget(0, 0), {
      dependencies: [observableA],
      recompute: (value) => {
        value.setValue(
          observableA.a + 1,
          observableA.b + 1,
        );
      },
    });

    // @NOTE Force computed to recompute to clear `isDirty`
    computedPlusOne.forceRecompute();

    const isDirtyInitial = computedPlusOne['isDirty'];

    /* Update observableB to prove it does not affect computed */
    observableB.setValue(13, 14);
    const isDirtyAfterFirstMutatingObservableB = computedPlusOne['isDirty'];
    computedPlusOne.forceRecompute();

    /* Update observableA to prove it affects computed */
    observableA.setValue(11, 12);
    const isDirtyAfterFirstMutatingObservableA = computedPlusOne['isDirty'];


    // Test
    /* Add dependency and clear `isDirty` */
    computedPlusOne.addDependency(observableB);
    computedPlusOne.forceRecompute();

    /* Update observableA to prove it affects computed */
    observableA.setValue(21, 22);
    const isDirtyAfterSecondMutatingObservableA = computedPlusOne['isDirty'];
    computedPlusOne.forceRecompute();

    /* Update observableB to prove it affects computed */
    observableB.setValue(23, 24);
    const isDirtyAfterSecondMutatingObservableB = computedPlusOne['isDirty'];

    // Assert
    expect(isDirtyInitial).toBe(false);
    expect(isDirtyAfterFirstMutatingObservableB).toBe(false);
    expect(isDirtyAfterFirstMutatingObservableA).toBe(true);
    expect(isDirtyAfterSecondMutatingObservableA).toBe(true);
    expect(isDirtyAfterSecondMutatingObservableB).toBe(true);
  });
  test("Calling `removeDependency()` on a dependency that isn't registered has no effect (does not mark as dirty)", () => {
    // Setup
    const observableA = new Widget(1, 2);
    const observableB = new Widget(3, 4);
    let timesRecomputeCalled = 0;
    const computedPlusOne = new Computed(new Widget(0, 0), {
      dependencies: [observableA],
      recompute: (value) => {
        timesRecomputeCalled++;
        value.setValue(
          observableA.a + 1,
          observableA.b + 1,
        );
      },
    });

    // @NOTE Force computed to recompute to clear `isDirty`
    computedPlusOne.forceRecompute();

    const initialDependencies = [...computedPlusOne['dependencies']];
    const initialIsDirty = computedPlusOne['isDirty'];
    const initialTimesRecomputeCalled = timesRecomputeCalled;

    // Test
    computedPlusOne.removeDependency(observableB);

    const updatedDependencies = [...computedPlusOne['dependencies']];
    const updatedIsDirty = computedPlusOne['isDirty'];
    const updatedTimesRecomputeCalled = timesRecomputeCalled;

    // Assert
    expect(initialDependencies).toHaveLength(1);
    expect(initialIsDirty).toBe(false);
    expect(initialTimesRecomputeCalled).toBe(1);
    expect(updatedDependencies).toHaveLength(1);
    expect(updatedIsDirty).toBe(false);
    expect(updatedTimesRecomputeCalled).toBe(1);
  });
  test("Calling `removeDependency()` marks the computed as dirty", () => {
    // Setup
    const observable = new Widget(5, 2);
    let timesRecomputeCalled = 0;
    const computedPlusOne = new Computed(new Widget(0, 0), {
      dependencies: [observable],
      recompute: (value) => {
        timesRecomputeCalled++;
        value.setValue(
          observable.a + 1,
          observable.b + 1,
        );
      },
    });

    // @NOTE Force computed to recompute to clear `isDirty`
    computedPlusOne.forceRecompute();

    const initialIsDirty = computedPlusOne['isDirty'];
    const initialTimesRecomputeCalled = timesRecomputeCalled;

    // Test
    computedPlusOne.removeDependency(observable);

    const updatedIsDirty = computedPlusOne['isDirty'];
    const updatedTimesRecomputeCalled = timesRecomputeCalled;

    // Assert
    expect(initialIsDirty).toBe(false);
    expect(updatedIsDirty).toBe(true);
    expect(initialTimesRecomputeCalled).toBe(1);
    expect(updatedTimesRecomputeCalled).toBe(1);
  });
  test("Calling `removeDependency()` causes the computed to stop listening to the dependency's changes", () => {
    // Setup
    const observableA = new Widget(1, 2);
    const observableB = new Widget(3, 4);
    const computedPlusOne = new Computed(new Widget(0, 0), {
      dependencies: [observableA, observableB],
      recompute: (value) => {
        value.setValue(
          observableA.a + 1,
          observableA.b + 1,
        );
      },
    });

    // @NOTE Force computed to recompute to clear `isDirty`
    computedPlusOne.forceRecompute();

    const isDirtyInitial = computedPlusOne['isDirty'];

    /* Update observableB to prove it affects computed */
    observableB.setValue(13, 14);
    const isDirtyAfterFirstMutatingObservableB = computedPlusOne['isDirty'];
    computedPlusOne.forceRecompute();

    /* Update observableA to prove it affects computed */
    observableA.setValue(11, 12);
    const isDirtyAfterFirstMutatingObservableA = computedPlusOne['isDirty'];


    // Test
    /* Remove dependency and clear `isDirty` */
    computedPlusOne.removeDependency(observableB);
    computedPlusOne.forceRecompute();

    /* Update observableA to prove it affects computed */
    observableA.setValue(21, 22);
    const isDirtyAfterSecondMutatingObservableA = computedPlusOne['isDirty'];
    computedPlusOne.forceRecompute();

    /* Update observableB to prove it does not affect computed */
    observableB.setValue(23, 24);
    const isDirtyAfterSecondMutatingObservableB = computedPlusOne['isDirty'];

    // Assert
    expect(isDirtyInitial).toBe(false);
    expect(isDirtyAfterFirstMutatingObservableB).toBe(true);
    expect(isDirtyAfterFirstMutatingObservableA).toBe(true);
    expect(isDirtyAfterSecondMutatingObservableA).toBe(true);
    expect(isDirtyAfterSecondMutatingObservableB).toBe(false);
  });
  test("Calling `removeAllDependencies()` marks the computed as dirty", () => {
    // Setup
    const observable = new Widget(5, 2);
    let timesRecomputeCalled = 0;
    const computedPlusOne = new Computed(new Widget(0, 0), {
      dependencies: [observable],
      recompute: (value) => {
        timesRecomputeCalled++;
        value.setValue(
          observable.a + 1,
          observable.b + 1,
        );
      },
    });

    // @NOTE Force computed to recompute to clear `isDirty`
    computedPlusOne.forceRecompute();

    const initialIsDirty = computedPlusOne['isDirty'];
    const initialTimesRecomputeCalled = timesRecomputeCalled;

    // Test
    computedPlusOne.removeAllDependencies();

    const updatedIsDirty = computedPlusOne['isDirty'];
    const updatedTimesRecomputeCalled = timesRecomputeCalled;

    // Assert
    expect(initialIsDirty).toBe(false);
    expect(updatedIsDirty).toBe(true);
    expect(initialTimesRecomputeCalled).toBe(1);
    expect(updatedTimesRecomputeCalled).toBe(1);
  });
  test("Calling `removeAllDependencies()` causes the computed to stop listening to all dependencies' changes", () => {
    // Setup
    const observableA = new Widget(1, 2);
    const observableB = new Widget(3, 4);
    const computedPlusOne = new Computed(new Widget(0, 0), {
      dependencies: [observableA, observableB],
      recompute: (value) => {
        value.setValue(
          observableA.a + 1,
          observableA.b + 1,
        );
      },
    });

    // @NOTE Force computed to recompute to clear `isDirty`
    computedPlusOne.forceRecompute();

    const isDirtyInitial = computedPlusOne['isDirty'];

    /* Update observableB to prove it affects computed */
    observableB.setValue(13, 14);
    const isDirtyAfterFirstMutatingObservableB = computedPlusOne['isDirty'];
    computedPlusOne.forceRecompute();

    /* Update observableA to prove it affects computed */
    observableA.setValue(11, 12);
    const isDirtyAfterFirstMutatingObservableA = computedPlusOne['isDirty'];


    // Test
    /* Remove dependency and clear `isDirty` */
    computedPlusOne.removeAllDependencies();
    computedPlusOne.forceRecompute();

    /* Update observableA to prove it does not affect computed */
    observableA.setValue(21, 22);
    const isDirtyAfterSecondMutatingObservableA = computedPlusOne['isDirty'];

    /* Update observableB to prove it does not affect computed */
    observableB.setValue(23, 24);
    const isDirtyAfterSecondMutatingObservableB = computedPlusOne['isDirty'];

    // Assert
    expect(isDirtyInitial).toBe(false);
    expect(isDirtyAfterFirstMutatingObservableB).toBe(true);
    expect(isDirtyAfterFirstMutatingObservableA).toBe(true);
    expect(isDirtyAfterSecondMutatingObservableA).toBe(false);
    expect(isDirtyAfterSecondMutatingObservableB).toBe(false);
  });
  test("Calling `forceRecompute()` calls `recompute()` and marks the computed as not dirty", () => {
    // Setup
    const observable = new Widget(1, 2);
    let timesRecomputeCalled = 0;
    const computedPlusOne = new Computed(new Widget(0, 0), {
      dependencies: [observable],
      recompute: (value) => {
        timesRecomputeCalled++;
        value.setValue(
          observable.a + 1,
          observable.b + 1,
        );
      },
    });

    const isDirtyInitial = computedPlusOne['isDirty'];
    const timesRecomputeCalledInitial = timesRecomputeCalled;

    // Test
    computedPlusOne.forceRecompute();

    const isDirtyUpdated = computedPlusOne['isDirty'];
    const timesRecomputeCalledUpdated = timesRecomputeCalled;

    // Assert
    expect(isDirtyInitial).toBe(true);
    expect(timesRecomputeCalledInitial).toBe(0);
    expect(isDirtyUpdated).toBe(false);
    expect(timesRecomputeCalledUpdated).toBe(1);
  });
  test("Getting `value` when computed is dirty calls `recompute()` and returns the updated value", () => {
    // Setup
    const observable = new Widget(1, 2);
    let timesRecomputeCalled = 0;
    const computedPlusOne = new Computed(new Widget(0, 0), {
      dependencies: [observable],
      recompute: (value) => {
        timesRecomputeCalled++;
        value.setValue(
          observable.a + 1,
          observable.b + 1,
        );
      },
    });

    const isDirtyInitial = computedPlusOne['isDirty'];
    const timesRecomputeCalledInitial = timesRecomputeCalled;

    // Test
    const result = computedPlusOne.value;

    const isDirtyUpdated = computedPlusOne['isDirty'];
    const timesRecomputeCalledUpdated = timesRecomputeCalled;

    // Assert
    expect(result).toEqual(new Widget(2, 3));
    expect(isDirtyInitial).toBe(true);
    expect(timesRecomputeCalledInitial).toBe(0);
    expect(isDirtyUpdated).toBe(false);
    expect(timesRecomputeCalledUpdated).toBe(1);
  });
  test("Getting `value` when computed is not dirty doesn't call `recompute()` and returns the current value", () => {
    // Setup
    const observable = new Widget(1, 2);
    let timesRecomputeCalled = 0;
    const computedPlusOne = new Computed(new Widget(0, 0), {
      dependencies: [observable],
      recompute: (value) => {
        timesRecomputeCalled++;
        value.setValue(
          observable.a + 1,
          observable.b + 1,
        );
      },
    });

    // @NOTE Force computed to recompute to clear `isDirty`
    computedPlusOne.forceRecompute();

    const isDirtyInitial = computedPlusOne['isDirty'];
    const timesRecomputeCalledInitial = timesRecomputeCalled;

    // Test
    const result = computedPlusOne.value;

    const isDirtyUpdated = computedPlusOne['isDirty'];
    const timesRecomputeCalledUpdated = timesRecomputeCalled;

    // Assert
    expect(result).toEqual(new Widget(2, 3));
    expect(isDirtyInitial).toBe(false);
    expect(timesRecomputeCalledInitial).toBe(1);
    expect(isDirtyUpdated).toBe(false);
    expect(timesRecomputeCalledUpdated).toBe(1);
  });
  test("Modifying a Computed's dependencies notifies downstream dependents, preventing stale reads", () => {
    /*
      Test written for a bug.
      Scenario is: A computed whose logic depends on what kind of dependencies it has.
      When its dependencies change, if it doesn't notify down the chain that it is dirty
      you could cause dirty reads i.e. you might read a computed value that is dependent
      on a dirty dependency without causing it to recompute.
     */

    // Setup
    const source = new Widget(1, 2);
    let extra: Widget | undefined = undefined;

    /**
     * A Computed with a dependency on `source` but also optionally
     * a dependency on `extra`.
     */
    const middle = new Computed(new Widget(0, 0), {
      debug_name: 'middle',
      dependencies: [source],
      recompute(value) {
        let a = source.a + 1;
        let b = source.b + 1;
        if (extra) {
          a += extra.a;
          b += extra.b;
        }
        value.setValue(a, b);
      },
    });
    const downstream = new Computed(new Widget(0, 0), {
      debug_name: 'downstream',
      dependencies: [middle],
      recompute(value) {
        value.setValue(middle.value.a + 2, middle.value.b + 2);
      },
    });

    const initialMiddleValue = middle.value.clone();
    const initialDownstreamValue = downstream.value.clone();

    const beforeAddDependencyMiddleIsDirty = middle['isDirty'];
    const beforeAddDependencyDownstreamIsDirty = downstream['isDirty'];

    // Test
    /* Define / add dependency */
    extra = new Widget(10, 20);
    middle.addDependency(extra);

    const afterAddDependencyMiddleIsDirty = middle['isDirty'];
    const afterAddDependencyDownstreamIsDirty = downstream['isDirty'];

    const afterAddDependencyMiddleValue = middle.value.clone();
    const afterAddDependencyDownstreamValue = downstream.value.clone();

    const afterReadUpdatedValueMiddleIsDirty = middle['isDirty'];
    const afterReadUpdatedValueDownstreamIsDirty = downstream['isDirty'];

    /* Clear / remove dependency */
    middle.removeDependency(extra);
    extra = undefined;

    const afterRemoveDependencyMiddleIsDirty = middle['isDirty'];
    const afterRemoveDependencyDownstreamIsDirty = downstream['isDirty'];

    const afterRemoveDependencyMiddleValue = middle.value.clone();
    const afterRemoveDependencyDownstreamValue = downstream.value.clone();

    const finalMiddleIsDirty = middle['isDirty'];
    const finalDownstreamIsDirty = downstream['isDirty'];


    // Assert
    expect(initialMiddleValue).toEqual(new Widget(2, 3));
    expect(initialDownstreamValue).toEqual(new Widget(4, 5));

    expect(beforeAddDependencyMiddleIsDirty).toBe(false);
    expect(beforeAddDependencyDownstreamIsDirty).toBe(false);

    expect(afterAddDependencyMiddleIsDirty).toBe(true);
    expect(afterAddDependencyDownstreamIsDirty).toBe(true);
    expect(afterAddDependencyMiddleValue).toEqual(new Widget(12, 23));
    expect(afterAddDependencyDownstreamValue).toEqual(new Widget(14, 25));
    expect(afterReadUpdatedValueMiddleIsDirty).toBe(false);
    expect(afterReadUpdatedValueDownstreamIsDirty).toBe(false);

    expect(afterRemoveDependencyMiddleIsDirty).toBe(true);
    expect(afterRemoveDependencyDownstreamIsDirty).toBe(true);
    expect(afterRemoveDependencyMiddleValue).toEqual(new Widget(2, 3));
    expect(afterRemoveDependencyDownstreamValue).toEqual(new Widget(4, 5));
    expect(finalMiddleIsDirty).toBe(false);
    expect(finalDownstreamIsDirty).toBe(false);
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
  test("Computed instances can be garbage collected when no references remain", async () => {
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
      const computed = new Computed(new Widget(0, 0), {
        dependencies: [source],
        recompute(value) {
          value.setValue(source.a + 1, source.b + 1);
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

function spyOnRecompute<T>(computed: Computed<T>, callback: () => void): void {
  const PropertyName = `recompute`;
  const spiedComputed = (computed as unknown as { [PropertyName]: (value: T) => void });
  const internalRecompute = spiedComputed[PropertyName];
  spiedComputed[PropertyName] = (tmpState) => {
    callback();
    internalRecompute(tmpState);
  };
}

class Widget extends Observable {
  protected _a: number;
  protected _b: number;
  public constructor(a: number, b: number) {
    super();
    this._a = a;
    this._b = b;
  }

  public setValue(a: number, b: number): this {
    this.mutate(() => {
      this.a = a;
      this.b = b;
    });
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

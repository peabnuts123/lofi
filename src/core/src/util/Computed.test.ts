import { describe, test, expect } from 'vitest';
import { forceGCAndWaitForCondition } from '@test/util/gc';
import { Widget } from './Observable.test';
import { Computed } from './Computed';



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

export function spyOnRecompute<T>(computed: Computed<T>, callback: () => void): void {
  const PropertyName = `recompute`;
  const spiedComputed = (computed as unknown as { [PropertyName]: (value: T) => void });
  const internalRecompute = spiedComputed[PropertyName];
  spiedComputed[PropertyName] = (tmpState) => {
    callback();
    internalRecompute(tmpState);
  };
}

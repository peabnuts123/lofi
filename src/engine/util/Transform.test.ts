import { describe, test, expect } from 'vitest';
import { Transform } from './Transform';
import { expectMatrix4sToBeEqual, expectQuaternionsToBeEqual, expectVectorsToBeEqual } from '@test/util/expect';
import { Vector3 } from './vector';
import { Quaternion } from './quaternion';
import { Matrix4 } from './Matrix4';
import { lerp } from './math';

/*
  @TODO Test backlog
     ? POSSIBLE BUG?: `addChild` recomputes transforms. What happens to transitive children e.g. `c.addChild(b); a.addChild(b);` - Does C update correctly?
 */

describe("Transform", () => {
  test("New Transform instance has expected values", () => {
    // Setup
    const widgetInstance = new Widget();
    const transform = createTransform(widgetInstance);

    // Test / Assert
    expectVectorsToBeEqual(transform.position, Vector3.zero());
    expectVectorsToBeEqual(transform.absolutePosition, Vector3.zero());
    expectQuaternionsToBeEqual(transform.rotation.q, Quaternion.identity());
    expectQuaternionsToBeEqual(transform.absoluteRotation.q, Quaternion.identity());
    expectVectorsToBeEqual(transform.scale, Vector3.one());
    expectVectorsToBeEqual(transform.absoluteScale, Vector3.one());
    expect(transform.children).toHaveLength(0);
    expect(transform.parent).toBeUndefined();
    expect(transform.node).toBe(widgetInstance);
    expect(transform.worldMatrix).toEqual(new Matrix4());
  });
  describe("Observability", () => {
    test("Mutating position marks dependencies as dirty, does not recompute them", () => {
      /*
        Dependencies of position:
          - absolutePosition
          - worldMatrix
          - (indirect) child.absolutePosition
          - (indirect) child.worldMatrix
       */
      // Setup
      const transform = createTransform();
      const childTransform = createTransform();
      transform.addChild(childTransform);

      // @NOTE Read values so that they are not dirty initially
      let _: any;
      _ = transform.absolutePosition;
      _ = transform.worldMatrix;
      _ = childTransform.absolutePosition;
      _ = childTransform.worldMatrix;

      const initialAbsolutePositionIsDirty = transform['_absolutePosition']['isDirty'];
      const initialAbsolutePositionValue = transform['_absolutePosition']['_value'].clone();
      const initialWorldMatrixIsDirty = transform['_worldMatrix']['isDirty'];
      const initialWorldMatrixValue = transform['_worldMatrix']['_value'].clone();
      const initialChildAbsolutePositionIsDirty = childTransform['_absolutePosition']['isDirty'];
      const initialChildAbsolutePositionValue = childTransform['_absolutePosition']['_value'].clone();
      const initialChildWorldMatrixIsDirty = childTransform['_worldMatrix']['isDirty'];
      const initialChildWorldMatrixValue = childTransform['_worldMatrix']['_value'].clone();

      // Test
      transform.position = new Vector3(10, 20, 30);

      const updatedAbsolutePositionIsDirty = transform['_absolutePosition']['isDirty'];
      const updatedAbsolutePositionValue = transform['_absolutePosition']['_value'].clone();
      const updatedWorldMatrixIsDirty = transform['_worldMatrix']['isDirty'];
      const updatedWorldMatrixValue = transform['_worldMatrix']['_value'].clone();
      const updatedChildAbsolutePositionIsDirty = childTransform['_absolutePosition']['isDirty'];
      const updatedChildAbsolutePositionValue = childTransform['_absolutePosition']['_value'].clone();
      const updatedChildWorldMatrixIsDirty = childTransform['_worldMatrix']['isDirty'];
      const updatedChildWorldMatrixValue = childTransform['_worldMatrix']['_value'].clone();

      // Assert
      /* Initial values are not dirty */
      expect(initialAbsolutePositionIsDirty).toBe(false);
      expect(initialWorldMatrixIsDirty).toBe(false);
      expect(initialChildAbsolutePositionIsDirty).toBe(false);
      expect(initialChildWorldMatrixIsDirty).toBe(false);
      /* After mutating, values are dirty */
      expect(updatedAbsolutePositionIsDirty).toBe(true);
      expect(updatedWorldMatrixIsDirty).toBe(true);
      expect(updatedChildAbsolutePositionIsDirty).toBe(true);
      expect(updatedChildWorldMatrixIsDirty).toBe(true);
      /* Internal values have not changed */
      expectVectorsToBeEqual(initialAbsolutePositionValue, updatedAbsolutePositionValue);
      expectMatrix4sToBeEqual(initialWorldMatrixValue, updatedWorldMatrixValue);
      expectVectorsToBeEqual(initialChildAbsolutePositionValue, updatedChildAbsolutePositionValue);
      expectMatrix4sToBeEqual(initialChildWorldMatrixValue, updatedChildWorldMatrixValue);
    });
    test("Mutating rotation marks dependencies as dirty, does not recompute them", () => {
      /*
        Dependencies of rotation:
          - absoluteRotation.q
          - worldMatrix
          - (indirect) child.absolutePosition
          - (indirect) child.absoluteRotation.q
          - (indirect) child.worldMatrix
       */
      // Setup
      const transform = createTransform();
      const childTransform = createTransform();
      transform.addChild(childTransform);

      // @NOTE Read values so that they are not dirty initially
      let _: any;
      _ = transform.absoluteRotation.q;
      _ = transform.worldMatrix;
      _ = childTransform.absolutePosition;
      _ = childTransform.absoluteRotation.q;
      _ = childTransform.worldMatrix;

      const initialAbsoluteRotationIsDirty = transform['_absoluteRotation']['isDirty'];
      const initialAbsoluteRotationQValue = transform['_absoluteRotation']['_value'].q.clone();
      const initialWorldMatrixIsDirty = transform['_worldMatrix']['isDirty'];
      const initialWorldMatrixValue = transform['_worldMatrix']['_value'].clone();
      const initialChildAbsolutePositionIsDirty = childTransform['_absolutePosition']['isDirty'];
      const initialChildAbsolutePositionValue = childTransform['_absolutePosition']['_value'].clone();
      const initialChildAbsoluteRotationIsDirty = childTransform['_absoluteRotation']['isDirty'];
      const initialChildAbsoluteRotationQValue = childTransform['_absoluteRotation']['_value'].q.clone();
      const initialChildWorldMatrixIsDirty = childTransform['_worldMatrix']['isDirty'];
      const initialChildWorldMatrixValue = childTransform['_worldMatrix']['_value'].clone();

      // Test
      transform.rotation.set(new Vector3(10, 20, 30));

      const updatedAbsoluteRotationIsDirty = transform['_absoluteRotation']['isDirty'];
      const updatedAbsoluteRotationQValue = transform['_absoluteRotation']['_value'].q.clone();
      const updatedWorldMatrixIsDirty = transform['_worldMatrix']['isDirty'];
      const updatedWorldMatrixValue = transform['_worldMatrix']['_value'].clone();
      const updatedChildAbsolutePositionIsDirty = childTransform['_absolutePosition']['isDirty'];
      const updatedChildAbsolutePositionValue = childTransform['_absolutePosition']['_value'].clone();
      const updatedChildAbsoluteRotationIsDirty = childTransform['_absoluteRotation']['isDirty'];
      const updatedChildAbsoluteRotationQValue = childTransform['_absoluteRotation']['_value'].q.clone();
      const updatedChildWorldMatrixIsDirty = childTransform['_worldMatrix']['isDirty'];
      const updatedChildWorldMatrixValue = childTransform['_worldMatrix']['_value'].clone();

      // Assert
      /* Initial values are not dirty */
      expect(initialAbsoluteRotationIsDirty).toBe(false);
      expect(initialWorldMatrixIsDirty).toBe(false);
      expect(initialChildAbsolutePositionIsDirty).toBe(false);
      expect(initialChildAbsoluteRotationIsDirty).toBe(false);
      expect(initialChildWorldMatrixIsDirty).toBe(false);
      /* After mutating, values are dirty */
      expect(updatedAbsoluteRotationIsDirty).toBe(true);
      expect(updatedWorldMatrixIsDirty).toBe(true);
      expect(updatedChildAbsolutePositionIsDirty).toBe(true);
      expect(updatedChildAbsoluteRotationIsDirty).toBe(true);
      expect(updatedChildWorldMatrixIsDirty).toBe(true);
      /* Internal values have not changed */
      expectQuaternionsToBeEqual(initialAbsoluteRotationQValue, updatedAbsoluteRotationQValue);
      expectMatrix4sToBeEqual(initialWorldMatrixValue, updatedWorldMatrixValue);
      expectVectorsToBeEqual(initialChildAbsolutePositionValue, updatedChildAbsolutePositionValue);
      expectQuaternionsToBeEqual(initialChildAbsoluteRotationQValue, updatedChildAbsoluteRotationQValue);
      expectMatrix4sToBeEqual(initialChildWorldMatrixValue, updatedChildWorldMatrixValue);
    });
    test("Mutating scale marks dependencies as dirty, does not recompute them", () => {
      /*
        Dependencies of scale:
          - absoluteScale
          - worldMatrix
          - (indirect) child.absolutePosition
          - (indirect) child.absoluteScale
          - (indirect) child.worldMatrix
       */
      // Setup
      const transform = createTransform();
      const childTransform = createTransform();
      transform.addChild(childTransform);

      // @NOTE Read values so that they are not dirty initially
      let _: any;
      _ = transform.absoluteScale;
      _ = transform.worldMatrix;
      _ = childTransform.absolutePosition;
      _ = childTransform.absoluteScale;
      _ = childTransform.worldMatrix;

      const initialAbsoluteScaleIsDirty = transform['_absoluteScale']['isDirty'];
      const initialAbsoluteScaleValue = transform['_absoluteScale']['_value'].clone();
      const initialWorldMatrixIsDirty = transform['_worldMatrix']['isDirty'];
      const initialWorldMatrixValue = transform['_worldMatrix']['_value'].clone();
      const initialChildAbsolutePositionIsDirty = childTransform['_absolutePosition']['isDirty'];
      const initialChildAbsolutePositionValue = childTransform['_absolutePosition']['_value'].clone();
      const initialChildAbsoluteScaleIsDirty = childTransform['_absoluteScale']['isDirty'];
      const initialChildAbsoluteScaleValue = childTransform['_absoluteScale']['_value'].clone();
      const initialChildWorldMatrixIsDirty = childTransform['_worldMatrix']['isDirty'];
      const initialChildWorldMatrixValue = childTransform['_worldMatrix']['_value'].clone();

      // Test
      transform.scale = new Vector3(1.1, 1.2, 1.3);

      const updatedAbsoluteScaleIsDirty = transform['_absoluteScale']['isDirty'];
      const updatedAbsoluteScaleValue = transform['_absoluteScale']['_value'].clone();
      const updatedWorldMatrixIsDirty = transform['_worldMatrix']['isDirty'];
      const updatedWorldMatrixValue = transform['_worldMatrix']['_value'].clone();
      const updatedChildAbsolutePositionIsDirty = childTransform['_absolutePosition']['isDirty'];
      const updatedChildAbsolutePositionValue = childTransform['_absolutePosition']['_value'].clone();
      const updatedChildAbsoluteScaleIsDirty = childTransform['_absoluteScale']['isDirty'];
      const updatedChildAbsoluteScaleValue = childTransform['_absoluteScale']['_value'].clone();
      const updatedChildWorldMatrixIsDirty = childTransform['_worldMatrix']['isDirty'];
      const updatedChildWorldMatrixValue = childTransform['_worldMatrix']['_value'].clone();

      // Assert
      /* Initial values are not dirty */
      expect(initialAbsoluteScaleIsDirty).toBe(false);
      expect(initialWorldMatrixIsDirty).toBe(false);
      expect(initialChildAbsolutePositionIsDirty).toBe(false);
      expect(initialChildAbsoluteScaleIsDirty).toBe(false);
      expect(initialChildWorldMatrixIsDirty).toBe(false);
      /* After mutating, values are dirty */
      expect(updatedAbsoluteScaleIsDirty).toBe(true);
      expect(updatedWorldMatrixIsDirty).toBe(true);
      expect(updatedChildAbsolutePositionIsDirty).toBe(true);
      expect(updatedChildAbsoluteScaleIsDirty).toBe(true);
      expect(updatedChildWorldMatrixIsDirty).toBe(true);
      /* Internal values have not changed */
      expectVectorsToBeEqual(initialAbsoluteScaleValue, updatedAbsoluteScaleValue);
      expectMatrix4sToBeEqual(initialWorldMatrixValue, updatedWorldMatrixValue);
      expectVectorsToBeEqual(initialChildAbsolutePositionValue, updatedChildAbsolutePositionValue);
      expectVectorsToBeEqual(initialChildAbsoluteScaleValue, updatedChildAbsoluteScaleValue);
      expectMatrix4sToBeEqual(initialChildWorldMatrixValue, updatedChildWorldMatrixValue);
    });
    test("Parenting an initially unparented Transform starts listening to the parents values", () => {
      // Setup
      const transform = createTransform();
      const parentTransform = createTransform();
      const positionOperand = new Vector3(1, 2, 3);
      const rotationOperand = Quaternion.fromEuler(10, 20, 30);
      const scaleOperand = new Vector3(1.1, 1.2, 1.3);

      const initialAbsolutePosition = transform.absolutePosition.clone();
      const initialAbsoluteRotationQ = transform.absoluteRotation.q.clone();
      const initialAbsoluteScale = transform.absoluteScale.clone();

      /* Mutate parent - just to capture that it DOES NOT affect transform yet */
      parentTransform.position = positionOperand;
      parentTransform.rotation.set(rotationOperand);
      parentTransform.scale = scaleOperand;

      const beforeParentingAbsolutePosition = transform.absolutePosition.clone();
      const beforeParentingAbsoluteRotationQ = transform.absoluteRotation.q.clone();
      const beforeParentingAbsoluteScale = transform.absoluteScale.clone();

      /* Set parent back to initial position/rotation/scale so we can more easily think about it */
      parentTransform.position = Vector3.zero();
      parentTransform.rotation.set(Quaternion.identity());
      parentTransform.scale = Vector3.one();

      // Test
      parentTransform.addChild(transform);

      const afterParentingAbsolutePosition = transform.absolutePosition.clone();
      const afterParentingAbsoluteRotationQ = transform.absoluteRotation.q.clone();
      const afterParentingAbsoluteScale = transform.absoluteScale.clone();

      parentTransform.position = positionOperand;
      parentTransform.rotation.set(rotationOperand);
      parentTransform.scale = scaleOperand;

      const updatedAbsolutePosition = transform.absolutePosition.clone();
      const updatedAbsoluteRotationQ = transform.absoluteRotation.q.clone();
      const updatedAbsoluteScale = transform.absoluteScale.clone();

      // Assert
      expectVectorsToBeEqual(initialAbsolutePosition, Vector3.zero());
      expectQuaternionsToBeEqual(initialAbsoluteRotationQ, Quaternion.identity());
      expectVectorsToBeEqual(initialAbsoluteScale, Vector3.one());

      expectVectorsToBeEqual(beforeParentingAbsolutePosition, Vector3.zero());
      expectQuaternionsToBeEqual(beforeParentingAbsoluteRotationQ, Quaternion.identity());
      expectVectorsToBeEqual(beforeParentingAbsoluteScale, Vector3.one());

      expectVectorsToBeEqual(afterParentingAbsolutePosition, Vector3.zero());
      expectQuaternionsToBeEqual(afterParentingAbsoluteRotationQ, Quaternion.identity());
      expectVectorsToBeEqual(afterParentingAbsoluteScale, Vector3.one());

      expectVectorsToBeEqual(updatedAbsolutePosition, positionOperand);
      expectQuaternionsToBeEqual(updatedAbsoluteRotationQ, rotationOperand);
      expectVectorsToBeEqual(updatedAbsoluteScale, scaleOperand);
    });
    test("Unparenting a parented Transform stops listening to the parents values", () => {
      // Setup
      const transform = createTransform();
      const parentTransform = createTransform();
      parentTransform.addChild(transform);
      const positionOperand = new Vector3(1, 2, 3);
      const rotationOperand = Quaternion.fromEuler(10, 20, 30);
      const scaleOperand = new Vector3(1.1, 1.2, 1.3);

      const initialAbsolutePosition = transform.absolutePosition.clone();
      const initialAbsoluteRotationQ = transform.absoluteRotation.q.clone();
      const initialAbsoluteScale = transform.absoluteScale.clone();

      /* Mutate parent - just to capture that it DOES NOT affect transform yet */
      parentTransform.position = positionOperand;
      parentTransform.rotation.set(rotationOperand);
      parentTransform.scale = scaleOperand;

      const beforeUnparentingAbsolutePosition = transform.absolutePosition.clone();
      const beforeUnparentingAbsoluteRotationQ = transform.absoluteRotation.q.clone();
      const beforeUnparentingAbsoluteScale = transform.absoluteScale.clone();

      /* Set parent back to initial position/rotation/scale so we can more easily think about it */
      parentTransform.position = Vector3.zero();
      parentTransform.rotation.set(Quaternion.identity());
      parentTransform.scale = Vector3.one();

      // Test
      parentTransform.removeChild(transform);

      const afterUnparentingAbsolutePosition = transform.absolutePosition.clone();
      const afterUnparentingAbsoluteRotationQ = transform.absoluteRotation.q.clone();
      const afterUnparentingAbsoluteScale = transform.absoluteScale.clone();

      parentTransform.position = positionOperand;
      parentTransform.rotation.set(rotationOperand);
      parentTransform.scale = scaleOperand;

      const updatedAbsolutePosition = transform.absolutePosition.clone();
      const updatedAbsoluteRotationQ = transform.absoluteRotation.q.clone();
      const updatedAbsoluteScale = transform.absoluteScale.clone();

      // Assert
      expectVectorsToBeEqual(initialAbsolutePosition, Vector3.zero());
      expectQuaternionsToBeEqual(initialAbsoluteRotationQ, Quaternion.identity());
      expectVectorsToBeEqual(initialAbsoluteScale, Vector3.one());

      expectVectorsToBeEqual(beforeUnparentingAbsolutePosition, positionOperand);
      expectQuaternionsToBeEqual(beforeUnparentingAbsoluteRotationQ, rotationOperand);
      expectVectorsToBeEqual(beforeUnparentingAbsoluteScale, scaleOperand);

      expectVectorsToBeEqual(afterUnparentingAbsolutePosition, Vector3.zero());
      expectQuaternionsToBeEqual(afterUnparentingAbsoluteRotationQ, Quaternion.identity());
      expectVectorsToBeEqual(afterUnparentingAbsoluteScale, Vector3.one());

      expectVectorsToBeEqual(updatedAbsolutePosition, Vector3.zero());
      expectQuaternionsToBeEqual(updatedAbsoluteRotationQ, Quaternion.identity());
      expectVectorsToBeEqual(updatedAbsoluteScale, Vector3.one());
    });
  });
  describe("Position", () => {
    describe("Without Parent", () => {
      test("Setting position updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const updatedPosition = new Vector3(10, 20, 30);
        const expectedWorldMatrix = worldMatrix({ position: updatedPosition });

        // Test
        transform.position = updatedPosition;

        // Assert
        expectVectorsToBeEqual(transform.position, updatedPosition);
        expectVectorsToBeEqual(transform.absolutePosition, updatedPosition);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Mutating position updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const updatedPositionX = 30;
        const expectedPosition = Vector3.zero().withX(updatedPositionX);
        const expectedWorldMatrix = worldMatrix({ position: expectedPosition });

        // Test
        transform.position.x = updatedPositionX;

        // Assert
        expectVectorsToBeEqual(transform.position, expectedPosition);
        expectVectorsToBeEqual(transform.absolutePosition, expectedPosition);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Setting absolutePosition updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const updatedPosition = new Vector3(10, 20, 30);
        const expectedWorldMatrix = worldMatrix({ position: updatedPosition });

        // Test
        transform.absolutePosition = updatedPosition;

        // Assert
        expectVectorsToBeEqual(transform.position, updatedPosition);
        expectVectorsToBeEqual(transform.absolutePosition, updatedPosition);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Mutating absolutePosition updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const updatedPositionX = 30;
        const expectedPosition = Vector3.zero().withX(updatedPositionX);
        const expectedWorldMatrix = worldMatrix({ position: expectedPosition });

        // Test
        transform.absolutePosition.x = updatedPositionX;

        // Assert
        expectVectorsToBeEqual(transform.position, expectedPosition);
        expectVectorsToBeEqual(transform.absolutePosition, expectedPosition);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Parenting an initially unparented Transform updates its position based on absolutePosition", () => {
        // Setup
        const transform = createTransform();
        const expectedAbsolutePosition = new Vector3(10, 20, 30);
        transform.absolutePosition = expectedAbsolutePosition;
        const parentTransform = createTransform();
        parentTransform.absolutePosition = new Vector3(5, 10, 15);
        const expectedUpdatedLocalPosition = expectedAbsolutePosition.subtract(parentTransform.absolutePosition);

        const initialPosition = transform.position.clone();
        const initialAbsolutePosition = transform.absolutePosition.clone();

        // Test
        parentTransform.addChild(transform);

        const updatedPosition = transform.position.clone();
        const updatedAbsolutePosition = transform.absolutePosition.clone();

        // Assert
        expectVectorsToBeEqual(initialPosition, expectedAbsolutePosition);
        expectVectorsToBeEqual(initialAbsolutePosition, expectedAbsolutePosition);
        expectVectorsToBeEqual(updatedPosition, expectedUpdatedLocalPosition);
        expectVectorsToBeEqual(updatedAbsolutePosition, expectedAbsolutePosition);
      });
    });
    describe("With parent", () => {
      test("Setting position updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const parentTransform = createTransform();
        parentTransform.position = new Vector3(5, 10, 15);
        parentTransform.addChild(transform);
        const updatedPosition = new Vector3(10, 20, 30);
        const expectedAbsolutePosition = parentTransform.position.add(updatedPosition);
        const expectedWorldMatrix = worldMatrix({ position: expectedAbsolutePosition });

        // Test
        transform.position = updatedPosition;

        // Assert
        expectVectorsToBeEqual(transform.position, updatedPosition);
        expectVectorsToBeEqual(transform.absolutePosition, expectedAbsolutePosition);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Mutating position updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const parentTransform = createTransform();
        parentTransform.position = new Vector3(5, 10, 15);
        parentTransform.addChild(transform);
        const updatedPositionX = 30;
        const expectedPosition = Vector3.zero().subtract(parentTransform.position).withX(updatedPositionX);
        const expectedAbsolutePosition = parentTransform.position.add(expectedPosition);
        const expectedWorldMatrix = worldMatrix({ position: expectedAbsolutePosition });

        // Test
        transform.position.x = updatedPositionX;

        // Assert
        expectVectorsToBeEqual(transform.position, expectedPosition);
        expectVectorsToBeEqual(transform.absolutePosition, expectedAbsolutePosition);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Setting absolutePosition updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const parentTransform = createTransform();
        parentTransform.position = new Vector3(5, 10, 15);
        parentTransform.addChild(transform);
        const updatedPosition = new Vector3(10, 20, 30);
        const expectedPosition = updatedPosition.subtract(parentTransform.absolutePosition);
        const expectedWorldMatrix = worldMatrix({ position: updatedPosition });

        // Test
        transform.absolutePosition = updatedPosition;

        // Assert
        expectVectorsToBeEqual(transform.position, expectedPosition);
        expectVectorsToBeEqual(transform.absolutePosition, updatedPosition);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Mutating absolutePosition updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const parentTransform = createTransform();
        parentTransform.position = new Vector3(5, 10, 15);
        parentTransform.addChild(transform);
        const updatedPositionX = 30;
        const expectedAbsolutePosition = Vector3.zero().withX(updatedPositionX);
        const expectedPosition = expectedAbsolutePosition.subtract(parentTransform.absolutePosition);
        const expectedWorldMatrix = worldMatrix({ position: expectedAbsolutePosition });

        // Test
        transform.absolutePosition.x = updatedPositionX;

        // Assert
        expectVectorsToBeEqual(transform.position, expectedPosition);
        expectVectorsToBeEqual(transform.absolutePosition, expectedAbsolutePosition);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Modifying a parent's position updates the child's absolutePosition correctly", () => {
        // Setup
        const transform = createTransform();
        const parentTransform = createTransform();
        parentTransform.position = new Vector3(5, 10, 15);
        parentTransform.addChild(transform);
        const offset = new Vector3(10, 20, 30);
        const expectedPosition = Vector3.zero().subtractSelf(parentTransform.position);
        const expectedAbsolutePosition = Vector3.zero().addSelf(offset);

        const initialPosition = transform.position.clone();
        const initialAbsolutePosition = transform.absolutePosition.clone();

        // Test
        parentTransform.position.addSelf(offset);

        const updatedPosition = transform.position.clone();
        const updatedAbsolutePosition = transform.absolutePosition.clone();

        // Assert
        expectVectorsToBeEqual(initialPosition, expectedPosition);
        expectVectorsToBeEqual(initialAbsolutePosition, Vector3.zero());
        expectVectorsToBeEqual(updatedPosition, expectedPosition);
        expectVectorsToBeEqual(updatedAbsolutePosition, expectedAbsolutePosition);
      });
      test("Unparenting a parented Transform updates its position based on absolutePosition", () => {
        // Setup
        const transform = createTransform();
        const expectedAbsolutePosition = new Vector3(10, 20, 30);
        transform.absolutePosition = expectedAbsolutePosition;
        const parentTransform = createTransform();
        parentTransform.position = new Vector3(5, 10, 15);
        parentTransform.addChild(transform);

        const expectedInitialPosition = transform.absolutePosition.subtract(parentTransform.absolutePosition);

        const initialPosition = transform.position.clone();
        const initialAbsolutePosition = transform.absolutePosition.clone();

        // Test
        parentTransform.removeChild(transform);

        const updatedPosition = transform.position.clone();
        const updatedAbsolutePosition = transform.absolutePosition.clone();

        // Assert
        expectVectorsToBeEqual(initialPosition, expectedInitialPosition);
        expectVectorsToBeEqual(initialAbsolutePosition, expectedAbsolutePosition);
        expectVectorsToBeEqual(updatedPosition, expectedAbsolutePosition);
        expectVectorsToBeEqual(updatedAbsolutePosition, expectedAbsolutePosition);
      });
      test("Setting absolutePosition when parent's scale.{x,y,z} is zero is safe", () => {
        // Setup
        const parentScaleTestCases = [
          new Vector3(0.5, 1.1, 0),
          new Vector3(0.5, 0, 1.5),
          new Vector3(0, 1.1, 1.5),
        ];
        parentScaleTestCases.forEach((parentScale) => {
          const transform = createTransform();
          const parentTransform = createTransform();
          parentTransform.scale = parentScale;
          parentTransform.addChild(transform);

          const operand = new Vector3(2, 2, 2);

          // Test
          transform.absolutePosition = operand;

          // Assert
          if (parentScale.x === 0) expect(transform.position.x).toBe(operand.x);
          else expect(transform.position.x).toBe(operand.x / parentScale.x);
          if (parentScale.y === 0) expect(transform.position.y).toBe(operand.y);
          else expect(transform.position.y).toBe(operand.y / parentScale.y);
          if (parentScale.z === 0) expect(transform.position.z).toBe(operand.z);
          else expect(transform.position.z).toBe(operand.z / parentScale.z);
        });
      });
    });
    test("Aliasing position locally and modifying absolutePosition modifies position instance", () => {
      // Setup
      const transform = createTransform();
      const position = transform.position;
      const operand = new Vector3(10, 20, 30);

      // Test
      transform.absolutePosition.addSelf(operand);

      // Assert
      expectVectorsToBeEqual(position, operand);
    });
    test("Aliasing absolutePosition locally and modifying position WILL NOT MODIFY absolutePosition instance", () => {
      // @NOTE This is not "desired" behaviour per-se, but it's a quirk of the observable system.
      // This test exists just to highlight this quirk. If we could "fix" this behaviour, that would be great.
      // But I don't think this is possible under the current architecture.

      // Setup
      const transform = createTransform();
      const absolutePosition = transform.absolutePosition;
      const operand = new Vector3(10, 20, 30);

      const initialAbsolutePositionValue = absolutePosition.clone();

      // Test
      transform.position.addSelf(operand);

      // Assert
      expectVectorsToBeEqual(absolutePosition, initialAbsolutePositionValue);
    });
  });
  describe("Rotation", () => {
    describe("Without Parent", () => {
      test("Mutating rotation updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const updatedRotation = Quaternion.fromAxisAngle(Vector3.up(), 180);
        const expectedWorldMatrix = worldMatrix({ rotation: updatedRotation });

        // Test
        transform.rotation.q.setValue(updatedRotation);

        // Assert
        expectQuaternionsToBeEqual(transform.rotation.q, updatedRotation);
        expectQuaternionsToBeEqual(transform.absoluteRotation.q, updatedRotation);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Mutating absoluteRotation updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const updatedRotation = Quaternion.fromAxisAngle(Vector3.up(), 180);
        const expectedWorldMatrix = worldMatrix({ rotation: updatedRotation });

        // Test
        transform.absoluteRotation.q.setValue(updatedRotation);

        // Assert
        expectQuaternionsToBeEqual(transform.rotation.q, updatedRotation);
        expectQuaternionsToBeEqual(transform.absoluteRotation.q, updatedRotation);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Parenting an initially unparented Transform updates its rotation based on absoluteRotation", () => {
        // Setup
        const transform = createTransform();
        const expectedAbsoluteRotation = Quaternion.fromAxisAngle(Vector3.up(), 30);
        transform.absoluteRotation.q = expectedAbsoluteRotation;
        const parentTransform = createTransform();
        parentTransform.absoluteRotation.q = Quaternion.fromAxisAngle(Vector3.up(), 90);
        const expectedUpdatedLocalRotation = Quaternion.fromAxisAngle(Vector3.up(), -60);

        const initialRotation = transform.rotation.q.clone();
        const initialAbsoluteRotation = transform.absoluteRotation.q.clone();

        // Test
        parentTransform.addChild(transform);

        const updatedRotation = transform.rotation.q.clone();
        const updatedAbsoluteRotation = transform.absoluteRotation.q.clone();

        // Assert
        expectQuaternionsToBeEqual(initialRotation, expectedAbsoluteRotation);
        expectQuaternionsToBeEqual(initialAbsoluteRotation, expectedAbsoluteRotation);
        expectQuaternionsToBeEqual(updatedRotation, expectedUpdatedLocalRotation);
        expectQuaternionsToBeEqual(updatedAbsoluteRotation, expectedAbsoluteRotation);
      });
    });
    describe("With parent", () => {
      test("Mutating rotation updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const parentTransform = createTransform();
        parentTransform.absoluteRotation.q = Quaternion.fromAxisAngle(Vector3.up(), 90);
        parentTransform.addChild(transform);
        const updatedRotation = Quaternion.fromAxisAngle(Vector3.up(), 30);

        const expectedAbsoluteRotation = parentTransform.rotation.q.multiply(updatedRotation);
        const expectedWorldMatrix = worldMatrix({ rotation: expectedAbsoluteRotation });

        // Test
        transform.rotation.q.setValue(updatedRotation);

        // Assert
        expectQuaternionsToBeEqual(transform.rotation.q, updatedRotation);
        expectQuaternionsToBeEqual(transform.absoluteRotation.q, expectedAbsoluteRotation);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Mutating absoluteRotation updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const parentTransform = createTransform();
        parentTransform.absoluteRotation.q = Quaternion.fromAxisAngle(Vector3.up(), 90);
        parentTransform.addChild(transform);
        const updatedRotation = Quaternion.fromAxisAngle(Vector3.up(), 30);
        const expectedRotation = Quaternion.fromAxisAngle(Vector3.up(), -60);
        const expectedWorldMatrix = worldMatrix({ rotation: updatedRotation });

        // Test
        transform.absoluteRotation.q.setValue(updatedRotation);

        // Assert
        expectQuaternionsToBeEqual(transform.rotation.q, expectedRotation);
        expectQuaternionsToBeEqual(transform.absoluteRotation.q, updatedRotation);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Modifying a parent's rotation updates the child's absoluteRotation, absolutePosition correctly", () => {
        // Setup
        const transform = createTransform();
        const parentTransform = createTransform();
        parentTransform.position = new Vector3(5, 10, 15);
        parentTransform.addChild(transform);
        const operand = Quaternion.fromAxisAngle(Vector3.forward(), 90);
        const expectedPosition = Vector3.zero().subtractSelf(parentTransform.position);
        const expectedAbsolutePosition = new Vector3(
          // Look, don't ask how much time I spent thinking about this
          parentTransform.position.x - parentTransform.position.y,
          parentTransform.position.y + parentTransform.position.x,
          0,
        );
        const expectedRotation = Quaternion.identity();
        const expectedAbsoluteRotation = operand.clone();

        const initialPosition = transform.position.clone();
        const initialAbsolutePosition = transform.absolutePosition.clone();
        const initialRotation = transform.rotation.q.clone();
        const initialAbsoluteRotation = transform.absoluteRotation.q.clone();

        // Test
        parentTransform.rotation.multiply(operand);

        const updatedPosition = transform.position.clone();
        const updatedAbsolutePosition = transform.absolutePosition.clone();
        const updatedRotation = transform.rotation.q.clone();
        const updatedAbsoluteRotation = transform.absoluteRotation.q.clone();

        // Assert
        expectVectorsToBeEqual(initialPosition, expectedPosition);
        expectVectorsToBeEqual(initialAbsolutePosition, Vector3.zero());
        expectVectorsToBeEqual(updatedPosition, expectedPosition);
        expectVectorsToBeEqual(updatedAbsolutePosition, expectedAbsolutePosition);

        expectQuaternionsToBeEqual(initialRotation, expectedRotation);
        expectQuaternionsToBeEqual(initialAbsoluteRotation, Quaternion.identity());
        expectQuaternionsToBeEqual(updatedRotation, expectedRotation);
        expectQuaternionsToBeEqual(updatedAbsoluteRotation, expectedAbsoluteRotation);
      });
      test("Unparenting a parented Transform updates its rotation based on absoluteRotation", () => {
        // Setup
        const transform = createTransform();
        const expectedAbsoluteRotation = Quaternion.fromAxisAngle(Vector3.up(), 30);
        transform.absoluteRotation.q = expectedAbsoluteRotation;
        const parentTransform = createTransform();
        parentTransform.rotation.q = Quaternion.fromAxisAngle(Vector3.up(), 90);
        parentTransform.addChild(transform);

        const expectedInitialRotation = Quaternion.fromAxisAngle(Vector3.up(), -60);

        const initialRotation = transform.rotation.q.clone();
        const initialAbsoluteRotation = transform.absoluteRotation.q.clone();

        // Test
        parentTransform.removeChild(transform);

        const updatedRotation = transform.rotation.q.clone();
        const updatedAbsoluteRotation = transform.absoluteRotation.q.clone();

        // Assert
        expectQuaternionsToBeEqual(initialRotation, expectedInitialRotation);
        expectQuaternionsToBeEqual(initialAbsoluteRotation, expectedAbsoluteRotation);
        expectQuaternionsToBeEqual(updatedRotation, expectedAbsoluteRotation);
        expectQuaternionsToBeEqual(updatedAbsoluteRotation, expectedAbsoluteRotation);
      });
    });
    test("Aliasing rotation locally and modifying absoluteRotation modifies rotation instance", () => {
      // Setup
      const transform = createTransform();
      const rotation = transform.rotation.q;
      const operand = Quaternion.fromAxisAngle(Vector3.up(), 20);

      // Test
      transform.absoluteRotation.q.multiplySelf(operand);

      // Assert
      expectQuaternionsToBeEqual(rotation, operand);
    });
    test("Aliasing absoluteRotation locally and modifying rotation WILL NOT MODIFY absoluteRotation instance", () => {
      // @NOTE This is not "desired" behaviour per-se, but it's a quirk of the observable system.
      // This test exists just to highlight this quirk. If we could "fix" this behaviour, that would be great.
      // But I don't think this is possible under the current architecture.

      // Setup
      const transform = createTransform();
      const absoluteRotation = transform.absoluteRotation.q;
      const operand = Quaternion.fromAxisAngle(Vector3.up(), 20);

      const initialAbsoluteRotationValue = absoluteRotation.clone();

      // Test
      transform.rotation.q.multiplySelf(operand);

      // Assert
      expectQuaternionsToBeEqual(absoluteRotation, initialAbsoluteRotationValue);
    });
  });
  describe("Scale", () => {
    describe("Without Parent", () => {
      test("Setting scale updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const updatedScale = new Vector3(1.1, 1.2, 1.3);
        const expectedWorldMatrix = worldMatrix({ scale: updatedScale });

        // Test
        transform.scale = updatedScale;

        // Assert
        expectVectorsToBeEqual(transform.scale, updatedScale);
        expectVectorsToBeEqual(transform.absoluteScale, updatedScale);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Mutating scale updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const updatedScaleX = 1.5;
        const expectedScale = Vector3.one().withX(updatedScaleX);
        const expectedWorldMatrix = worldMatrix({ scale: expectedScale });

        // Test
        transform.scale.x = updatedScaleX;

        // Assert
        expectVectorsToBeEqual(transform.scale, expectedScale);
        expectVectorsToBeEqual(transform.absoluteScale, expectedScale);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Setting absoluteScale updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const updatedScale = new Vector3(1.1, 1.2, 1.3);
        const expectedWorldMatrix = worldMatrix({ scale: updatedScale });

        // Test
        transform.absoluteScale = updatedScale;

        // Assert
        expectVectorsToBeEqual(transform.scale, updatedScale);
        expectVectorsToBeEqual(transform.absoluteScale, updatedScale);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Mutating absoluteScale updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const updatedScaleX = 1.3;
        const expectedScale = Vector3.one().withX(updatedScaleX);
        const expectedWorldMatrix = worldMatrix({ scale: expectedScale });

        // Test
        transform.absoluteScale.x = updatedScaleX;

        // Assert
        expectVectorsToBeEqual(transform.scale, expectedScale);
        expectVectorsToBeEqual(transform.absoluteScale, expectedScale);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Parenting an initially unparented Transform updates its scale based on absoluteScale", () => {
        // Setup
        const transform = createTransform();
        const expectedAbsoluteScale = new Vector3(1.1, 1.2, 1.3);
        transform.absoluteScale = expectedAbsoluteScale;
        const parentTransform = createTransform();
        parentTransform.absoluteScale = new Vector3(0.5, 1, 1.5);
        const expectedUpdatedLocalScale = expectedAbsoluteScale.divide(parentTransform.absoluteScale);

        const initialScale = transform.scale.clone();
        const initialAbsoluteScale = transform.absoluteScale.clone();

        // Test
        parentTransform.addChild(transform);

        const updatedScale = transform.scale.clone();
        const updatedAbsoluteScale = transform.absoluteScale.clone();

        // Assert
        expectVectorsToBeEqual(initialScale, expectedAbsoluteScale);
        expectVectorsToBeEqual(initialAbsoluteScale, expectedAbsoluteScale);
        expectVectorsToBeEqual(updatedScale, expectedUpdatedLocalScale);
        expectVectorsToBeEqual(updatedAbsoluteScale, expectedAbsoluteScale);
      });
    });
    describe("With parent", () => {
      test("Setting scale updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const parentTransform = createTransform();
        parentTransform.scale = new Vector3(0.5, 1.0, 1.5);
        parentTransform.addChild(transform);
        const updatedScale = new Vector3(1.1, 1.2, 1.3);
        const expectedAbsoluteScale = parentTransform.scale.multiply(updatedScale);
        const expectedWorldMatrix = worldMatrix({ scale: expectedAbsoluteScale });

        // Test
        transform.scale = updatedScale;

        // Assert
        expectVectorsToBeEqual(transform.scale, updatedScale);
        expectVectorsToBeEqual(transform.absoluteScale, expectedAbsoluteScale);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Mutating scale updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const parentTransform = createTransform();
        parentTransform.scale = new Vector3(0.5, 1.0, 1.5);
        parentTransform.addChild(transform);
        const updatedScaleX = 30;
        const expectedScale = Vector3.one().divide(parentTransform.scale).withX(updatedScaleX);
        const expectedAbsoluteScale = parentTransform.scale.multiply(expectedScale);
        const expectedWorldMatrix = worldMatrix({ scale: expectedAbsoluteScale });

        // Test
        transform.scale.x = updatedScaleX;

        // Assert
        expectVectorsToBeEqual(transform.scale, expectedScale);
        expectVectorsToBeEqual(transform.absoluteScale, expectedAbsoluteScale);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Setting absoluteScale updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const parentTransform = createTransform();
        parentTransform.scale = new Vector3(0.5, 1.0, 1.5);
        parentTransform.addChild(transform);
        const updatedScale = new Vector3(1.1, 1.2, 1.3);
        const expectedScale = updatedScale.divide(parentTransform.absoluteScale);
        const expectedWorldMatrix = worldMatrix({ scale: updatedScale });

        // Test
        transform.absoluteScale = updatedScale;

        // Assert
        expectVectorsToBeEqual(transform.scale, expectedScale);
        expectVectorsToBeEqual(transform.absoluteScale, updatedScale);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Mutating absoluteScale updates state correctly", () => {
        // Setup
        const transform = createTransform();
        const parentTransform = createTransform();
        parentTransform.scale = new Vector3(0.5, 1.0, 1.5);
        parentTransform.addChild(transform);
        const updatedScaleX = 30;
        const expectedAbsoluteScale = Vector3.one().withX(updatedScaleX);
        const expectedScale = expectedAbsoluteScale.divide(parentTransform.absoluteScale);
        const expectedWorldMatrix = worldMatrix({ scale: expectedAbsoluteScale });

        // Test
        transform.absoluteScale.x = updatedScaleX;

        // Assert
        expectVectorsToBeEqual(transform.scale, expectedScale);
        expectVectorsToBeEqual(transform.absoluteScale, expectedAbsoluteScale);
        expect(transform.worldMatrix).toEqual(expectedWorldMatrix);
      });
      test("Modifying a parent's scale updates the child's absoluteScale, absolutePosition correctly", () => {
        // Setup
        const transform = createTransform();
        const parentTransform = createTransform();
        parentTransform.position = new Vector3(0.5, 1.0, 1.5);
        parentTransform.addChild(transform);
        const operand = new Vector3(0.3, 0.4, 0.5);
        const expectedPosition = Vector3.zero().subtractSelf(parentTransform.position);
        const expectedAbsolutePosition = new Vector3(
          lerp(0, parentTransform.position.x, 1 - operand.x),
          lerp(0, parentTransform.position.y, 1 - operand.y),
          lerp(0, parentTransform.position.z, 1 - operand.z),
        );
        const expectedScale = Vector3.one();
        const expectedAbsoluteScale = operand.clone();

        const initialPosition = transform.position.clone();
        const initialAbsolutePosition = transform.absolutePosition.clone();
        const initialScale = transform.scale.clone();
        const initialAbsoluteScale = transform.absoluteScale.clone();

        // Test
        parentTransform.scale.multiplySelf(operand);

        const updatedPosition = transform.position.clone();
        const updatedAbsolutePosition = transform.absolutePosition.clone();
        const updatedScale = transform.scale.clone();
        const updatedAbsoluteScale = transform.absoluteScale.clone();

        // Assert
        expectVectorsToBeEqual(initialPosition, expectedPosition);
        expectVectorsToBeEqual(initialAbsolutePosition, Vector3.zero());
        expectVectorsToBeEqual(updatedPosition, expectedPosition);
        expectVectorsToBeEqual(updatedAbsolutePosition, expectedAbsolutePosition);

        expectVectorsToBeEqual(initialScale, expectedScale);
        expectVectorsToBeEqual(initialAbsoluteScale, Vector3.one());
        expectVectorsToBeEqual(updatedScale, expectedScale);
        expectVectorsToBeEqual(updatedAbsoluteScale, expectedAbsoluteScale);
      });
      test("Unparenting a parented Transform updates its scale based on absoluteScale", () => {
        // Setup
        const transform = createTransform();
        const expectedAbsoluteScale = new Vector3(1.1, 1.2, 1.3);
        transform.absoluteScale = expectedAbsoluteScale;
        const parentTransform = createTransform();
        parentTransform.scale = new Vector3(0.5, 1.0, 1.5);
        parentTransform.addChild(transform);

        const expectedInitialScale = transform.absoluteScale.divide(parentTransform.absoluteScale);

        const initialScale = transform.scale.clone();
        const initialAbsoluteScale = transform.absoluteScale.clone();

        // Test
        parentTransform.removeChild(transform);

        const updatedScale = transform.scale.clone();
        const updatedAbsoluteScale = transform.absoluteScale.clone();

        // Assert
        expectVectorsToBeEqual(initialScale, expectedInitialScale);
        expectVectorsToBeEqual(initialAbsoluteScale, expectedAbsoluteScale);
        expectVectorsToBeEqual(updatedScale, expectedAbsoluteScale);
        expectVectorsToBeEqual(updatedAbsoluteScale, expectedAbsoluteScale);
      });
      test("Setting absoluteScale when parent's scale.{x,y,z} is zero is safe", () => {
        // Setup
        const parentScaleTestCases = [
          new Vector3(0.5, 1.1, 0),
          new Vector3(0.5, 0, 1.5),
          new Vector3(0, 1.1, 1.5),
        ];
        parentScaleTestCases.forEach((parentScale) => {
          const transform = createTransform();
          const parentTransform = createTransform();
          parentTransform.scale = parentScale;
          parentTransform.addChild(transform);

          const operand = new Vector3(2, 2, 2);

          // Test
          transform.absoluteScale = operand;

          // Assert
          if (parentScale.x === 0) expect(transform.scale.x).toBe(1);
          else expect(transform.scale.x).toBe(operand.x / parentScale.x);
          if (parentScale.y === 0) expect(transform.scale.y).toBe(1);
          else expect(transform.scale.y).toBe(operand.y / parentScale.y);
          if (parentScale.z === 0) expect(transform.scale.z).toBe(1);
          else expect(transform.scale.z).toBe(operand.z / parentScale.z);
        });
      });
    });
    test("Aliasing scale locally and modifying absoluteScale modifies scale instance", () => {
      // Setup
      const transform = createTransform();
      const scale = transform.scale;
      const operand = new Vector3(1.1, 1.2, 1.3);

      // Test
      transform.absoluteScale.multiplySelf(operand);

      // Assert
      expectVectorsToBeEqual(scale, operand);
    });
    test("Aliasing absoluteScale locally and modifying scale WILL NOT MODIFY absoluteScale instance", () => {
      // @NOTE This is not "desired" behaviour per-se, but it's a quirk of the observable system.
      // This test exists just to highlight this quirk. If we could "fix" this behaviour, that would be great.
      // But I don't think this is possible under the current architecture.

      // Setup
      const transform = createTransform();
      const absoluteScale = transform.absoluteScale;
      const operand = new Vector3(10, 20, 30);

      const initialAbsoluteScaleValue = absoluteScale.clone();

      // Test
      transform.scale.multiplySelf(operand);

      // Assert
      expectVectorsToBeEqual(absoluteScale, initialAbsoluteScaleValue);
    });
  });
  describe("Children", () => {
    test("Adding a child to a Transform adds it to the list of children, sets child's parent", () => {
      // Setup
      const transform = createTransform();
      const childTransform = createTransform();

      const initialTransformIncludesChild = transform.children.includes(childTransform);
      const initialNumChildren = transform.children.length;
      const initialChildParent = childTransform.parent;

      // Test
      transform.addChild(childTransform);

      const updatedTransformIncludesChild = transform.children.includes(childTransform);
      const updatedNumChildren = transform.children.length;
      const updatedChildParent = childTransform.parent;

      // Assert
      expect(initialTransformIncludesChild).toBe(false);
      expect(initialNumChildren).toBe(0);
      expect(initialChildParent).toBeUndefined();

      expect(updatedTransformIncludesChild).toBe(true);
      expect(updatedNumChildren).toBe(1);
      expect(updatedChildParent).toBe(transform);
    });
    test("Attempting to add a child that is already a child of another Transform throws an error", () => {
      // Setup
      const transform = createTransform();
      const childTransform = createTransform();
      const otherTransform = createTransform();
      otherTransform.addChild(childTransform);

      // Test
      const testFunc = (): void => {
        transform.addChild(childTransform);
      };

      // Assert
      expect(testFunc).toThrowError("It is already the child of another transform");
    });
    test("Attempting to re-add a child that is already a child of the target Transform is a no-op", () => {
      // Setup
      const transform = createTransform();
      const childTransform = createTransform();
      transform.addChild(childTransform);

      const initialTransformIncludesChild = transform.children.includes(childTransform);
      const initialNumChildren = transform.children.length;
      const initialChildParent = childTransform.parent;

      // Test
      transform.addChild(childTransform);

      const updatedTransformIncludesChild = transform.children.includes(childTransform);
      const updatedNumChildren = transform.children.length;
      const updatedChildParent = childTransform.parent;

      // Assert
      expect(initialTransformIncludesChild).toBe(true);
      expect(initialNumChildren).toBe(1);
      expect(initialChildParent).toBe(transform);

      expect(updatedTransformIncludesChild).toBe(true);
      expect(updatedNumChildren).toBe(1);
      expect(updatedChildParent).toBe(transform);
    });
    test("Removing a child from a Transform removes it from the list of children, unsets child's parent", () => {
      // Setup
      const transform = createTransform();
      const childTransform = createTransform();
      transform.addChild(childTransform);

      const initialTransformIncludesChild = transform.children.includes(childTransform);
      const initialNumChildren = transform.children.length;
      const initialChildParent = childTransform.parent;

      // Test
      transform.removeChild(childTransform);

      const updatedTransformIncludesChild = transform.children.includes(childTransform);
      const updatedNumChildren = transform.children.length;
      const updatedChildParent = childTransform.parent;

      // Assert
      expect(initialTransformIncludesChild).toBe(true);
      expect(initialNumChildren).toBe(1);
      expect(initialChildParent).toBe(transform);

      expect(updatedTransformIncludesChild).toBe(false);
      expect(updatedNumChildren).toBe(0);
      expect(updatedChildParent).toBeUndefined();
    });
    test("Attempting to remove a Transform that is not a child of the target Transform is a no-op", () => {
      // Setup
      const transform = createTransform();
      const childTransform = createTransform();
      const otherTransform = createTransform();
      otherTransform.addChild(childTransform);

      const initialTransformIncludesChild = transform.children.includes(childTransform);
      const initialNumChildren = transform.children.length;
      const initialChildParent = childTransform.parent;

      // Test
      transform.removeChild(childTransform);

      const updatedTransformIncludesChild = transform.children.includes(childTransform);
      const updatedNumChildren = transform.children.length;
      const updatedChildParent = childTransform.parent;

      // Assert
      expect(initialTransformIncludesChild).toBe(false);
      expect(initialNumChildren).toBe(0);
      expect(initialChildParent).toBe(otherTransform);

      expect(updatedTransformIncludesChild).toBe(false);
      expect(updatedNumChildren).toBe(0);
      expect(updatedChildParent).toBe(otherTransform);
    });
    test("Calling forEachChild() iterates the entire hierarchy of Transforms", () => {
      // Setup
      const transform = createTransform(new Widget('transform'));
      const left = createTransform(new Widget('left'));
      transform.addChild(left);
      const leftA = createTransform(new Widget('leftA'));
      left.addChild(leftA);
      const right = createTransform(new Widget('right'));
      transform.addChild(right);
      const rightA = createTransform(new Widget('rightA'));
      const rightB = createTransform(new Widget('rightB'));
      right.addChild(rightA);
      right.addChild(rightB);

      const expectedResults = [
        left, leftA, right, rightA, rightB,
      ];

      // Test
      const results: Transform<Widget>[] = [];
      transform.forEachChild((child) => {
        results.push(child);
      });

      // Assert
      // @NOTE test the results mapped to the widget names for easier
      // debugging if this test ever breaks.
      const mapToName = (results: Transform<Widget>[]): string[] => {
        return results.map((result) => result.node.name);
      };
      expect(mapToName(results)).toEqual(mapToName(expectedResults));
    });
  });
  describe("World Matrix", () => {
    test("Updating position updates world matrix", () => {
      // Setup
      const transform = createTransform();
      const updatedPosition = new Vector3(10, 20, 30);
      const expectedResult = Matrix4.fromRotationTranslationScale(
        Quaternion.identity(),
        updatedPosition,
        Vector3.one(),
      );

      const initialWorldMatrix = transform.worldMatrix.clone();

      // Test
      transform.position = updatedPosition;

      const updatedWorldMatrix = transform.worldMatrix.clone();

      // Assert
      expectMatrix4sToBeEqual(initialWorldMatrix, new Matrix4());
      expectMatrix4sToBeEqual(updatedWorldMatrix, expectedResult);
    });
    test("Updating rotation updates world matrix", () => {
      // Setup
      const transform = createTransform();
      const updatedRotation = Quaternion.fromEuler(new Vector3(10, 20, 30));
      const expectedResult = Matrix4.fromRotationTranslationScale(
        updatedRotation,
        Vector3.zero(),
        Vector3.one(),
      );

      const initialWorldMatrix = transform.worldMatrix.clone();

      // Test
      transform.rotation.q = updatedRotation;

      const updatedWorldMatrix = transform.worldMatrix.clone();

      // Assert
      expectMatrix4sToBeEqual(initialWorldMatrix, new Matrix4());
      expectMatrix4sToBeEqual(updatedWorldMatrix, expectedResult);
    });
    test("Updating scale updates world matrix", () => {
      // Setup
      const transform = createTransform();
      const updatedScale = new Vector3(1.1, 1.2, 1.3);
      const expectedResult = Matrix4.fromRotationTranslationScale(
        Quaternion.identity(),
        Vector3.zero(),
        updatedScale,
      );

      const initialWorldMatrix = transform.worldMatrix.clone();

      // Test
      transform.scale = updatedScale;

      const updatedWorldMatrix = transform.worldMatrix.clone();

      // Assert
      expectMatrix4sToBeEqual(initialWorldMatrix, new Matrix4());
      expectMatrix4sToBeEqual(updatedWorldMatrix, expectedResult);
    });
  });
});

class Widget {
  public readonly name: string;

  public constructor(name?: string) {
    this.name = `Widget-${name ?? Math.trunc(Math.random() * 9_000 + 1000)}`;
  }
}

function createTransform(widget?: Widget): Transform<Widget> {
  return new Transform(widget ?? new Widget());
}

function worldMatrix({
  position, rotation, scale,
}: {
  position?: Vector3,
  rotation?: Quaternion,
  scale?: Vector3,
}): Matrix4 {
  return Matrix4.fromRotationTranslationScale(
    rotation ?? Quaternion.identity(),
    position ?? Vector3.zero(),
    scale ?? Vector3.one(),
  );
}

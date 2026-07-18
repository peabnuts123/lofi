import { describe, test, expect } from 'vitest';
import { ModelPartGeometry } from './ModelPartGeometry';
import { MeshPrimitiveCache } from '../MeshPrimitiveCache';
import { MockEngine } from '@test/mock/MockEngine';
import { createMockMeshPrimitiveDefinition } from './MeshPrimitiveGeometry.test';
import { Computed } from '@lofi/core/util/Computed';
import { Matrix4, Quaternion, Vector3 } from '@lofi/core/math';
import { expectVectorArraysToBeEqual } from '@test/util/expect';

/*
  @TODO Test backlog
    - Vertex positions
      - With skin
        - Modifying primitive vertex positions causes values to recompute correctly
        - Modifying localMatrix has no effect on skinned primitives
        - Modifying joint indices causes values to recompute correctly
        - Modifying joint weights causes values to recompute correctly
        - Modifying skin joint matrices causes values to recompute correctly
      - Without skin
        - Modifying joint indices has no effect on unskinned primitives
        - Modifying joint weights has no effect on unskinned primitives
        - Modifying skin joint matrices has no effect on unskinned primitives
    - Vertex normals
      - With skin
        - Modifying primitive vertex normals causes values to recompute correctly
        - Modifying localMatrix has no effect on skinned primitives
        - Modifying joint indices causes values to recompute correctly
        - Modifying joint weights causes values to recompute correctly
        - Modifying skin joint matrices causes values to recompute correctly
      - Without skin
        - Modifying joint indices has no effect on unskinned primitives
        - Modifying joint weights has no effect on unskinned primitives
        - Modifying skin joint matrices has no effect on unskinned primitives
    - Triangles
      - Modifying primitive vertex positions causes values to recompute correctly
      - Modifying primitive indices causes values to recompute correctly
    - Triangle normals
      - Modifying primitive vertex positions causes values to recompute correctly
      - Modifying primitive indices causes values to recompute correctly
    - Edge indices
      - Modifying primitive indices causes values to recompute correctly
    - Edges
      - Modifying primitive vertex positions causes values to recompute correctly
      - Modifying primitive indices causes values to recompute correctly
    - Colors
      - Modifying primitive colors causes values to recompute correctly
    - Texture coordinates
      - Modifying primitive texture coordinates causes values to recompute correctly
    - AABB
      - Modifying primitive vertex positions causes values to recompute correctly
    - Approximate AABB
      - Is correct based on mesh primitive extents
 */

describe(ModelPartGeometry.name, () => {
  describe("Vertex positions", () => {
    describe("Without skin", () => {
      test("Modifying primitive vertex positions causes values to recompute correctly", () => {
        // Setup
        const mockEngine = new MockEngine();
        const primitiveCaches = [
          new MeshPrimitiveCache(mockEngine, createMockMeshPrimitiveDefinition()),
        ];
        const offset = new Vector3(1, 2, 3);
        const expectedInitialValues = primitiveCaches.flatMap((primitiveCache) => primitiveCache.geometry.vertexPositions.map((vertexPosition) => vertexPosition.clone()));
        const expectedUpdatedValues = expectedInitialValues.map((vertexPosition) => vertexPosition.add(offset));
        const localMatrixInternal = Matrix4.identity();
        const localMatrixComputed = new Computed(new Matrix4(), {
          dependencies: [localMatrixInternal],
          recompute: (self) => {
            self.setValue(localMatrixInternal);
          },
        });
        const geometry = new ModelPartGeometry({
          primitiveCaches,
          localMatrixComputed,
          skinJointMatricesComputed: undefined,
        });
        const actualInitialValues = geometry.allVertexPositions.map((vertexPosition) => vertexPosition.clone());

        // Test
        const beforeMutationComputedIsDirty = geometry.allVertexPositionsComputed['isDirty'];
        primitiveCaches.forEach((primitiveCache) => {
          primitiveCache.geometry.mutate((geometry) => {
            geometry.vertexPositions.forEach((vertexPosition) => vertexPosition.addSelf(offset));
          });
        });
        const afterMutationComputedIsDirty = geometry.allVertexPositionsComputed['isDirty'];
        const actualUpdatedValues = geometry.allVertexPositions.map((vertexPosition) => vertexPosition.clone());

        // Assert
        expectVectorArraysToBeEqual(actualInitialValues, expectedInitialValues);
        expectVectorArraysToBeEqual(actualUpdatedValues, expectedUpdatedValues);
        expect(beforeMutationComputedIsDirty).toBe(false);
        expect(afterMutationComputedIsDirty).toBe(true);
      });
      test("Modifying localMatrix causes values to recompute correctly", () => {
        // Setup
        const mockEngine = new MockEngine();
        const primitiveCaches = [
          new MeshPrimitiveCache(mockEngine, createMockMeshPrimitiveDefinition()),
        ];
        const offset = new Vector3(1, 2, 3);
        const expectedInitialValues = primitiveCaches.flatMap((primitiveCache) => primitiveCache.geometry.vertexPositions.map((vertexPosition) => vertexPosition.clone()));
        const expectedUpdatedValues = expectedInitialValues.map((vertexPosition) => vertexPosition.add(offset));
        const localMatrixInternal = Matrix4.identity();
        const localMatrixComputed = new Computed(new Matrix4(), {
          dependencies: [localMatrixInternal],
          recompute: (self) => {
            self.setValue(localMatrixInternal);
          },
        });
        const geometry = new ModelPartGeometry({
          primitiveCaches,
          localMatrixComputed,
          skinJointMatricesComputed: undefined,
        });
        const actualInitialValues = geometry.allVertexPositions.map((vertexPosition) => vertexPosition.clone());

        // Test
        const beforeMutationComputedIsDirty = geometry.allVertexPositionsComputed['isDirty'];
        localMatrixInternal.fromRotationTranslationScaleSelf(
          Quaternion.identity(),
          offset,
          Vector3.one(),
        );
        const afterMutationComputedIsDirty = geometry.allVertexPositionsComputed['isDirty'];
        const actualUpdatedValues = geometry.allVertexPositions.map((vertexPosition) => vertexPosition.clone());

        // Assert
        expectVectorArraysToBeEqual(actualInitialValues, expectedInitialValues);
        expectVectorArraysToBeEqual(actualUpdatedValues, expectedUpdatedValues);
        expect(beforeMutationComputedIsDirty).toBe(false);
        expect(afterMutationComputedIsDirty).toBe(true);
      });
    });
  });
  describe("Vertex normals", () => {
    describe("Without skin", () => {
      test("Modifying primitive vertex normals causes values to recompute correctly", () => {
        // Setup
        const mockEngine = new MockEngine();
        const primitiveCaches = [
          new MeshPrimitiveCache(mockEngine, createMockMeshPrimitiveDefinition()),
        ];
        const transform = Quaternion.fromAxisAngle(Vector3.forward(), 45);
        const expectedInitialValues = primitiveCaches.flatMap((primitiveCache) => primitiveCache.geometry.vertexNormals.map((vertexNormal) => vertexNormal.clone()));
        const expectedUpdatedValues = expectedInitialValues.map((vertexNormal) => transform.rotateVector(vertexNormal));
        const localMatrixInternal = Matrix4.identity();
        const localMatrixComputed = new Computed(new Matrix4(), {
          dependencies: [localMatrixInternal],
          recompute: (self) => {
            self.setValue(localMatrixInternal);
          },
        });
        const geometry = new ModelPartGeometry({
          primitiveCaches,
          localMatrixComputed,
          skinJointMatricesComputed: undefined,
        });
        const actualInitialValues = geometry.allVertexNormals.map((vertexNormal) => vertexNormal.clone());

        // Test
        const beforeMutationComputedIsDirty = geometry.allVertexNormalsComputed['isDirty'];
        primitiveCaches.forEach((primitiveCache) => {
          primitiveCache.geometry.mutate((geometry) => {
            geometry.vertexNormals.forEach((vertexNormal) => transform.rotateVectorInPlace(vertexNormal));
          });
        });
        const afterMutationComputedIsDirty = geometry.allVertexNormalsComputed['isDirty'];
        const actualUpdatedValues = geometry.allVertexNormals.map((vertexNormal) => vertexNormal.clone());

        // Assert
        expectVectorArraysToBeEqual(actualInitialValues, expectedInitialValues);
        expectVectorArraysToBeEqual(actualUpdatedValues, expectedUpdatedValues);
        expect(beforeMutationComputedIsDirty).toBe(false);
        expect(afterMutationComputedIsDirty).toBe(true);
      });
      test("Modifying localMatrix causes values to recompute correctly", () => {
        // Setup
        const mockEngine = new MockEngine();
        const primitiveCaches = [
          new MeshPrimitiveCache(mockEngine, createMockMeshPrimitiveDefinition()),
        ];
        const transform = Quaternion.fromAxisAngle(Vector3.forward(), 45);
        const expectedInitialValues = primitiveCaches.flatMap((primitiveCache) => primitiveCache.geometry.vertexNormals.map((vertexNormal) => vertexNormal.clone()));
        const expectedUpdatedValues = expectedInitialValues.map((vertexNormal) => transform.rotateVector(vertexNormal));
        const localMatrixInternal = Matrix4.identity();
        const localMatrixComputed = new Computed(new Matrix4(), {
          dependencies: [localMatrixInternal],
          recompute: (self) => {
            self.setValue(localMatrixInternal);
          },
        });
        const geometry = new ModelPartGeometry({
          primitiveCaches,
          localMatrixComputed,
          skinJointMatricesComputed: undefined,
        });
        const actualInitialValues = geometry.allVertexNormals.map((vertexNormal) => vertexNormal.clone());

        // Test
        const beforeMutationComputedIsDirty = geometry.allVertexNormalsComputed['isDirty'];
        localMatrixInternal.fromRotationTranslationScaleSelf(
          transform,
          Vector3.zero(),
          Vector3.one(),
        );
        const afterMutationComputedIsDirty = geometry.allVertexNormalsComputed['isDirty'];
        const actualUpdatedValues = geometry.allVertexNormals.map((vertexNormal) => vertexNormal.clone());

        // Assert
        expectVectorArraysToBeEqual(actualInitialValues, expectedInitialValues);
        expectVectorArraysToBeEqual(actualUpdatedValues, expectedUpdatedValues);
        expect(beforeMutationComputedIsDirty).toBe(false);
        expect(afterMutationComputedIsDirty).toBe(true);
      });
    });
  });
  describe("Triangle indices", () => {
    test("Modifying primitive indices causes values to recompute correctly", () => {
      // Setup
      const mockEngine = new MockEngine();
      const primitiveCaches = [
        new MeshPrimitiveCache(mockEngine, createMockMeshPrimitiveDefinition()),
      ];
      const expectedInitialValues = primitiveCaches.flatMap((primitiveCache) => primitiveCache.geometry.triangleIndices.map((triangleIndices) => triangleIndices.clone()));
      const expectedUpdatedValues = expectedInitialValues.map((triangleIndices) => triangleIndices.clone().setValue(0, triangleIndices.bIndex, triangleIndices.cIndex));
      const localMatrixComputed = new Computed(new Matrix4(), {
        dependencies: [],
        recompute: (self) => self.identitySelf(),
      });
      const geometry = new ModelPartGeometry({
        primitiveCaches,
        localMatrixComputed,
        skinJointMatricesComputed: undefined,
      });
      const actualInitialValues = geometry.allTriangleIndices.map((triangleIndices) => triangleIndices.clone());

      // Test
      const beforeMutationComputedIsDirty = geometry.allTriangleIndicesComputed['isDirty'];
      primitiveCaches.forEach((primitiveCache) => {
        primitiveCache.geometry.mutate((geometry) => {
          geometry.triangleIndices.forEach((triangleIndices) => triangleIndices.aIndex = 0);
        });
      });
      const afterMutationComputedIsDirty = geometry.allTriangleIndicesComputed['isDirty'];
      const actualUpdatedValues = geometry.allTriangleIndices.map((triangleIndices) => triangleIndices.clone());

      // Assert
      expect(actualInitialValues.length).toBe(expectedInitialValues.length);
      expect(actualUpdatedValues.length).toBe(expectedUpdatedValues.length);
      actualInitialValues.forEach((triangleIndices, i) => {
        expect(triangleIndices.aIndex, `Triangle indices initial value at index ${i} 'aIndex' should match`).toEqual(expectedInitialValues[i].aIndex);
        expect(triangleIndices.bIndex, `Triangle indices initial value at index ${i} 'bIndex' should match`).toEqual(expectedInitialValues[i].bIndex);
        expect(triangleIndices.cIndex, `Triangle indices initial value at index ${i} 'cIndex' should match`).toEqual(expectedInitialValues[i].cIndex);
      });
      actualUpdatedValues.forEach((triangleIndices, i) => {
        expect(triangleIndices.aIndex, `Triangle indices updated value at index ${i} 'aIndex' should match`).toEqual(expectedInitialValues[i].aIndex);
        expect(triangleIndices.bIndex, `Triangle indices updated value at index ${i} 'bIndex' should match`).toEqual(expectedInitialValues[i].bIndex);
        expect(triangleIndices.cIndex, `Triangle indices updated value at index ${i} 'cIndex' should match`).toEqual(expectedInitialValues[i].cIndex);
      });
      expect(beforeMutationComputedIsDirty).toBe(false);
      expect(afterMutationComputedIsDirty).toBe(true);
    });
  });
});

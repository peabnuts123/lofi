import { describe, expect, test } from 'vitest';
import { MeshPrimitiveGeometry } from './MeshPrimitiveGeometry';
import { MockEngine } from '@test/mock/MockEngine';
import { AccessorComponentType, MeshPrimitiveMode, type MeshPrimitiveDefinition } from '@lofi/engine/loaders/definitions';
import { Color3, Color4, Vector2, Vector3 } from '@lofi/core/math';
import { expectVectorArraysToBeEqual } from '@test/util/expect';
import { AxisAlignedBoundingBox } from '@lofi/engine/collision/AxisAlignedBoundingBox';
import { JointIndices, JointWeights, TriangleIndices } from '.';

/*
  @TODO Test backlog
    - Computed properties
      - Triangles contain correct data
      - Mutating vertex positions causes triangles to recompute
      - Mutating triangle indices causes triangles to recompute
      - Edge indices are correct
      - Mutating triangle indices causes edge indices to recompute
      - Mutating vertex positions causes edges to recompute
      - Mutating triangle indices causes edges to recompute
      - Edges are correct
    - Invalid geometry
      - Out of bounds triangle index
      - Position attribute with incorrect componentCount
      - Indices attribute with incorrect componentCount
      - Joint indices attribute with incorrect componentCount
      - Joint weights attribute with incorrect componentCount
      - Color attribute with incorrect componentCount
      - Texture coordinates attribute with incorrect componentCount
    - Mutating frozen collections makes no changes (e.g. vertexPositions[1] = Vector3.one(), push(), etc.)
    - normalizeValue() and denormalizeValue() compute the correct values
 */

describe(MeshPrimitiveGeometry.name, () => {
  describe("Attribute parsing", () => {
    test("Positions (type=FLOAT) (normalized=false)", () => {
      // Setup
      const engine = new MockEngine();
      const mockVertices = [
        new Vector3(0, 0, 0),
        new Vector3(1, 2, 3),
        new Vector3(-1, -2, -3),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        positionData: {
          componentCount: 3,
          componentSize: 4,
          componentType: AccessorComponentType.FLOAT,
          normalized: false,
          buffer: new Float32Array(toBuffer(mockVertices, (vertex) => [vertex.x, vertex.y, vertex.z])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      expectVectorArraysToBeEqual(geometry.vertexPositions, mockVertices);
      expect(geometry.positionAttribute.componentCount).toBe(mockMeshPrimitiveDefinition.positionData.componentCount);
      expect(geometry.positionAttribute.componentSize).toBe(mockMeshPrimitiveDefinition.positionData.componentSize);
      expect(geometry.positionAttribute.componentType).toBe(mockMeshPrimitiveDefinition.positionData.componentType);
      expect(geometry.positionAttribute.normalized).toBe(mockMeshPrimitiveDefinition.positionData.normalized);
    });
    test("No normals generates default normals", () => {
      // Setup
      const engine = new MockEngine();
      const mockVertices = [
        new Vector3(0, 0, 0),
        Vector3.right(),
        Vector3.forward(),
      ];
      const expectedNormals = [
        Vector3.up(),
        Vector3.up(),
        Vector3.up(),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        normalData: undefined,
        positionData: {
          componentCount: 3,
          componentSize: 4,
          componentType: AccessorComponentType.FLOAT,
          normalized: false,
          buffer: new Float32Array(toBuffer(mockVertices, (vertex) => [vertex.x, vertex.y, vertex.z])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      expectVectorArraysToBeEqual(geometry.vertexNormals, expectedNormals);
      expect(geometry.normalAttribute.componentCount).toBe(3);
      expect(geometry.normalAttribute.componentSize).toBe(4);
      expect(geometry.normalAttribute.componentType).toBe(AccessorComponentType.FLOAT);
      expect(geometry.normalAttribute.normalized).toBe(false);
    });
    test("Normals (type=FLOAT) (normalized=false)", () => {
      // Setup
      const engine = new MockEngine();
      const mockNormals = [
        Vector3.forward(),
        Vector3.forward(),
        Vector3.forward(),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        normalData: {
          componentCount: 3,
          componentSize: 4,
          componentType: AccessorComponentType.FLOAT,
          normalized: false,
          buffer: new Float32Array(toBuffer(mockNormals, (normal) => [normal.x, normal.y, normal.z])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      expectVectorArraysToBeEqual(geometry.vertexNormals, mockNormals);
      expect(geometry.normalAttribute.componentCount).toBe(mockMeshPrimitiveDefinition.normalData!.componentCount);
      expect(geometry.normalAttribute.componentSize).toBe(mockMeshPrimitiveDefinition.normalData!.componentSize);
      expect(geometry.normalAttribute.componentType).toBe(mockMeshPrimitiveDefinition.normalData!.componentType);
      expect(geometry.normalAttribute.normalized).toBe(mockMeshPrimitiveDefinition.normalData!.normalized);
    });
    test("No indices generates sequential triangles", () => {
      // Setup
      const engine = new MockEngine();
      const mockVertices = [
        new Vector3(0, 0, 0),
        new Vector3(1, 0, 0),
        new Vector3(0, 0, 1),
        new Vector3(1, 0, 0),
        new Vector3(0, 0, 1),
        new Vector3(1, 0, 1),
      ];
      const expectedIndices = [
        new TriangleIndices(0, 1, 2),
        new TriangleIndices(3, 4, 5),
      ];
      const mockMeshPrimitiveDefinition: MeshPrimitiveDefinition = {
        mode: MeshPrimitiveMode.TRIANGLES,
        extents: new AxisAlignedBoundingBox(
          new Vector3(0, 0, 0),
          new Vector3(1, 0, 1),
        ),
        positionData: {
          componentCount: 3,
          componentSize: 4,
          componentType: AccessorComponentType.FLOAT,
          normalized: false,
          buffer: new Float32Array(toBuffer(mockVertices, (vertex) => [vertex.x, vertex.y, vertex.z])),
        },
      };

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.triangleIndices.forEach((triangleIndices, i) => {
        expect(triangleIndices.aIndex, `Triangle indices at index ${i} 'aIndex' should match`).toEqual(expectedIndices[i].aIndex);
        expect(triangleIndices.bIndex, `Triangle indices at index ${i} 'bIndex' should match`).toEqual(expectedIndices[i].bIndex);
        expect(triangleIndices.cIndex, `Triangle indices at index ${i} 'cIndex' should match`).toEqual(expectedIndices[i].cIndex);
      });
      expect(geometry.indicesAttribute.componentCount).toBe(1);
      expect(geometry.indicesAttribute.componentSize).toBe(4);
      expect(geometry.indicesAttribute.componentType).toBe(AccessorComponentType.UNSIGNED_INT);
      expect(geometry.indicesAttribute.normalized).toBe(false);
    });
    test("Indices (type=UNSIGNED_BYTE) (normalized=false)", () => {
      // Setup
      const engine = new MockEngine();
      const mockIndices = [
        new TriangleIndices(0, 2, 1),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        indices: {
          componentCount: 1,
          componentSize: 1,
          componentType: AccessorComponentType.UNSIGNED_BYTE,
          normalized: false,
          buffer: new Uint8Array(toBuffer(mockIndices, (indices) => [indices.aIndex, indices.bIndex, indices.cIndex])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.triangleIndices.forEach((triangleIndices, i) => {
        expect(triangleIndices.aIndex, `Triangle indices at index ${i} 'aIndex' should match`).toEqual(mockIndices[i].aIndex);
        expect(triangleIndices.bIndex, `Triangle indices at index ${i} 'bIndex' should match`).toEqual(mockIndices[i].bIndex);
        expect(triangleIndices.cIndex, `Triangle indices at index ${i} 'cIndex' should match`).toEqual(mockIndices[i].cIndex);
      });
      expect(geometry.indicesAttribute.componentCount).toBe(mockMeshPrimitiveDefinition.indices!.componentCount);
      expect(geometry.indicesAttribute.componentSize).toBe(mockMeshPrimitiveDefinition.indices!.componentSize);
      expect(geometry.indicesAttribute.componentType).toBe(mockMeshPrimitiveDefinition.indices!.componentType);
      expect(geometry.indicesAttribute.normalized).toBe(mockMeshPrimitiveDefinition.indices!.normalized);
    });
    test("Indices (type=UNSIGNED_SHORT) (normalized=false)", () => {
      // Setup
      const engine = new MockEngine();
      const mockIndices = [
        new TriangleIndices(0, 2, 1),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        indices: {
          componentCount: 1,
          componentSize: 2,
          componentType: AccessorComponentType.UNSIGNED_SHORT,
          normalized: false,
          buffer: new Uint16Array(toBuffer(mockIndices, (indices) => [indices.aIndex, indices.bIndex, indices.cIndex])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.triangleIndices.forEach((triangleIndices, i) => {
        expect(triangleIndices.aIndex, `Triangle indices at index ${i} 'aIndex' should match`).toEqual(mockIndices[i].aIndex);
        expect(triangleIndices.bIndex, `Triangle indices at index ${i} 'bIndex' should match`).toEqual(mockIndices[i].bIndex);
        expect(triangleIndices.cIndex, `Triangle indices at index ${i} 'cIndex' should match`).toEqual(mockIndices[i].cIndex);
      });
      expect(geometry.indicesAttribute.componentCount).toBe(mockMeshPrimitiveDefinition.indices!.componentCount);
      expect(geometry.indicesAttribute.componentSize).toBe(mockMeshPrimitiveDefinition.indices!.componentSize);
      expect(geometry.indicesAttribute.componentType).toBe(mockMeshPrimitiveDefinition.indices!.componentType);
      expect(geometry.indicesAttribute.normalized).toBe(mockMeshPrimitiveDefinition.indices!.normalized);
    });
    test("Indices (type=UNSIGNED_INT) (normalized=false)", () => {
      // Setup
      const engine = new MockEngine();
      const mockIndices = [
        new TriangleIndices(0, 2, 1),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        indices: {
          componentCount: 1,
          componentSize: 4,
          componentType: AccessorComponentType.UNSIGNED_INT,
          normalized: false,
          buffer: new Uint32Array(toBuffer(mockIndices, (indices) => [indices.aIndex, indices.bIndex, indices.cIndex])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.triangleIndices.forEach((triangleIndices, i) => {
        expect(triangleIndices.aIndex, `Triangle indices at index ${i} 'aIndex' should match`).toEqual(mockIndices[i].aIndex);
        expect(triangleIndices.bIndex, `Triangle indices at index ${i} 'bIndex' should match`).toEqual(mockIndices[i].bIndex);
        expect(triangleIndices.cIndex, `Triangle indices at index ${i} 'cIndex' should match`).toEqual(mockIndices[i].cIndex);
      });
      expect(geometry.indicesAttribute.componentCount).toBe(mockMeshPrimitiveDefinition.indices!.componentCount);
      expect(geometry.indicesAttribute.componentSize).toBe(mockMeshPrimitiveDefinition.indices!.componentSize);
      expect(geometry.indicesAttribute.componentType).toBe(mockMeshPrimitiveDefinition.indices!.componentType);
      expect(geometry.indicesAttribute.normalized).toBe(mockMeshPrimitiveDefinition.indices!.normalized);
    });
    test("No joint indices", () => {
      // Setup
      const engine = new MockEngine();
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        joints0Data: undefined,
        weights0Data: undefined,
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      expect(geometry.jointIndices).toBeUndefined();
      expect(geometry.joints0Attribute).toBeUndefined();
    });
    test("Joint indices (type=UNSIGNED_BYTE) (normalized=false)", () => {
      // Setup
      const engine = new MockEngine();
      const mockJointIndices = [
        new JointIndices(0, 0, 0, 0),
        new JointIndices(1, 0, 0, 0),
        new JointIndices(2, 0, 0, 0),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        joints0Data: {
          componentCount: 4,
          componentSize: 1,
          componentType: AccessorComponentType.UNSIGNED_BYTE,
          normalized: false,
          buffer: new Uint8Array(toBuffer(mockJointIndices, (jointIndices) => [jointIndices[0], jointIndices[1], jointIndices[2], jointIndices[3]])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.jointIndices!.forEach((jointIndices, i) => {
        expect(jointIndices[0], `Joint indices at index ${i} '0' should match`).toEqual(mockJointIndices[i][0]);
        expect(jointIndices[1], `Joint indices at index ${i} '1' should match`).toEqual(mockJointIndices[i][1]);
        expect(jointIndices[2], `Joint indices at index ${i} '2' should match`).toEqual(mockJointIndices[i][2]);
        expect(jointIndices[3], `Joint indices at index ${i} '3' should match`).toEqual(mockJointIndices[i][3]);
      });
      expect(geometry.joints0Attribute!.componentCount).toBe(mockMeshPrimitiveDefinition.joints0Data!.componentCount);
      expect(geometry.joints0Attribute!.componentSize).toBe(mockMeshPrimitiveDefinition.joints0Data!.componentSize);
      expect(geometry.joints0Attribute!.componentType).toBe(mockMeshPrimitiveDefinition.joints0Data!.componentType);
      expect(geometry.joints0Attribute!.normalized).toBe(mockMeshPrimitiveDefinition.joints0Data!.normalized);
    });
    test("Joint indices (type=UNSIGNED_SHORT) (normalized=false)", () => {
      // Setup
      const engine = new MockEngine();
      const mockJointIndices = [
        new JointIndices(0, 0, 0, 0),
        new JointIndices(1, 0, 0, 0),
        new JointIndices(2, 0, 0, 0),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        joints0Data: {
          componentCount: 4,
          componentSize: 2,
          componentType: AccessorComponentType.UNSIGNED_SHORT,
          normalized: false,
          buffer: new Uint16Array(toBuffer(mockJointIndices, (jointIndices) => [jointIndices[0], jointIndices[1], jointIndices[2], jointIndices[3]])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.jointIndices!.forEach((jointIndices, i) => {
        expect(jointIndices[0], `Joint indices at index ${i} '0' should match`).toEqual(mockJointIndices[i][0]);
        expect(jointIndices[1], `Joint indices at index ${i} '1' should match`).toEqual(mockJointIndices[i][1]);
        expect(jointIndices[2], `Joint indices at index ${i} '2' should match`).toEqual(mockJointIndices[i][2]);
        expect(jointIndices[3], `Joint indices at index ${i} '3' should match`).toEqual(mockJointIndices[i][3]);
      });
      expect(geometry.joints0Attribute!.componentCount).toBe(mockMeshPrimitiveDefinition.joints0Data!.componentCount);
      expect(geometry.joints0Attribute!.componentSize).toBe(mockMeshPrimitiveDefinition.joints0Data!.componentSize);
      expect(geometry.joints0Attribute!.componentType).toBe(mockMeshPrimitiveDefinition.joints0Data!.componentType);
      expect(geometry.joints0Attribute!.normalized).toBe(mockMeshPrimitiveDefinition.joints0Data!.normalized);
    });
    test("No joint weights", () => {
      // Setup
      const engine = new MockEngine();
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        joints0Data: undefined,
        weights0Data: undefined,
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      expect(geometry.jointWeights).toBeUndefined();
      expect(geometry.weights0Attribute).toBeUndefined();
    });
    test("Joint weights (type=FLOAT) (normalized=false)", () => {
      // Setup
      const engine = new MockEngine();
      const mockJointWeights = [
        new JointWeights(1, 0, 0, 0),
        new JointWeights(0.5, 0.5, 0, 0),
        new JointWeights(0.2, 0.3, 0.4, 0.1),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        weights0Data: {
          componentCount: 4,
          componentSize: 4,
          componentType: AccessorComponentType.FLOAT,
          normalized: false,
          buffer: new Float32Array(toBuffer(mockJointWeights, (jointWeights) => [jointWeights[0], jointWeights[1], jointWeights[2], jointWeights[3]])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.jointWeights!.forEach((jointWeights, i) => {
        expect(jointWeights[0], `Joint weights at index ${i} '0' should match`).toBeCloseTo(mockJointWeights[i][0]);
        expect(jointWeights[1], `Joint weights at index ${i} '1' should match`).toBeCloseTo(mockJointWeights[i][1]);
        expect(jointWeights[2], `Joint weights at index ${i} '2' should match`).toBeCloseTo(mockJointWeights[i][2]);
        expect(jointWeights[3], `Joint weights at index ${i} '3' should match`).toBeCloseTo(mockJointWeights[i][3]);
      });
      expect(geometry.weights0Attribute!.componentCount).toBe(mockMeshPrimitiveDefinition.weights0Data!.componentCount);
      expect(geometry.weights0Attribute!.componentSize).toBe(mockMeshPrimitiveDefinition.weights0Data!.componentSize);
      expect(geometry.weights0Attribute!.componentType).toBe(mockMeshPrimitiveDefinition.weights0Data!.componentType);
      expect(geometry.weights0Attribute!.normalized).toBe(mockMeshPrimitiveDefinition.weights0Data!.normalized);
    });
    test("Joint weights (type=UNSIGNED_BYTE) (normalized=true)", () => {
      // Setup
      const engine = new MockEngine();
      const mockJointWeights = [
        new JointWeights(1, 0, 0, 0),
        new JointWeights(0.5, 0.5, 0, 0),
        new JointWeights(0.2, 0.3, 0.4, 0.1),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        weights0Data: {
          componentCount: 4,
          componentSize: 1,
          componentType: AccessorComponentType.UNSIGNED_BYTE,
          normalized: true,
          buffer: new Uint8Array(toBuffer(mockJointWeights, (jointWeights) => [
            jointWeights[0] * 0xFF,
            jointWeights[1] * 0xFF,
            jointWeights[2] * 0xFF,
            jointWeights[3] * 0xFF,
          ])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.jointWeights!.forEach((jointWeights, i) => {
        expect(jointWeights[0], `Joint weights at index ${i} '0' should match`).toBeCloseTo(mockJointWeights[i][0]);
        expect(jointWeights[1], `Joint weights at index ${i} '1' should match`).toBeCloseTo(mockJointWeights[i][1]);
        expect(jointWeights[2], `Joint weights at index ${i} '2' should match`).toBeCloseTo(mockJointWeights[i][2]);
        expect(jointWeights[3], `Joint weights at index ${i} '3' should match`).toBeCloseTo(mockJointWeights[i][3]);
      });
      expect(geometry.weights0Attribute!.componentCount).toBe(mockMeshPrimitiveDefinition.weights0Data!.componentCount);
      expect(geometry.weights0Attribute!.componentSize).toBe(mockMeshPrimitiveDefinition.weights0Data!.componentSize);
      expect(geometry.weights0Attribute!.componentType).toBe(mockMeshPrimitiveDefinition.weights0Data!.componentType);
      expect(geometry.weights0Attribute!.normalized).toBe(mockMeshPrimitiveDefinition.weights0Data!.normalized);
    });
    test("Joint weights (type=UNSIGNED_SHORT) (normalized=true)", () => {
      // Setup
      const engine = new MockEngine();
      const mockJointWeights = [
        new JointWeights(1, 0, 0, 0),
        new JointWeights(0.5, 0.5, 0, 0),
        new JointWeights(0.2, 0.3, 0.4, 0.1),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        weights0Data: {
          componentCount: 4,
          componentSize: 2,
          componentType: AccessorComponentType.UNSIGNED_SHORT,
          normalized: true,
          buffer: new Uint16Array(toBuffer(mockJointWeights, (jointWeights) => [
            jointWeights[0] * 0xFFFF,
            jointWeights[1] * 0xFFFF,
            jointWeights[2] * 0xFFFF,
            jointWeights[3] * 0xFFFF,
          ])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.jointWeights!.forEach((jointWeights, i) => {
        expect(jointWeights[0], `Joint weights at index ${i} '0' should match`).toBeCloseTo(mockJointWeights[i][0]);
        expect(jointWeights[1], `Joint weights at index ${i} '1' should match`).toBeCloseTo(mockJointWeights[i][1]);
        expect(jointWeights[2], `Joint weights at index ${i} '2' should match`).toBeCloseTo(mockJointWeights[i][2]);
        expect(jointWeights[3], `Joint weights at index ${i} '3' should match`).toBeCloseTo(mockJointWeights[i][3]);
      });
      expect(geometry.weights0Attribute!.componentCount).toBe(mockMeshPrimitiveDefinition.weights0Data!.componentCount);
      expect(geometry.weights0Attribute!.componentSize).toBe(mockMeshPrimitiveDefinition.weights0Data!.componentSize);
      expect(geometry.weights0Attribute!.componentType).toBe(mockMeshPrimitiveDefinition.weights0Data!.componentType);
      expect(geometry.weights0Attribute!.normalized).toBe(mockMeshPrimitiveDefinition.weights0Data!.normalized);
    });
    test("No colors", () => {
      // Setup
      const engine = new MockEngine();
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        color0Data: undefined,
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      expect(geometry.vertexColors).toBeUndefined();
      expect(geometry.color0Attribute).toBeUndefined();
    });
    test("Colors (type=FLOAT) (normalized=false) (componentCount=3)", () => {
      // Setup
      const engine = new MockEngine();
      const mockColors = [
        Color3.red(),
        Color3.green(),
        Color3.blue(),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        color0Data: {
          componentCount: 3,
          componentSize: 4,
          componentType: AccessorComponentType.FLOAT,
          normalized: false,
          buffer: new Float32Array(toBuffer(mockColors, (color) => [color.r / 0xFF, color.g / 0xFF, color.b / 0xFF])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.vertexColors!.forEach((color, i) => {
        expect(color.r, `Vertex color at index ${i} 'r' should match`).toBeCloseTo(mockColors[i].r);
        expect(color.g, `Vertex color at index ${i} 'g' should match`).toBeCloseTo(mockColors[i].g);
        expect(color.b, `Vertex color at index ${i} 'b' should match`).toBeCloseTo(mockColors[i].b);
        expect(color.a, `Vertex color at index ${i} 'a' should match`).toBeCloseTo(0xFF);
      });
      expect(geometry.color0Attribute!.componentCount).toBe(mockMeshPrimitiveDefinition.color0Data!.componentCount);
      expect(geometry.color0Attribute!.componentSize).toBe(mockMeshPrimitiveDefinition.color0Data!.componentSize);
      expect(geometry.color0Attribute!.componentType).toBe(mockMeshPrimitiveDefinition.color0Data!.componentType);
      expect(geometry.color0Attribute!.normalized).toBe(mockMeshPrimitiveDefinition.color0Data!.normalized);
    });
    test("Colors (type=UNSIGNED_BYTE) (normalized=true) (componentCount=3)", () => {
      // Setup
      const engine = new MockEngine();
      const mockColors = [
        Color3.red(),
        Color3.green(),
        Color3.blue(),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        color0Data: {
          componentCount: 3,
          componentSize: 1,
          componentType: AccessorComponentType.UNSIGNED_BYTE,
          normalized: true,
          buffer: new Uint8Array(toBuffer(mockColors, (color) => [
            // @NOTE Weird redundant maths because we "technically" have to normalize through 1.0 => UNSIGNED_BYTE
            // which just happens to equal our representation of colors in Color3/Color4. But TECHNICALLY speaking
            // we need  to do this "conversion". It makes more sense when we convert to UNSIGNED_SHORT.
            color.r / 0xFF * 0xFF,
            color.g / 0xFF * 0xFF,
            color.b / 0xFF * 0xFF,
          ])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.vertexColors!.forEach((color, i) => {
        expect(color.r, `Vertex color at index ${i} 'r' should match`).toBeCloseTo(mockColors[i].r);
        expect(color.g, `Vertex color at index ${i} 'g' should match`).toBeCloseTo(mockColors[i].g);
        expect(color.b, `Vertex color at index ${i} 'b' should match`).toBeCloseTo(mockColors[i].b);
        expect(color.a, `Vertex color at index ${i} 'a' should match`).toBeCloseTo(0xFF);
      });
      expect(geometry.color0Attribute!.componentCount).toBe(mockMeshPrimitiveDefinition.color0Data!.componentCount);
      expect(geometry.color0Attribute!.componentSize).toBe(mockMeshPrimitiveDefinition.color0Data!.componentSize);
      expect(geometry.color0Attribute!.componentType).toBe(mockMeshPrimitiveDefinition.color0Data!.componentType);
      expect(geometry.color0Attribute!.normalized).toBe(mockMeshPrimitiveDefinition.color0Data!.normalized);
    });
    test("Colors (type=UNSIGNED_SHORT) (normalized=true) (componentCount=3)", () => {
      // Setup
      const engine = new MockEngine();
      const mockColors = [
        Color3.red(),
        Color3.green(),
        Color3.blue(),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        color0Data: {
          componentCount: 3,
          componentSize: 2,
          componentType: AccessorComponentType.UNSIGNED_SHORT,
          normalized: true,
          buffer: new Uint16Array(toBuffer(mockColors, (color) => [
            // @NOTE Weird redundant maths to represent the "correct" normalization through 1.0 => UNSIGNED_SHORT
            color.r / 0xFF * 0xFFFF,
            color.g / 0xFF * 0xFFFF,
            color.b / 0xFF * 0xFFFF,
          ])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.vertexColors!.forEach((color, i) => {
        expect(color.r, `Vertex color at index ${i} 'r' should match`).toBeCloseTo(mockColors[i].r);
        expect(color.g, `Vertex color at index ${i} 'g' should match`).toBeCloseTo(mockColors[i].g);
        expect(color.b, `Vertex color at index ${i} 'b' should match`).toBeCloseTo(mockColors[i].b);
        expect(color.a, `Vertex color at index ${i} 'a' should match`).toBeCloseTo(0xFF);
      });
      expect(geometry.color0Attribute!.componentCount).toBe(mockMeshPrimitiveDefinition.color0Data!.componentCount);
      expect(geometry.color0Attribute!.componentSize).toBe(mockMeshPrimitiveDefinition.color0Data!.componentSize);
      expect(geometry.color0Attribute!.componentType).toBe(mockMeshPrimitiveDefinition.color0Data!.componentType);
      expect(geometry.color0Attribute!.normalized).toBe(mockMeshPrimitiveDefinition.color0Data!.normalized);
    });
    test("Colors (type=FLOAT) (normalized=false) (componentCount=4)", () => {
      // Setup
      const engine = new MockEngine();
      const mockColors = [
        Color4.red(),
        Color4.green().setA(0x80),
        Color4.blue().setA(0x20),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        color0Data: {
          componentCount: 4,
          componentSize: 4,
          componentType: AccessorComponentType.FLOAT,
          normalized: false,
          buffer: new Float32Array(toBuffer(mockColors, (color) => [color.r / 0xFF, color.g / 0xFF, color.b / 0xFF, color.a / 0xFF])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.vertexColors!.forEach((color, i) => {
        expect(color.r, `Vertex color at index ${i} 'r' should match`).toBeCloseTo(mockColors[i].r);
        expect(color.g, `Vertex color at index ${i} 'g' should match`).toBeCloseTo(mockColors[i].g);
        expect(color.b, `Vertex color at index ${i} 'b' should match`).toBeCloseTo(mockColors[i].b);
        expect(color.a, `Vertex color at index ${i} 'a' should match`).toBeCloseTo(mockColors[i].a);
      });
      expect(geometry.color0Attribute!.componentCount).toBe(mockMeshPrimitiveDefinition.color0Data!.componentCount);
      expect(geometry.color0Attribute!.componentSize).toBe(mockMeshPrimitiveDefinition.color0Data!.componentSize);
      expect(geometry.color0Attribute!.componentType).toBe(mockMeshPrimitiveDefinition.color0Data!.componentType);
      expect(geometry.color0Attribute!.normalized).toBe(mockMeshPrimitiveDefinition.color0Data!.normalized);
    });
    test("Colors (type=UNSIGNED_BYTE) (normalized=true) (componentCount=4)", () => {
      // Setup
      const engine = new MockEngine();
      const mockColors = [
        Color4.red(),
        Color4.green().setA(0x80),
        Color4.blue().setA(0x20),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        color0Data: {
          componentCount: 4,
          componentSize: 1,
          componentType: AccessorComponentType.UNSIGNED_BYTE,
          normalized: true,
          buffer: new Uint8Array(toBuffer(mockColors, (color) => [
            // @NOTE Weird redundant maths because we "technically" have to normalize through 1.0 => UNSIGNED_BYTE
            // which just happens to equal our representation of colors in Color3/Color4. But TECHNICALLY speaking
            // we need  to do this "conversion". It makes more sense when we convert to UNSIGNED_SHORT.
            color.r / 0xFF * 0xFF,
            color.g / 0xFF * 0xFF,
            color.b / 0xFF * 0xFF,
            color.a / 0xFF * 0xFF,
          ])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.vertexColors!.forEach((color, i) => {
        expect(color.r, `Vertex color at index ${i} 'r' should match`).toBeCloseTo(mockColors[i].r);
        expect(color.g, `Vertex color at index ${i} 'g' should match`).toBeCloseTo(mockColors[i].g);
        expect(color.b, `Vertex color at index ${i} 'b' should match`).toBeCloseTo(mockColors[i].b);
        expect(color.a, `Vertex color at index ${i} 'a' should match`).toBeCloseTo(mockColors[i].a);
      });
      expect(geometry.color0Attribute!.componentCount).toBe(mockMeshPrimitiveDefinition.color0Data!.componentCount);
      expect(geometry.color0Attribute!.componentSize).toBe(mockMeshPrimitiveDefinition.color0Data!.componentSize);
      expect(geometry.color0Attribute!.componentType).toBe(mockMeshPrimitiveDefinition.color0Data!.componentType);
      expect(geometry.color0Attribute!.normalized).toBe(mockMeshPrimitiveDefinition.color0Data!.normalized);
    });
    test("Colors (type=UNSIGNED_SHORT) (normalized=true) (componentCount=4)", () => {
      // Setup
      const engine = new MockEngine();
      const mockColors = [
        Color4.red(),
        Color4.green().setA(0x80),
        Color4.blue().setA(0x20),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        color0Data: {
          componentCount: 4,
          componentSize: 2,
          componentType: AccessorComponentType.UNSIGNED_SHORT,
          normalized: true,
          buffer: new Uint16Array(toBuffer(mockColors, (color) => [
            // @NOTE Weird redundant maths to represent the "correct" normalization through 1.0 => UNSIGNED_SHORT
            color.r / 0xFF * 0xFFFF,
            color.g / 0xFF * 0xFFFF,
            color.b / 0xFF * 0xFFFF,
            color.a / 0xFF * 0xFFFF,
          ])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.vertexColors!.forEach((color, i) => {
        expect(color.r, `Vertex color at index ${i} 'r' should match`).toBeCloseTo(mockColors[i].r);
        expect(color.g, `Vertex color at index ${i} 'g' should match`).toBeCloseTo(mockColors[i].g);
        expect(color.b, `Vertex color at index ${i} 'b' should match`).toBeCloseTo(mockColors[i].b);
        expect(color.a, `Vertex color at index ${i} 'a' should match`).toBeCloseTo(mockColors[i].a);
      });
      expect(geometry.color0Attribute!.componentCount).toBe(mockMeshPrimitiveDefinition.color0Data!.componentCount);
      expect(geometry.color0Attribute!.componentSize).toBe(mockMeshPrimitiveDefinition.color0Data!.componentSize);
      expect(geometry.color0Attribute!.componentType).toBe(mockMeshPrimitiveDefinition.color0Data!.componentType);
      expect(geometry.color0Attribute!.normalized).toBe(mockMeshPrimitiveDefinition.color0Data!.normalized);
    });
    test("No texture coordinates", () => {
      // Setup
      const engine = new MockEngine();
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        texCoord0Data: undefined,
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      expect(geometry.vertexTextureCoordinates).toBeUndefined();
      expect(geometry.texCoord0Attribute).toBeUndefined();
    });
    test("Texture coordinates (type=FLOAT) (normalized=false)", () => {
      // Setup
      const engine = new MockEngine();
      const mockTexCoords = [
        new Vector2(0, 0),
        new Vector2(1, 0),
        new Vector2(0, 1),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        texCoord0Data: {
          componentCount: 2,
          componentSize: 4,
          componentType: AccessorComponentType.FLOAT,
          normalized: false,
          buffer: new Float32Array(toBuffer(mockTexCoords, (texCoord) => [texCoord.x, texCoord.y])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.vertexTextureCoordinates!.forEach((texCoord, i) => {
        expect(texCoord.x, `Texture coordinate at index ${i} 'x' should match`).toBeCloseTo(mockTexCoords[i].x);
        expect(texCoord.y, `Texture coordinate at index ${i} 'y' should match`).toBeCloseTo(mockTexCoords[i].y);
      });
      expect(geometry.texCoord0Attribute!.componentCount).toBe(mockMeshPrimitiveDefinition.texCoord0Data!.componentCount);
      expect(geometry.texCoord0Attribute!.componentSize).toBe(mockMeshPrimitiveDefinition.texCoord0Data!.componentSize);
      expect(geometry.texCoord0Attribute!.componentType).toBe(mockMeshPrimitiveDefinition.texCoord0Data!.componentType);
      expect(geometry.texCoord0Attribute!.normalized).toBe(mockMeshPrimitiveDefinition.texCoord0Data!.normalized);
    });
    test("Texture coordinates (type=UNSIGNED_SHORT) (normalized=true)", () => {
      // Setup
      const engine = new MockEngine();
      const mockTexCoords = [
        new Vector2(0, 0),
        new Vector2(1, 0),
        new Vector2(0, 1),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        texCoord0Data: {
          componentCount: 2,
          componentSize: 2,
          componentType: AccessorComponentType.UNSIGNED_SHORT,
          normalized: true,
          buffer: new Uint16Array(toBuffer(mockTexCoords, (texCoord) => [
            texCoord.x * 0xFFFF,
            texCoord.y * 0xFFFF,
          ])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.vertexTextureCoordinates!.forEach((texCoord, i) => {
        expect(texCoord.x, `Texture coordinate at index ${i} 'x' should match`).toBeCloseTo(mockTexCoords[i].x);
        expect(texCoord.y, `Texture coordinate at index ${i} 'y' should match`).toBeCloseTo(mockTexCoords[i].y);
      });
      expect(geometry.texCoord0Attribute!.componentCount).toBe(mockMeshPrimitiveDefinition.texCoord0Data!.componentCount);
      expect(geometry.texCoord0Attribute!.componentSize).toBe(mockMeshPrimitiveDefinition.texCoord0Data!.componentSize);
      expect(geometry.texCoord0Attribute!.componentType).toBe(mockMeshPrimitiveDefinition.texCoord0Data!.componentType);
      expect(geometry.texCoord0Attribute!.normalized).toBe(mockMeshPrimitiveDefinition.texCoord0Data!.normalized);
    });
    test("Texture coordinates (type=UNSIGNED_BYTE) (normalized=true)", () => {
      // Setup
      const engine = new MockEngine();
      const mockTexCoords = [
        new Vector2(0, 0),
        new Vector2(1, 0),
        new Vector2(0, 1),
      ];
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition({
        texCoord0Data: {
          componentCount: 2,
          componentSize: 1,
          componentType: AccessorComponentType.UNSIGNED_BYTE,
          normalized: true,
          buffer: new Uint8Array(toBuffer(mockTexCoords, (texCoord) => [
            texCoord.x * 0xFF,
            texCoord.y * 0xFF,
          ])),
        },
      });

      // Test
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // Assert
      geometry.vertexTextureCoordinates!.forEach((texCoord, i) => {
        expect(texCoord.x, `Texture coordinate at index ${i} 'x' should match`).toBeCloseTo(mockTexCoords[i].x);
        expect(texCoord.y, `Texture coordinate at index ${i} 'y' should match`).toBeCloseTo(mockTexCoords[i].y);
      });
      expect(geometry.texCoord0Attribute!.componentCount).toBe(mockMeshPrimitiveDefinition.texCoord0Data!.componentCount);
      expect(geometry.texCoord0Attribute!.componentSize).toBe(mockMeshPrimitiveDefinition.texCoord0Data!.componentSize);
      expect(geometry.texCoord0Attribute!.componentType).toBe(mockMeshPrimitiveDefinition.texCoord0Data!.componentType);
      expect(geometry.texCoord0Attribute!.normalized).toBe(mockMeshPrimitiveDefinition.texCoord0Data!.normalized);
    });
  });
  describe("Observability", () => {
    test("Mutating nothing fires no changed events", () => {
      // Setup
      const engine = new MockEngine();
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition();
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      let timesAnythingFired = 0;
      geometry.vertexPositionsChanged.onChange(() => timesAnythingFired++);
      geometry.vertexNormalsChanged.onChange(() => timesAnythingFired++);
      geometry.triangleIndicesChanged.onChange(() => timesAnythingFired++);
      geometry.jointIndicesChanged.onChange(() => timesAnythingFired++);
      geometry.jointWeightsChanged.onChange(() => timesAnythingFired++);
      geometry.vertexColorsChanged.onChange(() => timesAnythingFired++);
      geometry.vertexTextureCoordinatesChanged.onChange(() => timesAnythingFired++);

      // Test
      geometry.mutate((_geometry) => {
        /* @NOTE No-op. */
      });

      // Assert
      expect(timesAnythingFired).toBe(0);
    });
    test("Mutating vertex positions fires `vertexPositionsChanged` once", () => {
      // Setup
      const engine = new MockEngine();
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition();
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // @NOTE Subscribe to specific event + everything to ensure no cross-fire
      let timesSpecificEventFired = 0;
      let timesAnythingElseFired = 0;
      geometry.vertexPositionsChanged.onChange(() => timesSpecificEventFired++);
      geometry.vertexNormalsChanged.onChange(() => timesAnythingElseFired++);
      geometry.triangleIndicesChanged.onChange(() => timesAnythingElseFired++);
      geometry.jointIndicesChanged.onChange(() => timesAnythingElseFired++);
      geometry.jointWeightsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexColorsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexTextureCoordinatesChanged.onChange(() => timesAnythingElseFired++);

      // Test
      geometry.mutate((geometry) => {
        geometry.vertexPositions[0].addSelf(Vector3.up());
        geometry.vertexPositions[1].addSelf(Vector3.up());
      });

      // Assert
      expect(timesSpecificEventFired).toBe(1);
      expect(timesAnythingElseFired).toBe(0);
    });
    test("Mutating vertex normals fires `vertexNormalsChanged` once", () => {
      // Setup
      const engine = new MockEngine();
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition();
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // @NOTE Subscribe to specific event + everything to ensure no cross-fire
      let timesSpecificEventFired = 0;
      let timesAnythingElseFired = 0;
      geometry.vertexPositionsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexNormalsChanged.onChange(() => timesSpecificEventFired++);
      geometry.triangleIndicesChanged.onChange(() => timesAnythingElseFired++);
      geometry.jointIndicesChanged.onChange(() => timesAnythingElseFired++);
      geometry.jointWeightsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexColorsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexTextureCoordinatesChanged.onChange(() => timesAnythingElseFired++);

      // Test
      geometry.mutate((geometry) => {
        geometry.vertexNormals[0].addSelf(Vector3.up()).normalizeSelf();
        geometry.vertexNormals[1].addSelf(Vector3.up()).normalizeSelf();
      });

      // Assert
      expect(timesSpecificEventFired).toBe(1);
      expect(timesAnythingElseFired).toBe(0);
    });
    test("Mutating triangle indices fires `triangleIndicesChanged` once", () => {
      // Setup
      const engine = new MockEngine();
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition();
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // @NOTE Subscribe to specific event + everything to ensure no cross-fire
      let timesSpecificEventFired = 0;
      let timesAnythingElseFired = 0;
      geometry.vertexPositionsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexNormalsChanged.onChange(() => timesAnythingElseFired++);
      geometry.triangleIndicesChanged.onChange(() => timesSpecificEventFired++);
      geometry.jointIndicesChanged.onChange(() => timesAnythingElseFired++);
      geometry.jointWeightsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexColorsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexTextureCoordinatesChanged.onChange(() => timesAnythingElseFired++);

      // Test
      geometry.mutate((geometry) => {
        // @NOTE We only have 1 triangle, so make two edits (swaps of indices) to the same triangle
        [geometry.triangleIndices[0].aIndex, geometry.triangleIndices[0].bIndex] = [geometry.triangleIndices[0].bIndex, geometry.triangleIndices[0].aIndex];
        [geometry.triangleIndices[0].bIndex, geometry.triangleIndices[0].aIndex] = [geometry.triangleIndices[0].aIndex, geometry.triangleIndices[0].bIndex];
      });

      // Assert
      expect(timesSpecificEventFired).toBe(1);
      expect(timesAnythingElseFired).toBe(0);
    });
    test("Mutating joint indices fires `jointIndicesChanged` once", () => {
      // Setup
      const engine = new MockEngine();
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition();
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // @NOTE Subscribe to specific event + everything to ensure no cross-fire
      let timesSpecificEventFired = 0;
      let timesAnythingElseFired = 0;
      geometry.vertexPositionsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexNormalsChanged.onChange(() => timesAnythingElseFired++);
      geometry.triangleIndicesChanged.onChange(() => timesAnythingElseFired++);
      geometry.jointIndicesChanged.onChange(() => timesSpecificEventFired++);
      geometry.jointWeightsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexColorsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexTextureCoordinatesChanged.onChange(() => timesAnythingElseFired++);

      // Test
      geometry.mutate((geometry) => {
        geometry.jointIndices![0][0] = 2;
        geometry.jointIndices![1][0] = 2;
      });

      // Assert
      expect(timesSpecificEventFired).toBe(1);
      expect(timesAnythingElseFired).toBe(0);
    });
    test("Mutating joint weights fires `jointWeightsChanged` once", () => {
      // Setup
      const engine = new MockEngine();
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition();
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // @NOTE Subscribe to specific event + everything to ensure no cross-fire
      let timesSpecificEventFired = 0;
      let timesAnythingElseFired = 0;
      geometry.vertexPositionsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexNormalsChanged.onChange(() => timesAnythingElseFired++);
      geometry.triangleIndicesChanged.onChange(() => timesAnythingElseFired++);
      geometry.jointIndicesChanged.onChange(() => timesAnythingElseFired++);
      geometry.jointWeightsChanged.onChange(() => timesSpecificEventFired++);
      geometry.vertexColorsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexTextureCoordinatesChanged.onChange(() => timesAnythingElseFired++);

      // Test
      geometry.mutate((geometry) => {
        geometry.jointWeights![0][0] = 0.5;
        geometry.jointWeights![0][1] = 0.5;
        geometry.jointWeights![1][0] = 0.5;
        geometry.jointWeights![1][1] = 0.5;
      });

      // Assert
      expect(timesSpecificEventFired).toBe(1);
      expect(timesAnythingElseFired).toBe(0);
    });
    test("Mutating vertex colors fires `vertexColorsChanged` once", () => {
      // Setup
      const engine = new MockEngine();
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition();
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // @NOTE Subscribe to specific event + everything to ensure no cross-fire
      let timesSpecificEventFired = 0;
      let timesAnythingElseFired = 0;
      geometry.vertexPositionsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexNormalsChanged.onChange(() => timesAnythingElseFired++);
      geometry.triangleIndicesChanged.onChange(() => timesAnythingElseFired++);
      geometry.jointIndicesChanged.onChange(() => timesAnythingElseFired++);
      geometry.jointWeightsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexColorsChanged.onChange(() => timesSpecificEventFired++);
      geometry.vertexTextureCoordinatesChanged.onChange(() => timesAnythingElseFired++);

      // Test
      geometry.mutate((geometry) => {
        geometry.vertexColors![0].r = 0x80;
        geometry.vertexColors![1].r = 0x80;
      });

      // Assert
      expect(timesSpecificEventFired).toBe(1);
      expect(timesAnythingElseFired).toBe(0);
    });
    test("Mutating vertex texture coordinates fires `vertexTextureCoordinatesChanged` once", () => {
      // Setup
      const engine = new MockEngine();
      const mockMeshPrimitiveDefinition = createMockMeshPrimitiveDefinition();
      const geometry = new MeshPrimitiveGeometry(engine, mockMeshPrimitiveDefinition);

      // @NOTE Subscribe to specific event + everything to ensure no cross-fire
      let timesSpecificEventFired = 0;
      let timesAnythingElseFired = 0;
      geometry.vertexPositionsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexNormalsChanged.onChange(() => timesAnythingElseFired++);
      geometry.triangleIndicesChanged.onChange(() => timesAnythingElseFired++);
      geometry.jointIndicesChanged.onChange(() => timesAnythingElseFired++);
      geometry.jointWeightsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexColorsChanged.onChange(() => timesAnythingElseFired++);
      geometry.vertexTextureCoordinatesChanged.onChange(() => timesSpecificEventFired++);

      // Test
      geometry.mutate((geometry) => {
        geometry.vertexTextureCoordinates![0].x = 0.5;
        geometry.vertexTextureCoordinates![1].x = 0.5;
      });

      // Assert
      expect(timesSpecificEventFired).toBe(1);
      expect(timesAnythingElseFired).toBe(0);
    });
  });
});


export function createMockMeshPrimitiveDefinition(overrides: Partial<MeshPrimitiveDefinition> = {}): MeshPrimitiveDefinition {
  if (overrides.positionData !== undefined && overrides.positionData.buffer.length !== 9) {
    // @NOTE Sanity check to guard against unexpected edge-cases (e.g. supplying 5 vertices but only generating 3 normals)
    // We could make this function smarter, but would make tests more complicated.
    throw new Error(`Mock utility relies on having 3 vertices. Build a mock manually instead.`);
  }

  return {
    mode: MeshPrimitiveMode.TRIANGLES,
    extents: new AxisAlignedBoundingBox(
      new Vector3(-1, -2, -3),
      new Vector3(1, 2, 3),
    ),
    positionData: {
      componentCount: 3,
      componentType: AccessorComponentType.FLOAT,
      componentSize: 4,
      normalized: false,
      buffer: new Float32Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
      ]),
    },
    normalData: {
      componentCount: 3,
      componentType: AccessorComponentType.FLOAT,
      componentSize: 4,
      normalized: false,
      buffer: new Float32Array([
        0, 0, 1,
        0, 0, 1,
        0, 0, 1,
      ]),
    },
    texCoord0Data: {
      componentCount: 2,
      componentType: AccessorComponentType.FLOAT,
      componentSize: 4,
      normalized: false,
      buffer: new Float32Array([
        0, 0,
        1, 0,
        0, 1,
      ]),
    },
    color0Data: {
      componentCount: 4,
      componentType: AccessorComponentType.UNSIGNED_BYTE,
      componentSize: 1,
      normalized: true,
      buffer: new Uint8Array([
        0xFF, 0, 0, 0xFF,
        0, 0xFF, 0, 0xFF,
        0, 0, 0xFF, 0xFF,
      ]),
    },
    joints0Data: {
      componentCount: 4,
      componentType: AccessorComponentType.UNSIGNED_BYTE,
      componentSize: 1,
      normalized: false,
      buffer: new Uint8Array([
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
      ]),
    },
    weights0Data: {
      componentCount: 4,
      componentType: AccessorComponentType.FLOAT,
      componentSize: 4,
      normalized: false,
      buffer: new Float32Array([
        1, 0, 0, 0,
        1, 0, 0, 0,
        1, 0, 0, 0,
      ]),
    },
    indices: {
      componentCount: 1,
      componentType: AccessorComponentType.UNSIGNED_BYTE,
      componentSize: 1,
      normalized: false,
      buffer: new Uint8Array([0, 1, 2]),
    },
    ...overrides,
  };
}

function toBuffer<T>(collection: T[], mapFn: (value: T) => number[]): number[] {
  return collection.flatMap(mapFn);
}

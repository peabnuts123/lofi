import { Vector3 } from "@lofi/core/math/Vector3";
import { Matrix3, Matrix4, type IReadonlyColor4, type IReadonlyVector2, type IReadonlyVector3 } from "@lofi/core/math";
import { Computed } from "@lofi/core/util/Computed";
import { Optional, type Mutable } from "@lofi/core/util/types";
import { AxisAlignedBoundingBox, type IReadonlyAxisAlignedBoundingBox } from "@lofi/engine/collision";

import type { Model } from "../Model";
import {
  type Edge,
  type EdgeIndices,
  type IReadonlyTriangleIndices,
  type Triangle,
} from "./index";

interface ModelNodeGeometryArgs {
  model: Model;
  worldMatrixComputed: Computed<Matrix4>;
}

/**
 * Exposes a read-only view of the combined geometry of an entire model,
 * transformed into world space.
 */
export class ModelNodeGeometry {
  private readonly _allVertexPositions: Computed<readonly IReadonlyVector3[]>;
  private readonly _allVertexNormals: Computed<readonly IReadonlyVector3[]>;
  private readonly _allTriangleIndices: Computed<readonly IReadonlyTriangleIndices[]>;
  private readonly _allTriangles: Computed<readonly Triangle[]>;
  private readonly _allTriangleNormals: Computed<readonly IReadonlyVector3[]>;
  private readonly _allEdgeIndices: Computed<readonly EdgeIndices[]>;
  private readonly _allEdges: Computed<readonly Edge[]>;
  private readonly _allVertexColors: Computed<readonly (IReadonlyColor4 | undefined)[]>;
  private readonly _allVertexTextureCoordinates: Computed<readonly (IReadonlyVector2 | undefined)[]>;
  private readonly _aabb: Computed<Optional<IReadonlyAxisAlignedBoundingBox>>;
  private readonly _approximateAabb: Computed<Optional<IReadonlyAxisAlignedBoundingBox>>;

  public constructor({ model, worldMatrixComputed }: ModelNodeGeometryArgs) {
    /* Vertex positions */
    this._allVertexPositions = new Computed<readonly IReadonlyVector3[]>([], {
      dependencies: [
        worldMatrixComputed,
        model.geometry.allVertexPositionsComputed,
      ],
      recompute: (_self) => {
        const self = _self as Vector3[]; // @NOTE type laundering for mutability

        let vertexCount = 0;
        const worldMatrix = worldMatrixComputed.value;
        for (const vertexPosition of model.geometry.allVertexPositionsComputed.value) {
          let current: Vector3;
          if (self[vertexCount] !== undefined) {
            // Re-use existing instances
            current = self[vertexCount].setValue(vertexPosition);
          } else {
            // Build up array for the first time
            current = self[vertexCount] = vertexPosition.clone();
          }

          // Transform vertex position by ModelNode's world matrix
          worldMatrix.transformPointInPlace(current);
          vertexCount++;
        }
      },
    });

    /* Vertex normals */
    const worldMatrixTransposedInverseComputed = new Computed<Matrix3>(new Matrix3(), {
      dependencies: [
        worldMatrixComputed,
      ],
      recompute: (self) => {
        self.normalSelf(worldMatrixComputed.value);
      },
    });
    this._allVertexNormals = new Computed<readonly IReadonlyVector3[]>([], {
      dependencies: [
        worldMatrixTransposedInverseComputed,
        model.geometry.allVertexNormalsComputed,
      ],
      recompute: (_self) => {
        const self = _self as Vector3[]; // @NOTE type laundering for mutability

        let vertexCount = 0;
        const worldMatrixTransposedInverse = worldMatrixTransposedInverseComputed.value;
        for (const vertexNormal of model.geometry.allVertexNormalsComputed.value) {
          let current: Vector3;
          if (self[vertexCount] !== undefined) {
            // Re-use existing instances
            current = self[vertexCount].setValue(vertexNormal);
          } else {
            // Build up array for the first time
            current = self[vertexCount] = vertexNormal.clone();
          }

          // Transform vertex normal by transposed inverse of ModelNode's world matrix
          worldMatrixTransposedInverse.multiplyVectorInPlace(current).normalizeSelf();
          vertexCount++;
        }
      },
    });

    /* Triangles */
    // @NOTE Just an alias, since no further computation required
    this._allTriangleIndices = model.geometry.allTriangleIndicesComputed;
    this._allTriangles = new Computed<readonly Triangle[]>([], {
      dependencies: [
        this._allVertexPositions,
        this._allTriangleIndices,
      ],
      recompute: (_self) => {
        const self = _self as Mutable<Triangle>[]; // @NOTE type laundering for mutability

        let triangleCount = 0;
        const allVertexPositions = this._allVertexPositions.value;
        for (const triangleIndices of this._allTriangleIndices.value) {
          const aTriangle = allVertexPositions[triangleIndices.aIndex];
          const bTriangle = allVertexPositions[triangleIndices.bIndex];
          const cTriangle = allVertexPositions[triangleIndices.cIndex];
          if (self[triangleCount] !== undefined) {
            // Re-use existing instances
            self[triangleCount][0] = aTriangle;
            self[triangleCount][1] = bTriangle;
            self[triangleCount][2] = cTriangle;
          } else {
            // Build up array for the first time
            self[triangleCount] = [
              aTriangle,
              bTriangle,
              cTriangle,
            ];
          }
          triangleCount++;
        }
      },
    });
    this._allTriangleNormals = new Computed<readonly IReadonlyVector3[]>([], {
      dependencies: [
        worldMatrixTransposedInverseComputed,
        model.geometry.allTriangleNormalsComputed,
      ],
      recompute: (_self) => {
        const self = _self as Vector3[]; // @NOTE type laundering for mutability

        let vertexCount = 0;
        const worldMatrixTransposedInverse = worldMatrixTransposedInverseComputed.value;
        for (const triangleNormal of model.geometry.allTriangleNormalsComputed.value) {
          let current: Vector3;
          if (self[vertexCount] !== undefined) {
            // Re-use existing instances
            current = self[vertexCount].setValue(triangleNormal);
          } else {
            // Build up array for the first time
            current = self[vertexCount] = triangleNormal.clone();
          }

          // Transform vertex normal by transposed inverse of ModelNode's world matrix
          worldMatrixTransposedInverse.multiplyVectorInPlace(current).normalizeSelf();
          vertexCount++;
        }
      },
    });

    /* Edges */
    // @NOTE Just an alias, since no further computation required
    this._allEdgeIndices = model.geometry.allEdgeIndicesComputed;
    this._allEdges = new Computed<readonly Edge[]>([], {
      dependencies: [
        this._allVertexPositions,
        this._allEdgeIndices,
      ],
      recompute: (_self) => {
        const self = _self as Mutable<Edge>[]; // @NOTE type laundering for mutability

        let edgeCount = 0;
        const allVertexPositions = this._allVertexPositions.value;
        for (const edgeIndices of this._allEdgeIndices.value) {
          const aVertex = allVertexPositions[edgeIndices[0]];
          const bVertex = allVertexPositions[edgeIndices[1]];
          if (self[edgeCount] !== undefined) {
            // Re-use existing instances
            self[edgeCount][0] = aVertex;
            self[edgeCount][1] = bVertex;
          } else {
            // Build up array for the first time
            self[edgeCount] = [
              aVertex,
              bVertex,
            ];
          }
          edgeCount++;
        }

        // Number of unique edges can change, so ensure array is always correct size
        self.length = edgeCount;
      },
    });

    /* Colors */
    // @NOTE Just an alias, since no further computation required
    this._allVertexColors = model.geometry.allVertexColorsComputed;

    /* Texture coordinates */
    // @NOTE Just an alias, since no further computation required
    this._allVertexTextureCoordinates = model.geometry.allVertexTextureCoordinatesComputed;

    /* AABB */
    this._aabb = new Computed<Optional<IReadonlyAxisAlignedBoundingBox>>(Optional(), {
      dependencies: [
        this._allVertexPositions,
      ],
      recompute: (_self) => {
        const self = _self as Optional<AxisAlignedBoundingBox>; // @NOTE type laundering for mutability

        const allVertexPositions = this._allVertexPositions.value;
        if (allVertexPositions.length === 0) {
          // Entire model has no geometry 🤯
          self.value = undefined;
        } else {
          // Ensure value is initialised
          const aabb = (self.value as AxisAlignedBoundingBox) ??= AxisAlignedBoundingBox.zero();

          // Recompute AABB based on vertex positions
          aabb.fromVerticesSelf(allVertexPositions);
        }
      },
    });
    /* AABB - approximate */
    this._approximateAabb = new Computed<Optional<IReadonlyAxisAlignedBoundingBox>>(Optional(), {
      dependencies: [
        worldMatrixComputed,
        model.geometry.approximateAabbComputed,
      ],
      recompute: (_self) => {
        const self = _self as Optional<AxisAlignedBoundingBox>; // @NOTE type laundering for mutability
        const modelApproximateAabb = model.geometry.approximateAabbComputed.value;
        if (modelApproximateAabb.value === undefined) {
          // Entire model has no geometry 🤯
          self.value = undefined;
        } else {
          // Ensure value is initialised
          const approximateAabb = self.value ??= AxisAlignedBoundingBox.zero();

          approximateAabb.setValue(modelApproximateAabb.value)
            // Recompute approximate AABB in world space
            .transformSelf(worldMatrixComputed.value);
        }
      },
    });
  }

  // Read-only data
  public get allVertexPositions(): readonly IReadonlyVector3[] { return this._allVertexPositions.value; }
  public get allVertexNormals(): readonly IReadonlyVector3[] { return this._allVertexNormals.value; }
  public get allTriangleIndices(): readonly IReadonlyTriangleIndices[] { return this._allTriangleIndices.value; }
  public get allTriangles(): readonly Triangle[] { return this._allTriangles.value; }
  public get allTriangleNormals(): readonly IReadonlyVector3[] { return this._allTriangleNormals.value; }
  public get allEdgeIndices(): readonly EdgeIndices[] { return this._allEdgeIndices.value; }
  public get allEdges(): readonly Edge[] { return this._allEdges.value; }
  public get allVertexColors(): readonly (IReadonlyColor4 | undefined)[] { return this._allVertexColors.value; }
  public get allVertexTextureCoordinates(): readonly (IReadonlyVector2 | undefined)[] { return this._allVertexTextureCoordinates.value; }
  public get aabb(): IReadonlyAxisAlignedBoundingBox | undefined { return this._aabb.value.value; }
  public get approximateAabb(): IReadonlyAxisAlignedBoundingBox | undefined { return this._approximateAabb.value.value; }

  // Computeds
  public get allVertexPositionsComputed(): Computed<readonly IReadonlyVector3[]> { return this._allVertexPositions; }
  public get allVertexNormalsComputed(): Computed<readonly IReadonlyVector3[]> { return this._allVertexNormals; }
  public get allTriangleIndicesComputed(): Computed<readonly IReadonlyTriangleIndices[]> { return this._allTriangleIndices; }
  public get allTrianglesComputed(): Computed<readonly Triangle[]> { return this._allTriangles; }
  public get allTriangleNormalsComputed(): Computed<readonly IReadonlyVector3[]> { return this._allTriangleNormals; }
  public get allEdgeIndicesComputed(): Computed<readonly EdgeIndices[]> { return this._allEdgeIndices; }
  public get allEdgesComputed(): Computed<readonly Edge[]> { return this._allEdges; }
  public get allVertexColorsComputed(): Computed<readonly (IReadonlyColor4 | undefined)[]> { return this._allVertexColors; }
  public get allVertexTextureCoordinatesComputed(): Computed<readonly (IReadonlyVector2 | undefined)[]> { return this._allVertexTextureCoordinates; }
  public get aabbComputed(): Computed<Optional<IReadonlyAxisAlignedBoundingBox>> { return this._aabb; }
  public get approximateAabbComputed(): Computed<Optional<IReadonlyAxisAlignedBoundingBox>> { return this._approximateAabb; }
}

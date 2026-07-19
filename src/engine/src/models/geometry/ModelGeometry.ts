import  { type IReadonlyVector3 } from "@lopoly/core/math/Vector3";
import  { type IReadonlyVector2 } from "@lopoly/core/math/Vector2";
import  type { IReadonlyColor4 } from "@lopoly/core/math/Color4";
import  { Computed } from "@lopoly/core/util/Computed";
import  { Optional, type Mutable } from "@lopoly/core/util/types";
import  { AxisAlignedBoundingBox, type IReadonlyAxisAlignedBoundingBox } from "@lopoly/engine/collision";

import type { ModelPart } from "../ModelPart";
import type { ModelConfig } from "../ModelConfig";
import {
  TriangleIndices,
  type Edge,
  type EdgeIndices,
  type IReadonlyTriangleIndices,
  type Triangle,
} from "./index";

/**
 * Exposes a read-only view of the combined geometry of an entire model.
 */
export class ModelGeometry {
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

  public constructor(parts: ModelPart[], modelConfig: ModelConfig) {
    /* Vertex positions */
    this._allVertexPositions = new Computed<readonly IReadonlyVector3[]>([], {
      dependencies: [
        ...parts.map((part) => part.geometry.allVertexPositionsComputed),
      ],
      recompute: (_self) => {
        const self = _self as Mutable<typeof _self>; // @NOTE type laundering for mutability

        self.length = 0;
        for (const part of parts) {
          self.push(...part.geometry.allVertexPositionsComputed.value);
        }
      },
    });
    /* Vertex normals */
    this._allVertexNormals = new Computed<readonly IReadonlyVector3[]>([], {
      dependencies: [
        ...parts.map((part) => part.geometry.allVertexNormalsComputed),
      ],
      recompute: (_self) => {
        const self = _self as Mutable<typeof _self>; // @NOTE type laundering for mutability

        self.length = 0;
        for (const part of parts) {
          self.push(...part.geometry.allVertexNormalsComputed.value);
        }
      },
    });

    /* Triangles */
    this._allTriangleIndices = new Computed<readonly IReadonlyTriangleIndices[]>([], {
      dependencies: [
        // @NOTE Do not depend on `part.geometry.allVertexPositions` since we only need length (which cannot change)
        ...parts.map((part) => part.geometry.allTriangleIndicesComputed),
      ],
      recompute: (_self) => {
        const self = _self as TriangleIndices[]; // @NOTE type laundering for mutability

        /**
         * We need to keep track of an offset for vertex indices,
         * since we are merging multiple primitives into one.
         */
        let vertexIndexOffset = 0;
        let triangleCount = 0;
        for (const part of parts) {
          for (const triangleIndices of part.geometry.allTriangleIndicesComputed.value) {
            const aIndex = triangleIndices.aIndex + vertexIndexOffset;
            const bIndex = triangleIndices.bIndex + vertexIndexOffset;
            const cIndex = triangleIndices.cIndex + vertexIndexOffset;
            if (self[triangleCount] !== undefined) {
              // Re-use existing instances
              self[triangleCount].setValue(aIndex, bIndex, cIndex);
            } else {
              // Build up array for the first time
              self[triangleCount] = new TriangleIndices(aIndex, bIndex, cIndex);
            }
            triangleCount++;
          }
          vertexIndexOffset += part.geometry.allVertexPositionsComputed.value.length;
        }
      },
    });
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
        ...parts.map((part) => part.geometry.allTriangleNormalsComputed),
      ],
      recompute: (_self) => {
        const self = _self as Mutable<typeof _self>; // @NOTE type laundering for mutability

        self.length = 0;
        for (const part of parts) {
          self.push(...part.geometry.allTriangleNormalsComputed.value);
        }
      },
    });

    /* Edges */
    this._allEdgeIndices = new Computed<readonly EdgeIndices[]>([], {
      dependencies: [
        // @NOTE Do not depend on `part.geometry.allVertexPositions` since we only need length (which cannot change)
        ...parts.map((part) => part.geometry.allEdgeIndicesComputed),
      ],
      recompute: (_self) => {
        const self = _self as Mutable<EdgeIndices>[]; // @NOTE type laundering for mutability

        /**
         * We need to keep track of an offset for vertex indices,
         * since we are merging multiple primitives into one.
         */
        let vertexIndexOffset = 0;
        let edgeCount = 0;
        for (const part of parts) {
          for (const edgeIndices of part.geometry.allEdgeIndicesComputed.value) {
            const aIndex = edgeIndices[0] + vertexIndexOffset;
            const bIndex = edgeIndices[1] + vertexIndexOffset;
            if (self[edgeCount] !== undefined) {
              // Re-use existing instances
              self[edgeCount][0] = aIndex;
              self[edgeCount][1] = bIndex;
            } else {
              // Build up array for the first time
              self[edgeCount] = [
                aIndex,
                bIndex,
              ];
            }

            edgeCount++;
          }
          vertexIndexOffset += part.geometry.allVertexPositionsComputed.value.length;

        }

        // Number of unique edges can change, so ensure array is always correct size
        self.length = edgeCount;
      },
    });
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
    this._allVertexColors = new Computed<readonly (IReadonlyColor4 | undefined)[]>([], {
      dependencies: [
        ...parts.map((part) => part.geometry.allVertexColorsComputed),
      ],
      recompute: (_self) => {
        const self = _self as Mutable<typeof _self>; // @NOTE type laundering for mutability

        self.length = 0;
        for (const part of parts) {
          self.push(...part.geometry.allVertexColorsComputed.value);
        }
      },
    });

    /* Texture coordinates */
    this._allVertexTextureCoordinates = new Computed<readonly (IReadonlyVector2 | undefined)[]>([], {
      dependencies: [
        ...parts.map((part) => part.geometry.allVertexTextureCoordinatesComputed),
      ],
      recompute: (_self) => {
        const self = _self as Mutable<typeof _self>; // @NOTE type laundering for mutability

        self.length = 0;
        for (const part of parts) {
          self.push(...part.geometry.allVertexTextureCoordinatesComputed.value);
        }
      },
    });

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
        modelConfig,
      ],
      recompute: (_self) => {
        const self = _self as Optional<AxisAlignedBoundingBox>;

        const anyPartsHaveSkin = parts.some((part) => part.skin !== undefined);

        if (modelConfig.aabbApproximationPolicy.type === 'fixed' && anyPartsHaveSkin) {
          /* Fixed size AABB approximation (skinned models ONLY) */
          // Ensure value is initialised
          const aabb = (self.value as AxisAlignedBoundingBox) ??= AxisAlignedBoundingBox.zero();
          aabb.setValue(modelConfig.aabbApproximationPolicy.dimensions);
        } else {
          const partAABBs = parts
            .map((part) => part.geometry.approximateAabb)
            .filter((maybeAabb) => maybeAabb !== undefined);

          if (partAABBs.length === 0) {
            // Entire model has no geometry 🤯
            self.value = undefined;
          } else {
            // Ensure value is initialised
            const aabb = self.value ??= AxisAlignedBoundingBox.zero();

            // Combine child AABBs
            for (let i = 0; i < partAABBs.length; i++) {
              const partAABB = partAABBs[i];
              if (i === 0) {
                aabb.setValue(partAABB);
              } else {
                aabb.unionSelf(partAABB);
              }
            }


            // Apply AABB approximation policy only if any model parts have skin
            // Unskinned models' approximate AABBs should be identical to their actual AABB
            if (anyPartsHaveSkin) {
              switch (modelConfig.aabbApproximationPolicy.type) {
                case 'scaled': {
                  const scaleFactor = modelConfig.aabbApproximationPolicy.scaleFactor;
                  const xCenter = (aabb.xMin + aabb.xMax) / 2;
                  const yCenter = (aabb.yMin + aabb.yMax) / 2;
                  const zCenter = (aabb.zMin + aabb.zMax) / 2;

                  const xDim = xCenter - aabb.xMin;
                  const yDim = yCenter - aabb.yMin;
                  const zDim = zCenter - aabb.zMin;

                  // @NOTE Set approximate AABB to a cube with the dimensions of the original AABB's longest side
                  const biggestDim = Math.max(xDim, yDim, zDim);

                  aabb.xMin = xCenter - biggestDim * scaleFactor;
                  aabb.yMin = yCenter - biggestDim * scaleFactor;
                  aabb.zMin = zCenter - biggestDim * scaleFactor;
                  aabb.xMax = xCenter + biggestDim * scaleFactor;
                  aabb.yMax = yCenter + biggestDim * scaleFactor;
                  aabb.zMax = zCenter + biggestDim * scaleFactor;
                  break;
                }
                default:
                  throw new Error(`Unimplemented AABB approximation policy type: '${(modelConfig.aabbApproximationPolicy as { type: string }).type}'`);
              }
            }
          }
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
  public get aabb(): Optional<IReadonlyAxisAlignedBoundingBox> { return this._aabb.value; }
  public get approximateAabb(): Optional<IReadonlyAxisAlignedBoundingBox> { return this._approximateAabb.value; }

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

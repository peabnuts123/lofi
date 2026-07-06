import { type IReadonlyVector2, type IReadonlyVector3 } from "@lofi/core/math/vector";
import type { IReadonlyColor4 } from "@lofi/core/math/Color4";
import { Computed } from "@lofi/core/util/observable";
import { Optional, type Mutable } from "@lofi/core/util/types";
import { AxisAlignedBoundingBox, type IReadonlyAxisAlignedBoundingBox } from "@lofi/engine/collision";

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
  public readonly allVertexPositions: Computed<readonly IReadonlyVector3[]>;
  public readonly allVertexNormals: Computed<readonly IReadonlyVector3[]>;
  public readonly allTriangleIndices: Computed<readonly IReadonlyTriangleIndices[]>;
  public readonly allTriangles: Computed<readonly Triangle[]>;
  public readonly allTriangleNormals: Computed<readonly IReadonlyVector3[]>;
  public readonly allEdgeIndices: Computed<readonly EdgeIndices[]>;
  public readonly allEdges: Computed<readonly Edge[]>;
  public readonly allVertexColors: Computed<readonly (IReadonlyColor4 | undefined)[]>;
  public readonly allVertexTextureCoordinates: Computed<readonly (IReadonlyVector2 | undefined)[]>;
  public readonly aabb: Computed<Optional<IReadonlyAxisAlignedBoundingBox>>;
  public readonly approximateAabb: Computed<Optional<IReadonlyAxisAlignedBoundingBox>>;

  public constructor(parts: ModelPart[], modelConfig: ModelConfig) {
    /* Vertex positions */
    this.allVertexPositions = new Computed<readonly IReadonlyVector3[]>([], {
      dependencies: [
        ...parts.map((part) => part.geometry.allVertexPositions),
      ],
      recompute: (_self) => {
        const self = _self as Mutable<typeof _self>; // @NOTE type laundering for mutability

        self.length = 0;
        for (const part of parts) {
          self.push(...part.geometry.allVertexPositions.value);
        }
      },
    });
    /* Vertex normals */
    this.allVertexNormals = new Computed<readonly IReadonlyVector3[]>([], {
      dependencies: [
        ...parts.map((part) => part.geometry.allVertexNormals),
      ],
      recompute: (_self) => {
        const self = _self as Mutable<typeof _self>; // @NOTE type laundering for mutability

        self.length = 0;
        for (const part of parts) {
          self.push(...part.geometry.allVertexNormals.value);
        }
      },
    });

    /* Triangles */
    this.allTriangleIndices = new Computed<readonly IReadonlyTriangleIndices[]>([], {
      dependencies: [
        // @NOTE Do not depend on `part.geometry.allVertexPositions` since we only need length (which cannot change)
        ...parts.map((part) => part.geometry.allTriangleIndices),
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
          for (const triangleIndices of part.geometry.allTriangleIndices.value) {
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
          vertexIndexOffset += part.geometry.allVertexPositions.value.length;
        }
      },
    });
    this.allTriangles = new Computed<readonly Triangle[]>([], {
      dependencies: [
        this.allVertexPositions,
        this.allTriangleIndices,
      ],
      recompute: (_self) => {
        const self = _self as Mutable<Triangle>[]; // @NOTE type laundering for mutability

        let triangleCount = 0;
        const allVertexPositions = this.allVertexPositions.value;
        for (const triangleIndices of this.allTriangleIndices.value) {
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
    this.allTriangleNormals = new Computed<readonly IReadonlyVector3[]>([], {
      dependencies: [
        ...parts.map((part) => part.geometry.allTriangleNormals),
      ],
      recompute: (_self) => {
        const self = _self as Mutable<typeof _self>; // @NOTE type laundering for mutability

        self.length = 0;
        for (const part of parts) {
          self.push(...part.geometry.allTriangleNormals.value);
        }
      },
    });

    /* Edges */
    this.allEdgeIndices = new Computed<readonly EdgeIndices[]>([], {
      dependencies: [
        // @NOTE Do not depend on `part.geometry.allVertexPositions` since we only need length (which cannot change)
        ...parts.map((part) => part.geometry.allEdgeIndices),
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
          for (const edgeIndices of part.geometry.allEdgeIndices.value) {
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
          vertexIndexOffset += part.geometry.allVertexPositions.value.length;

        }

        // Number of unique edges can change, so ensure array is always correct size
        self.length = edgeCount;
      },
    });
    this.allEdges = new Computed<readonly Edge[]>([], {
      dependencies: [
        this.allVertexPositions,
        this.allEdgeIndices,
      ],
      recompute: (_self) => {
        const self = _self as Mutable<Edge>[]; // @NOTE type laundering for mutability

        let edgeCount = 0;
        const allVertexPositions = this.allVertexPositions.value;
        for (const edgeIndices of this.allEdgeIndices.value) {
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
    this.allVertexColors = new Computed<readonly (IReadonlyColor4 | undefined)[]>([], {
      dependencies: [
        ...parts.map((part) => part.geometry.allVertexColors),
      ],
      recompute: (_self) => {
        const self = _self as Mutable<typeof _self>; // @NOTE type laundering for mutability

        self.length = 0;
        for (const part of parts) {
          self.push(...part.geometry.allVertexColors.value);
        }
      },
    });

    /* Texture coordinates */
    this.allVertexTextureCoordinates = new Computed<readonly (IReadonlyVector2 | undefined)[]>([], {
      dependencies: [
        ...parts.map((part) => part.geometry.allVertexTextureCoordinates),
      ],
      recompute: (_self) => {
        const self = _self as Mutable<typeof _self>; // @NOTE type laundering for mutability

        self.length = 0;
        for (const part of parts) {
          self.push(...part.geometry.allVertexTextureCoordinates.value);
        }
      },
    });

    /* AABB */
    this.aabb = new Computed<Optional<IReadonlyAxisAlignedBoundingBox>>(Optional(), {
      dependencies: [
        this.allVertexPositions,
      ],
      recompute: (_self) => {
        const self = _self as Optional<AxisAlignedBoundingBox>; // @NOTE type laundering for mutability

        const allVertexPositions = this.allVertexPositions.value;
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
    this.approximateAabb = new Computed<Optional<IReadonlyAxisAlignedBoundingBox>>(Optional(), {
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
}

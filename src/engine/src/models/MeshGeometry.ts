import { Vector3 } from "@lofi/core/math/vector";
import type { AttributeDefinition, MeshDefinition } from "@lofi/engine/loaders/definitions";

export type Triangle = [Vector3, Vector3, Vector3];
export type TriangleIndices = [number, number, number];
export type Edge = [Vector3, Vector3];
export type EdgeIndices = [number, number];


// @NOTE Specific to a mesh node
// @TODO Rename
export class MeshGeometry {
  public readonly vertexPositions: Vector3[] = [];
  public readonly vertexNormals: Vector3[] = [];
  public readonly triangles: Triangle[] = []; // @NOTE Not actually used?
  public readonly triangleIndices: TriangleIndices[] = [];
  public readonly triangleNormals: Vector3[] = [];
  public readonly edges: Edge[] = []; // @NOTE Not actually used?
  public readonly edgeIndices: EdgeIndices[] = [];


  public constructor(definition: MeshDefinition) {
    /**
     * Offset for vertex indices, added to any indices present in mesh definition.
     * This is necessary because we are combining many primitives into one.
     */
    let vertexIndexOffset = 0;
    for (const meshPrimitive of definition.primitives) {
      /* Positions */
      const vertexPositions = parseAttributeVector3(meshPrimitive.positionData);
      this.vertexPositions.push(...vertexPositions);

      /* Triangles */
      let triangleIndices: TriangleIndices[];
      if (meshPrimitive.indices) {
        // Triangles defined by vertex indices
        triangleIndices = parseAttributeTriangleIndices(meshPrimitive.indices, vertexIndexOffset);
      } else {
        // Triangles assumed to be sequential
        triangleIndices = [];
        for (let i = 0; i < meshPrimitive.positionData.buffer.length / 3; i += 3) {
          triangleIndices.push([
            i + vertexIndexOffset,
            i + 1 + vertexIndexOffset,
            i + 2 + vertexIndexOffset,
          ]);
        }
      }
      this.triangleIndices.push(...triangleIndices);
      this.triangles.push(...triangleIndices.map((triangle, i) => {
        // Validate
        if (triangle.length !== 3) {
          throw new Error(`Cannot compile ${MeshGeometry.name}. Triangle ${i} does not specify 3 vertices`);
        }

        const vertices: Triangle = [
          this.vertexPositions[triangle[0]],
          this.vertexPositions[triangle[1]],
          this.vertexPositions[triangle[2]],
        ];

        vertices.forEach((vertex, vertexIndex) => {
          if (vertex === undefined) throw new Error(`Triangle ${i} vertex ${vertexIndex} is out of bounds: ${triangle[vertexIndex]}`);
        });

        return vertices;
      }));

      /* Triangle normals */
      const triangleNormals = triangleIndices.map((triangle) => {
        // @NOTE we know these indices are valid because we validated while building `triangles` above
        const edge1 = this.vertexPositions[triangle[1]].subtract(this.vertexPositions[triangle[0]]);
        const edge2 = this.vertexPositions[triangle[2]].subtract(this.vertexPositions[triangle[0]]);
        return edge1.cross(edge2).normalizeSelf();
      });
      this.triangleNormals.push(...triangleNormals);
      /* Normals */
      if (meshPrimitive.normalData !== undefined) {
        // Normals provided by asset
        this.vertexNormals.push(...parseAttributeVector3(meshPrimitive.normalData));
      } else {
        // Normals MISSING from asset - generate normals

        // Initialise normals to zero
        const normals = vertexPositions.map(() => Vector3.zero());

        triangleIndices.forEach((triangle, i) => {
          const triangleNormal = triangleNormals[i];
          // Add to each vertices' normal (will be normalized later)
          // @NOTE Subtract `vertexIndexOffset` to convert back to "local" indices
          normals[triangle[0] - vertexIndexOffset].addSelf(triangleNormal);
          normals[triangle[1] - vertexIndexOffset].addSelf(triangleNormal);
          normals[triangle[2] - vertexIndexOffset].addSelf(triangleNormal);
        });

        // Normalize all vectors
        this.vertexNormals.push(...normals.map((normal) => normal.normalizeSelf()));
      }

      /* Edges */
      // Build up a set of all unique edge indices
      const edgeSet = new Set<string>();
      triangleIndices.forEach((triangle) => {
        function addEdge(indexA: number, indexB: number): void {
          const edge: EdgeIndices = indexA < indexB ? [indexA, indexB] : [indexB, indexA];
          // @NOTE we must stringify the edge because JavaScript tests for
          // array equality by reference, so the `Set` type does not work natively
          edgeSet.add(`${edge[0]},${edge[1]}`);
        }

        addEdge(triangle[0], triangle[1]);
        addEdge(triangle[1], triangle[2]);
        addEdge(triangle[2], triangle[0]);
      });

      // @NOTE Because set has to be a string, we have to then parse all the numbers back out 🙄
      const edgeIndices = [...edgeSet.values()].map((edgeString) => {
        const [index1, index2] = edgeString.split(',').map((s) => Number(s));
        return [index1, index2] as EdgeIndices;
      });
      this.edgeIndices.push(...edgeIndices);
      this.edges.push(...edgeIndices.map((edge) => {
        return [
          this.vertexPositions[edge[0]],
          this.vertexPositions[edge[1]],
        ] as Edge;
      }));

      vertexIndexOffset = this.vertexPositions.length;
    }
  }
}

function parseAttributeVector3(attribute: AttributeDefinition): Vector3[] {
  if (attribute.componentCount !== 3) {
    throw new Error(`Cannot parse attribute as Vector3: component count is not 3 (componentCount='${attribute.componentCount}')`);
  }

  const result: Vector3[] = [];

  for (let i = 2; i < attribute.buffer.length; i += 3) {
    result.push(new Vector3(
      attribute.buffer[i - 2],
      attribute.buffer[i - 1],
      attribute.buffer[i],
    ));
  }

  return result;
}

function parseAttributeTriangleIndices(attribute: AttributeDefinition, vertexIndexOffset: number): TriangleIndices[] {
  if (attribute.componentCount !== 1) {
    throw new Error(`Cannot parse attribute as Triangle Indices: component count is not 1 (componentCount='${attribute.componentCount}')`);
  }

  const result: TriangleIndices[] = [];

  for (let i = 2; i < attribute.buffer.length; i += 3) {
    result.push([
      attribute.buffer[i - 2] + vertexIndexOffset,
      attribute.buffer[i - 1] + vertexIndexOffset,
      attribute.buffer[i] + vertexIndexOffset,
    ]);
  }

  return result;
}

// function parseAttributeTriangle(attribute: AttributeDefinition): Triangle[] {
//   if (attribute.componentCount !== 3) {
//     throw new Error(`Cannot parse attribute as Triangles: component count is not 3 (componentCount='${attribute.componentCount}')`);
//   }

//   const result: Triangle[] = [];

//   for (let i = 8; i < attribute.buffer.length; i += 9) {
//     result.push([
//       new Vector3(
//         attribute.buffer[i - 8],
//         attribute.buffer[i - 7],
//         attribute.buffer[i - 6],
//       ),
//       new Vector3(
//         attribute.buffer[i - 5],
//         attribute.buffer[i - 4],
//         attribute.buffer[i - 3],
//       ),
//       new Vector3(
//         attribute.buffer[i - 2],
//         attribute.buffer[i - 1],
//         attribute.buffer[i],
//       ),
//     ]);
//   }

//   return result;
// }

// function parseAttributeColor(attribute: AttributeDefinition): Color3[] | Color4[] {
//   if (attribute.componentCount !== 3 && attribute.componentCount !== 4) {
//     throw new Error(`Cannot parse attribute as Color3 or Color4: component count is not 3 or 4 (componentCount='${attribute.componentCount}')`);
//   }

//   const result: Color3[] | Color4[] = [];

//   let normalizationQuotient = 1;
//   if (attribute.normalized) {
//     switch (attribute.componentType) {
//       case WebGL2RenderingContext.UNSIGNED_BYTE:
//         normalizationQuotient = 0xFF;
//         break;
//       case WebGL2RenderingContext.UNSIGNED_SHORT:
//         normalizationQuotient = 0xFF_FF;
//         break;
//       default:
//         throw new Error(`Invalid color component type: ${attribute.componentType}`);
//     }
//   }

//   for (let i = attribute.componentCount - 1; i < attribute.buffer.length; i += attribute.componentCount) {
//     if (attribute.componentCount === 3) {
//       (result as Color3[]).push(new Color3(
//         attribute.buffer[i - 2] / normalizationQuotient,
//         attribute.buffer[i - 1] / normalizationQuotient,
//         attribute.buffer[i] / normalizationQuotient,
//       ));
//     } else {
//       (result as Color4[]).push(new Color4(
//         attribute.buffer[i - 3] / normalizationQuotient,
//         attribute.buffer[i - 2] / normalizationQuotient,
//         attribute.buffer[i - 1] / normalizationQuotient,
//         attribute.buffer[i] / normalizationQuotient,
//       ));
//     }
//   }

//   return result;
// }

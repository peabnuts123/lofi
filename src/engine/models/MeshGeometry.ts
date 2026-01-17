import type { Color3Definition } from "@polyzone/engine/util/Color3";
import { Vector3, type Vector3Definition } from "@polyzone/engine/util/vector";
import { Color4 } from "../util/Color4";

export interface TextureCoordinate {
  u: number;
  v: number;
}
export type Triangle = [Vector3, Vector3, Vector3];
export type TriangleIndices = [number, number, number];
export type Edge = [Vector3, Vector3];
export type EdgeIndices = [number, number];

export interface MeshGeometryDefinition {
  vertexPositions: Vector3Definition[];
  vertexColors?: Color3Definition[];
  vertexNormals?: Vector3Definition[];
  textureCoordinates?: TextureCoordinate[];
  triangles: TriangleIndices[];
}

export class MeshGeometry {
  public readonly vertexPositions: Vector3[];
  public readonly vertexNormals: Vector3[];
  public readonly triangles: Triangle[];
  public readonly triangleIndices: TriangleIndices[];
  public readonly triangleNormals: Vector3[];
  public readonly edges: Edge[];
  public readonly edgeIndices: EdgeIndices[];

  public readonly vertexColors?: Color4[];
  public readonly textureCoordinates?: TextureCoordinate[];


  public constructor(definition: MeshGeometryDefinition) {
    /* Positions */
    this.vertexPositions = definition.vertexPositions.map((position) => new Vector3(
      position.x,
      position.y,
      position.z,
    ));
    /* Triangles */
    this.triangleIndices = definition.triangles; // @NOTE will be validated when we build `triangles`
    this.triangles = definition.triangles.map((triangle, i) => {
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
    });
    /* Triangle normals */
    this.triangleNormals = definition.triangles.map((triangle) => {
      // @NOTE we know these indices are valid because we validated while building `triangles` above
      const edge1 = this.vertexPositions[triangle[1]].subtract(this.vertexPositions[triangle[0]]);
      const edge2 = this.vertexPositions[triangle[2]].subtract(this.vertexPositions[triangle[0]]);
      return edge1.cross(edge2).normalizeSelf();
    });
    /* Normals */
    if (definition.vertexNormals !== undefined) {
      // Normals provided by asset
      this.vertexNormals = definition.vertexNormals.map((normal) => new Vector3(
        normal.x,
        normal.y,
        normal.z,
      ));
    } else {
      // Normals MISSING from asset - generate normals

      // Initialise normals to zero
      const normals = this.vertexPositions.map(() => Vector3.zero());

      definition.triangles.forEach((triangle, i) => {
        const triangleNormal = this.triangleNormals[i];
        // Add to each vertices' normal (will be normalized later)
        normals[triangle[0]].addSelf(triangleNormal);
        normals[triangle[1]].addSelf(triangleNormal);
        normals[triangle[2]].addSelf(triangleNormal);
      });

      // Normalize all vectors
      this.vertexNormals = normals.map((normal) => normal.normalizeSelf());
    }

    /* Colors */
    this.vertexColors = definition.vertexColors?.map((color) => new Color4(
      color.r,
      color.g,
      color.b,
      1, // @TODO Vertex color alpha
    ));

    /* Texture coordinates */
    this.textureCoordinates = definition.textureCoordinates;

    /* Edges */
    // Build up a set of all unique edge indices
    const edgeSet = new Set<string>();
    this.triangleIndices.forEach((triangle) => {
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
    this.edgeIndices = [...edgeSet.values()].map((edgeString) => {
      const [index1, index2] = edgeString.split(',').map((s) => Number(s));
      return [index1, index2];
    });
    this.edges = this.edgeIndices.map((edge) => {
      return [
        this.vertexPositions[edge[0]],
        this.vertexPositions[edge[1]],
      ];
    });
  }
}

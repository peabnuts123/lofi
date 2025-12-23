import { ImporterObj, type Mesh, type Triangle, type Model, type Vector2, type ImportCallbacks } from 'online-3d-viewer/source/engine/import/importerobj';

import type { Vector3 } from '@polyzone/engine/util/vector';
import type { Color3 } from '@polyzone/engine/util/color';
import type { TextureCoordinate } from '@polyzone/engine/models/SubMesh';
import type { MaterialDefinition } from '@polyzone/engine/materials/Material';
import { canonicalisePath } from '@polyzone/engine/util/path';
import type { IFileSystem } from '@polyzone/engine/filesystem';
import type { ModelDefinition } from '@polyzone/engine/models';

interface VertexInfo {
  position: Vector3;
  normal: Vector3 | undefined;
  color: Color3 | undefined;
  textureCoordinate: TextureCoordinate | undefined;
  materialIndex: number;
}

function loadVertex(
  objMesh: Mesh,
  vertexData: VertexInfo[],
  triangle: Triangle,
  vertexIndex: number,
  materialIndex: number,
): void {
  /**
   * Look up a value in `collection` based on a given property in `triangle`.
   * @example
   * ```
   * prefix = 'n'
   * vertexIndex = 0
   * => property = 'n0'
   * => index = triangle['n0']
   * => collection[index]
   * ```
   * e.g. prefix 'n' => `triangle.n0` => `collection[triangle.n0]`
   * @param collection The collection to dereference based on the index stored in the property on `triangle`
   * @param prefix Prefix of the property name on `triangle` e.g. `'n' => n0`
   */
  function dereference<T, TArray extends Array<T>>(collection: TArray, prefix: string): T | undefined;
  function dereference<T, TArray extends Array<T>, TResult>(collection: TArray, prefix: string, map: (result: T) => TResult): TResult | undefined;
  function dereference<T, TArray extends Array<T>, TResult = T>(collection: TArray, prefix: string, map?: (result: T) => TResult): TResult | undefined {
    const index = triangle[`${prefix}${vertexIndex}` as keyof Triangle];
    if (index === null) {
      return undefined;
    } else {
      const result = collection[index];
      if (map !== undefined) {
        return map(result);
      } else {
        return result as unknown as TResult; // @NOTE Type laundering
      }
    }
  };

  vertexData.push({
    position: dereference(objMesh.vertices, 'v')!, // @NOTE position is always defined
    normal: dereference(objMesh.normals, 'n'),
    color: dereference(objMesh.vertexColors, 'c'),
    textureCoordinate: dereference(objMesh.uvs, 'u', (uv: Vector2) => ({
      u: uv.x,
      v: uv.y,
    })),
    materialIndex,
  });
}

export class ObjLoader {
  public async loadModel(objPath: string, filesystem: IFileSystem): Promise<ModelDefinition> {
    const objFile = await filesystem.readFile(objPath);

    function parseObjFile(callbacks: Partial<ImportCallbacks>): Promise<Model> {
      return new Promise((resolve, reject) => {
        const importer = new ImporterObj();
        importer.Import("model", ".obj", objFile.bytes, {
          onSuccess() { },
          getFileBuffer(): Uint8Array | undefined { return undefined; },
          getDefaultLineMaterialColor() { return undefined; },
          getDefaultMaterialColor() { return undefined; },
          onComplete() {
            resolve(importer.model);
          },
          onError(...args: unknown[]): void {
            console.error(`[ObjLoader] (Importer.onError):`, args);
            // @TODO figure out argument types (test with a bad .obj or something)
            reject(new Error(`Failed to parsed obj: ${args.map(x => Object.toString.call(x)).join(', ')}`));
          },
          ...callbacks,
        });
      });
    }

    const knownFiles: Record<string, Uint8Array> = {};
    let newFilePaths: string[] = [];
    let parsedModel: Model;

    // @NOTE `online-3d-viewer` loader is not async, so we have to work around it :/
    // Re-parse .obj repeatedly until we've successfully parsed all dependencies (e.g. .mtl, or textures)
    do {
      // Read .obj, collect any new dependency file paths
      newFilePaths = [];
      parsedModel = await parseObjFile({
        getFileBuffer(filePath: string): Uint8Array | undefined {
          if (!filePath.startsWith('/')) {
            // `filePath` is relative, resolve it relative to `objPath`
            filePath = canonicalisePath(`${objPath}/../${filePath}`);
          }

          if (knownFiles[filePath] === undefined) {
            newFilePaths.push(filePath);
            return undefined;
          } else {

            return knownFiles[filePath];
          }
        },
      });

      // Read new dependency files
      if (newFilePaths.length > 0) {
        const newFiles = await Promise.all(newFilePaths.map((path) =>
          filesystem.readFile(path)
            .then((file) => ({
              path,
              bytes: file.bytes,
            })),
        ));
        for (const { path, bytes } of newFiles) {
          knownFiles[path] = bytes;
        }
      }
    } while (newFilePaths.length > 0);

    console.log(`[DEBUG] [ObjLoader] (loadModel) parsedModel:`, parsedModel);

    // @NOTE @ASSUMPTION: objects always have exactly 1 root mesh
    // @TODO they probably don't. There's no harm in iterating through them, since we are just returning
    //  a collection of submeshes anyway.
    // @TODO also `root` has a tree of nodes. We might just want to iterate `meshes[]` instead.
    const objMesh = parsedModel.meshes[parsedModel.root.meshIndices[0]];

    // Mesh data is grouped by material
    const groupedVertexData: Record<string, VertexInfo[]> = {};
    const groupedTriangleData: Record<string, number[][]> = {};
    const groupedMaterialData: Record<string, MaterialDefinition> = {};

    for (const triangle of objMesh.triangles) {
      // Triangles with no material assigned to default group `-1`
      const materialIndex = triangle.mat ?? -1;

      /* Vertex data */
      const vertexData = groupedVertexData[materialIndex] ??= [];
      // @NOTE Flip winding order 0 -> 2 -> 1
      // @TODO might need to implement this as an option
      loadVertex(objMesh, vertexData, triangle, 0, materialIndex);
      loadVertex(objMesh, vertexData, triangle, 2, materialIndex);
      loadVertex(objMesh, vertexData, triangle, 1, materialIndex);

      /* Triangle data */
      const triangles = groupedTriangleData[materialIndex] ??= [];
      triangles.push([vertexData.length - 1, vertexData.length - 2, vertexData.length - 3]);

      /* Material data */
      if (materialIndex !== -1) {
        // Material exists
        groupedMaterialData[materialIndex] ??= {
          name: parsedModel.materials[materialIndex].name,
          diffuseColor: {
            r: parsedModel.materials[materialIndex].color.r / 0xFF,
            g: parsedModel.materials[materialIndex].color.g / 0xFF,
            b: parsedModel.materials[materialIndex].color.b / 0xFF,
          },
        };
      } else {
        // Default material / no material
        groupedMaterialData[materialIndex] ??= { name: 'default' };
      }
    }

    function getVertexProperty<TProperty>(vertexData: VertexInfo[], selector: (vertex: VertexInfo) => TProperty): NonNullable<TProperty>[] | undefined {
      // @NOTE @ASSUMPTION Either every property is defined, or none of them are.
      // If the first vertex is lacking the property, it's assumed no vertices have it.
      // If the first vertex does have the property, it's assumed every vertex has it.
      if (vertexData.length === 0) {
        return undefined;
      } else if (selector(vertexData[0]) === undefined) {
        return undefined;
      } else {
        return vertexData.map((vertex) => selector(vertex) as NonNullable<TProperty>);
      }
    }

    return {
      subMeshes: Object.keys(groupedVertexData).map((materialIndex) => {
        const vertexData = groupedVertexData[materialIndex];
        const triangleData = groupedTriangleData[materialIndex];
        const material = groupedMaterialData[materialIndex];
        return {
          geometry: {
            vertexPositions: getVertexProperty(vertexData, (vertex) => vertex.position)!,
            vertexColors: getVertexProperty(vertexData, (vertex) => vertex.color),
            vertexNormals: getVertexProperty(vertexData, (vertex) => vertex.normal),
            textureCoordinates: getVertexProperty(vertexData, (vertex) => vertex.textureCoordinate),
            triangles: triangleData,
          },
          material,
        };
      }),
    };
  };
}

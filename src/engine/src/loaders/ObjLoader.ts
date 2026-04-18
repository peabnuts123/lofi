import {
  ImporterObj,
  type Mesh,
  type Triangle as TriangleObj,
  type Model as ModelObj,
  type ImportCallbacks,
  type Node as PartObj,
  type Material as MaterialObj,
} from 'online-3d-viewer/source/engine/import/importerobj';

import { Vector3, type Vector3Definition, type Vector2Like } from '@lofi/core/math/vector';
import { Quaternion } from '@lofi/core/math/Quaternion';
import { Color4 } from '@lofi/core/math/Color4';
import { canonicalisePath, getFileExtension } from '@lofi/core/util/path';
import type { Color3Definition } from '@lofi/core/math/Color3';
import type { IFileSystem, VirtualFile } from '@lofi/engine/filesystem';

import type {
  MaterialDefinition,
  MeshPrimitiveDefinition,
  ModelDefinition,
  ModelPartDefinition,
} from './definitions';
import { Texture } from '../textures';
import { transformDefinition } from './util';

export class ObjLoader {
  private readonly objPath: string;
  private readonly filesystem: IFileSystem;
  private readonly parsedObj: ModelObj;

  private readonly materialCache: Map<number, Promise<MaterialDefinition | undefined>>;

  private constructor(objPath: string, filesystem: IFileSystem, parsedObj: ModelObj) {
    this.objPath = objPath;
    this.filesystem = filesystem;
    this.parsedObj = parsedObj;
    this.materialCache = new Map();
  }

  public static async loadModel(objPath: string, filesystem: IFileSystem): Promise<ModelDefinition> {
    const objFile = await filesystem.readFile(objPath);

    const knownFiles: Record<string, Uint8Array> = {};
    let newFilePaths: string[] = [];
    let parsedObj: ModelObj;

    // @NOTE `online-3d-viewer` loader is not async, so we have to work around it :/
    // Re-parse .obj repeatedly until we've successfully parsed all dependencies (e.g. .mtl, or textures)
    do {
      // Read .obj, collect any new dependency file paths
      newFilePaths = [];
      parsedObj = await this.parseObjFile(objFile, {
        getFileBuffer(filePath: string): Uint8Array | undefined {
          filePath = canonicaliseDependencyPath(objPath, filePath);

          const fileExt = getFileExtension(filePath).toLocaleLowerCase();

          // @NOTE Only look up .mtl files
          // We could look up EVERY file here (including textures) and
          //  they will be parsed, but we don't even use them in this loader
          //  so it is a waste.
          // @TODO texture dependencies
          if (knownFiles[filePath] === undefined) {
            // @DEBUG
            console.log(`[DEBUG] [${ObjLoader.name}] (${ObjLoader.loadModel.name}) Encountered .obj dependency: ${filePath}`);
          }
          if (fileExt === '.mtl' && knownFiles[filePath] === undefined) {
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

    console.log(`[DEBUG] [${ObjLoader.name}] (${ObjLoader.loadModel.name}) parsedModel:`, parsedObj);

    const loader = new ObjLoader(objPath, filesystem, parsedObj);

    const rootPartDefinition = await loader.parsePart(parsedObj.root);

    return {
      // @NOTE For ease of authoring, expect .obj to be exported with +Y-up. Convert to +Z-up by rotating along X.
      rootParts: [
        transformDefinition([rootPartDefinition], {
          rotation: Quaternion.fromAxisAngle(Vector3.right(), 90),
        }),
      ],
      animations: [],
      // @TODO Textures or whatever
    };
  }

  private static parseObjFile(objFile: VirtualFile, callbacks: Partial<ImportCallbacks>): Promise<ModelObj> {
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

  private async parsePart(part: PartObj): Promise<ModelPartDefinition> {
    const definition: ModelPartDefinition = {
      name: part.name,
      transform: {
        position: Vector3.zero(),
        rotation: Quaternion.identity(),
        scale: Vector3.one(),
      },
      children: await Promise.all(
        part.childNodes
          .map((childPart) => this.parsePart(childPart)),
      ),
    };

    const meshPrimitiveDefinitions = await Promise.all(
      part.meshIndices
        .map((meshIndex) => this.parseMesh(this.parsedObj.meshes[meshIndex])),
    );

    if (part.meshIndices.length > 0) {
      definition.mesh = {
        primitives: meshPrimitiveDefinitions.flat(),
      };
    }

    return definition;
  }

  private async parseMesh(mesh: Mesh): Promise<MeshPrimitiveDefinition[]> {
    const groupedPrimitiveData = new Map<number, {
      positions: Vector3Definition[],
      normals: Vector3Definition[],
      colors: Color3Definition[],
      texCoords: Vector2Like[],
    }>();

    for (const triangle of mesh.triangles) {
      const materialId = triangle.mat ?? -1;
      let primitiveData = groupedPrimitiveData.get(materialId);
      if (!primitiveData) {
        primitiveData = {
          positions: [],
          normals: [],
          colors: [],
          texCoords: [],
        };
        groupedPrimitiveData.set(materialId, primitiveData);
      }

      for (const vertexIndex of [0, 1, 2]) {
        // @NOTE @ASSUMPTION Positions are always defined
        const position = this.dereferenceTriangle(triangle, vertexIndex, mesh.vertices, 'v')!;
        primitiveData.positions.push(position);

        const normal = this.dereferenceTriangle(triangle, vertexIndex, mesh.normals, 'n');
        if (normal) primitiveData.normals.push(normal);

        const color = this.dereferenceTriangle(triangle, vertexIndex, mesh.vertexColors, 'c');
        if (color) primitiveData.colors.push(color);

        // @NOTE Invert texture coord since .obj seems to have inverted
        // coordinate space compared to WebGL
        const texCoord = this.dereferenceTriangle(triangle, vertexIndex, mesh.uvs, 'u');
        if (texCoord) primitiveData.texCoords.push({
          x: texCoord.x,
          y: -texCoord.y,
        });
      }
    }

    const primitiveDefinitions: MeshPrimitiveDefinition[] = [];

    for (const [materialId, primitiveData] of groupedPrimitiveData) {
      /* Calculate extents */
      let minPosition: Vector3 | undefined = undefined;
      let maxPosition: Vector3 | undefined = undefined;
      for (const position of primitiveData.positions) {
        if (minPosition === undefined) minPosition = new Vector3(position.x, position.y, position.z);
        if (maxPosition === undefined) maxPosition = new Vector3(position.x, position.y, position.z);

        if (position.x < minPosition.x) minPosition.x = position.x;
        if (position.x > maxPosition.x) maxPosition.x = position.x;
        if (position.y < minPosition.y) minPosition.y = position.y;
        if (position.y > maxPosition.y) maxPosition.y = position.y;
        if (position.z < minPosition.z) minPosition.z = position.z;
        if (position.z > maxPosition.z) maxPosition.z = position.z;
      }
      minPosition ??= Vector3.zero();
      maxPosition ??= Vector3.zero();


      /* Create primitive definition */
      const primitiveDefinition: MeshPrimitiveDefinition = {
        mode: WebGL2RenderingContext.TRIANGLES,
        positionData: {
          buffer: new Float32Array(primitiveData.positions.flatMap((vertex) => [vertex.x, vertex.y, vertex.z])),
          componentCount: 3,
          componentType: WebGL2RenderingContext.FLOAT,
          componentSize: 4,
          normalized: false,
        },
        extents: {
          min: minPosition,
          max: maxPosition,
        },
        material: await this.getCachedMaterial(materialId),
      };

      if (primitiveData.normals.length > 0) {
        primitiveDefinition.normalData = {
          buffer: new Float32Array(primitiveData.normals.flatMap((vertex) => [vertex.x, vertex.y, vertex.z])),
          componentCount: 3,
          componentType: WebGL2RenderingContext.FLOAT,
          componentSize: 4,
          normalized: false,
        };
      }
      if (primitiveData.texCoords.length > 0) {
        primitiveDefinition.texCoord0Data = {
          buffer: new Float32Array(primitiveData.texCoords.flatMap((vertex) => [vertex.x, vertex.y])),
          componentCount: 2,
          componentType: WebGL2RenderingContext.FLOAT,
          componentSize: 4,
          normalized: false,
        };
      }
      if (primitiveData.colors.length > 0) {
        primitiveDefinition.color0Data = {
          // @TODO will they be normalized or what?
          buffer: new Float32Array(primitiveData.colors.flatMap((vertex) => [vertex.r, vertex.g, vertex.b])),
          componentCount: 3,
          componentType: WebGL2RenderingContext.FLOAT,
          componentSize: 4,
          normalized: false,
        };
      }

      primitiveDefinitions.push(primitiveDefinition);
    }

    return primitiveDefinitions;
  }

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
   * @param triangle The triangle from which to read data.
   * @param vertexIndex Index of the specific vertex to read.
   * @param collection The collection to dereference based on the index stored in the property on `triangle`.
   * @param prefix Prefix of the property name on `triangle` e.g. `'n' => n0`.
   */
  private dereferenceTriangle<T>(triangle: TriangleObj, vertexIndex: number, collection: T[], prefix: string): T | undefined;
  private dereferenceTriangle<T, TResult>(triangle: TriangleObj, vertexIndex: number, collection: T[], prefix: string, map: (result: T) => TResult): TResult | undefined;
  private dereferenceTriangle<T, TResult = T>(triangle: TriangleObj, vertexIndex: number, collection: T[], prefix: string, map?: (result: T) => TResult): TResult | undefined {
    const index = triangle[`${prefix}${vertexIndex}` as keyof TriangleObj];
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

  private async getCachedMaterial(materialId: number): Promise<MaterialDefinition | undefined> {
    const cachedMaterial = this.materialCache.get(materialId);
    if (cachedMaterial) {
      return await cachedMaterial;
    } else {
      const materialDefinitionPromise = new Promise<MaterialDefinition | undefined>((resolve) => {
        const materialObj = this.parsedObj.materials[materialId];
        if (materialObj !== undefined) {
          void this.parseMaterial(materialObj).then(resolve);
        } else {
          resolve(undefined);
        }
      });
      this.materialCache.set(materialId, materialDefinitionPromise);
      return materialDefinitionPromise;
    }
  }

  private async parseMaterial(materialObj: MaterialObj): Promise<MaterialDefinition> {
    // Binding material definition from `online-3d-viewer` library.
    // @NOTE I wouldn't say that `online-3d-viewer` is great at parsing .mtl
    // so there is quite a lot of workaround logic here.

    const materialDefinition: MaterialDefinition = {
      name: materialObj.name,
      // Assume material is opaque to start with
      alpha: { mode: 'OPAQUE' },
      // Read diffuse color + opacity into Color4
      diffuseColor: new Color4(materialObj.color.r, materialObj.color.g, materialObj.color.b, materialObj.opacity * 0xFF),
    };

    // If material's opacity is < 1 then `transparent` is true
    // This doesn't acknowledge whether the texture has any alpha,
    // or whether there's an alpha map set, etc. It's based purely
    // on opacity (`d` property`).
    // But if it IS specified, we'll use it.
    if (materialObj.transparent) {
      materialDefinition.alpha = { mode: 'BLEND' };
    }

    // Bind diffuse texture
    if (materialObj.diffuseMap) {
      // Read texture from filesystem, since `diffuseMap.buffer` doesn't seem to be set
      // @NOTE @ASSUMPTION textures will always be addressed relative to .obj
      const texturePath = canonicaliseDependencyPath(this.objPath, materialObj.diffuseMap.name);
      const textureFile = await this.filesystem.readFile(texturePath);
      materialDefinition.diffuseTexture = {
        buffer: textureFile.bytes,
        texCoord: 0,
      };

      // Decode and scan texture for transparent pixels as the ultimate check
      // of whether this material is transparent or not
      if (materialDefinition.alpha.mode === 'OPAQUE') {
        const textureData = await Texture.decodeBuffer(textureFile.bytes);
        for (let i = 0; i < textureData.data.length; i += 4) {
          if (textureData.data[i + 3] < 0xFF) {
            console.log(`[DEBUG] [${ObjLoader.name}] (${ObjLoader.loadModel.name}) Material '${materialObj.name}' is transparent because its diffuse texture has at least 1 transparent pixel.`);
            materialDefinition.alpha = { mode: 'BLEND' };
            break;
          }
        }
      }
    }

    // Special "for fun" flag `multiplyDiffuseMap` seems to specify whether (if
    // a diffuse texture is defined) whether it should be blended with the
    // diffuse colour. We HAVE to honour this because the .obj library
    // will default diffuse color black if not specified.
    if (materialObj.diffuseMap && materialObj.multiplyDiffuseMap === false) {
      materialDefinition.diffuseColor = Color4.white().withA(materialObj.opacity * 0xFF);
    }

    return materialDefinition;
  }
}

function canonicaliseDependencyPath(objPath: string, path: string): string {
  if (path.startsWith('/')) {
    // `path` is absolute
    return path;
  } else {
    // `path` is relative, resolve it relative to `objPath`
    return canonicalisePath(`${objPath}/../${path}`);
  }
}

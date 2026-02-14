import type { MeshPrimitiveDefinition, NodeDefinition } from "@polyzone/engine/loaders/definitions/model";
import { Transform } from "@polyzone/engine/util/Transform";
import { Matrix4 } from "@polyzone/engine/util/Matrix4";
import type { DrawQueues, IEngine } from "@polyzone/engine/Engine";
import type { Vector3 } from "@polyzone/engine/util/vector";
import type { Rotation } from "@polyzone/engine/util/Rotation";
import { Material } from "@polyzone/engine/materials";

import { SubMesh } from "./SubMesh";
import type { MeshSkin } from "./MeshSkin";
import { MeshGeometry, type Edge, type EdgeIndices, type Triangle, type TriangleIndices } from "./MeshGeometry";
import type { ModelMaterialOverrides } from "./Model";

export interface MeshNodeArgs {
  name: string;
  materialOverrides: ModelMaterialOverrides;
  meshPrimitiveCache: MeshPrimitiveCache;
  meshPrimitiveDefinitions?: MeshPrimitiveDefinition[];
  meshGeometry?: MeshGeometry;
}

export class MeshPrimitiveCache {
  private engine: IEngine;
  private cache: Map<MeshPrimitiveDefinition, Map<Material | undefined, SubMesh>>;

  public constructor(engine: IEngine) {
    this.engine = engine;
    this.cache = new Map();
  }

  public async init(engine: IEngine, primitive: MeshPrimitiveDefinition): Promise<void> {
    let material: Material = Material.DefaultMaterial;
    if (primitive.material) {
      material = await Material.fromDefinition(engine, primitive.material);
    }

    let materialCache = this.cache.get(primitive);
    if (materialCache === undefined) {
      materialCache = new Map();
      this.cache.set(primitive, materialCache);
    }

    const primitiveInstance = SubMesh.fromDefinition(engine, primitive, material);

    // @NOTE Bind default material to `undefined`
    materialCache.set(undefined, primitiveInstance);
  }

  public getOrCreate(primitive: MeshPrimitiveDefinition, material: Material | undefined): SubMesh {
    let materialCache = this.cache.get(primitive);
    if (materialCache) {
      const instance = materialCache.get(material);
      if (instance) {
        return instance;
      }
    } else {
      materialCache = new Map();
      this.cache.set(primitive, materialCache);
    }

    // If `material` is passed as undefined, we should never reach here, as ever mesh primitive
    // is initialised with the a default entry through `init()`
    if (material === undefined) {
      throw new Error(`Unknown error. Mesh primitive has no instance with default material. Has 'init()' been called?`);
    }

    const newInstance = SubMesh.fromDefinition(this.engine, primitive, material);
    materialCache.set(material, newInstance);

    return newInstance;
  }
}

/*
@TODO rename
  - ModelPart?
  - ModelSubNode?
 */
export class MeshNode {
  public readonly name: string;
  private readonly _transform: Transform<MeshNode>;
  private _skin?: MeshSkin;
  private readonly materialOverrides: ModelMaterialOverrides;
  private readonly meshPrimitiveDefinitions?: MeshPrimitiveDefinition[];
  private readonly meshGeometry?: MeshGeometry;
  private readonly meshPrimitiveCache: MeshPrimitiveCache;

  private readonly _worldMatrixTmp: Matrix4 = new Matrix4();
  private _jointMatricesTmp: Matrix4[] | undefined;
  private _modelViewMatrixTmp: Matrix4 = new Matrix4();

  private constructor({ name, meshPrimitiveCache, meshPrimitiveDefinitions, meshGeometry, materialOverrides }: MeshNodeArgs) {
    this.name = name;
    this.meshPrimitiveCache = meshPrimitiveCache;
    this.materialOverrides = materialOverrides;
    this.meshPrimitiveDefinitions = meshPrimitiveDefinitions;
    this.meshGeometry = meshGeometry;
    this._transform = new Transform<MeshNode>(this);
  }

  public createInstance(materialOverrides: ModelMaterialOverrides): MeshNode {
    const instance = new MeshNode({
      name: this.name,
      meshPrimitiveDefinitions: this.meshPrimitiveDefinitions,
      materialOverrides: materialOverrides,
      meshPrimitiveCache: this.meshPrimitiveCache,
      meshGeometry: this.meshGeometry,
    });

    return instance;
  }

  public draw(
    drawQueues: DrawQueues,
    viewMatrix: Matrix4,
    worldMatrix: Matrix4,
  ): void {
    if (!this.meshPrimitiveDefinitions?.length) return; // @NOTE Don't bother doing math unless we need it

    this._worldMatrixTmp.setValue(worldMatrix).multiplySelf(this.worldMatrix);

    if (this.skin !== undefined) {
      this.skin.skeleton.forEach((bone, i) => {
        this._jointMatricesTmp![i].setValue(bone.worldMatrix).multiplySelf(this.skin!.inverseBindMatrices[i]);
      });
    }

    this._modelViewMatrixTmp
      .setValue(viewMatrix)
      .multiplySelf(this._worldMatrixTmp);

    for (const primitive of this.meshPrimitiveDefinitions) {
      let material: Material | undefined = undefined;
      if (primitive.material) {
        material = this.materialOverrides.getOverride(primitive.material.name);
      }
      const primitiveInstance = this.meshPrimitiveCache.getOrCreate(primitive, material);
      primitiveInstance.draw(drawQueues, this._modelViewMatrixTmp, this._worldMatrixTmp, this._jointMatricesTmp);
    }
  }

  public addChild(child: MeshNode): void {
    this.transform.addChild(child.transform);
  }

  public static async fromDefinition(engine: IEngine, definition: NodeDefinition, materialOverrides: ModelMaterialOverrides): Promise<MeshNode> {
    const meshPrimitiveCache = new MeshPrimitiveCache(engine);
    let meshGeometry: MeshGeometry | undefined = undefined;
    if (definition.mesh) {
      for (const meshPrimitiveDefinition of definition.mesh.primitives) {
        await meshPrimitiveCache.init(engine, meshPrimitiveDefinition);
      }

      meshGeometry = new MeshGeometry(definition.mesh);
    }

    return new MeshNode({
      name: definition.name,
      materialOverrides,
      meshPrimitiveCache,
      meshPrimitiveDefinitions: definition.mesh?.primitives,
      meshGeometry,
    });
  }


  public get transform(): Transform<MeshNode> { return this._transform; }
  public get skin(): MeshSkin | undefined { return this._skin; }
  public set skin(value: MeshSkin | undefined) {
    this._skin = value;
    this._jointMatricesTmp = value?.skeleton.map(() => new Matrix4());
  }
  public get children(): MeshNode[] { return this.transform.children.map((childTransform) => childTransform.node); }

  public get position(): Vector3 { return this.transform.position; }
  public set position(value: Vector3) { this.transform.position = value; }
  public get rotation(): Rotation { return this.transform.rotation; }
  public get scale(): Vector3 { return this.transform.scale; }
  public set scale(value: Vector3) { this.transform.scale = value; }

  public get absolutePosition(): Vector3 { return this.transform.absolutePosition; }
  public set absolutePosition(value: Vector3) { this.transform.absolutePosition = value; }
  public get absoluteRotation(): Rotation { return this.transform.absoluteRotation; }
  public get absoluteScale(): Vector3 { return this.transform.absoluteScale; }
  public set absoluteScale(value: Vector3) { this.transform.absoluteScale = value; }

  public get worldMatrix(): Matrix4 { return this.transform.worldMatrix; }

  // @TODO Cache all this based on transform
  // @TODO At least pre-allocate space for arrays, maybe move into MeshGeometry (give access to worldMatrix or something)
  public get allVertexPositions(): Vector3[] | undefined {
    return this.meshGeometry?.vertexPositions.map((vertexPosition) => vertexPosition.multiply(this.worldMatrix));
  }
  public get allVertexNormals(): Vector3[] | undefined {
    return this.meshGeometry?.vertexNormals.map((vertexNormal) => vertexNormal.multiply(this.absoluteRotation.q));
  }
  public get allTriangles(): Triangle[] | undefined {
    const vertexPositions = this.allVertexPositions;
    if (!vertexPositions) return undefined;

    return this.meshGeometry?.triangleIndices.map((triangle) => {
      return [
        vertexPositions[triangle[0]],
        vertexPositions[triangle[1]],
        vertexPositions[triangle[2]],
      ] as Triangle;
    });
  }
  public get allTriangleIndices(): TriangleIndices[] | undefined {
    return this.meshGeometry?.triangleIndices;
  }
  public get allTriangleNormals(): Vector3[] | undefined {
    return this.meshGeometry?.triangleNormals.map((triangleNormal) => triangleNormal.multiply(this.absoluteRotation.q));
  }
  public get allEdges(): Edge[] | undefined {
    const vertexPositions = this.allVertexPositions;
    if (!vertexPositions) return undefined;

    return this.meshGeometry?.edgeIndices.map((edge) => {
      return [
        vertexPositions[edge[0]],
        vertexPositions[edge[1]],
      ] as Edge;
    });
  }
  public get allEdgeIndices(): EdgeIndices[] | undefined {
    return this.meshGeometry?.edgeIndices;
  }
}

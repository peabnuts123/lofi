import { Matrix4 } from "@lofi/core/math/Matrix4";
import { Vector3 } from "@lofi/core/math/vector";
import { Transform } from "@lofi/core/transform/Transform";
import type { Rotation } from "@lofi/core/transform/Rotation";
import type { MeshPrimitiveDefinition, ModelPartDefinition, TransformDefinition } from "@lofi/engine/loaders/definitions/model";
import type { DrawQueues, IEngine } from "@lofi/engine/Engine";

import type { MeshSkin } from "./MeshSkin";
import { MeshGeometry, type Edge, type EdgeIndices, type Triangle, type TriangleIndices } from "./MeshGeometry";
import type { MaterialOverride, ModelMaterialOverrides } from "./ModelMaterialOverrides";
import { MeshPrimitiveCache } from "./MeshPrimitiveCache";

export interface ModelPartConstructorArgs {
  name: string;
  transform: TransformDefinition;
  materialOverrides: ModelMaterialOverrides;
  meshPrimitiveCache: MeshPrimitiveCache;
  parent?: ModelPart;
  meshPrimitiveDefinitions?: MeshPrimitiveDefinition[] | undefined;
  meshGeometry?: MeshGeometry | undefined;
}

/**
 * A node in the hierarchy of a model. Can represent a mesh (with or without a skin/skeleton)
 * or a non-visual "bone" used only in rendering calculations.
 */
export class ModelPart {
  public readonly name: string;
  private readonly _transform: Transform<ModelPart>;
  private _skin: MeshSkin | undefined;
  private readonly materialOverrides: ModelMaterialOverrides;
  private readonly meshPrimitiveDefinitions: MeshPrimitiveDefinition[] | undefined;
  private readonly meshGeometry: MeshGeometry | undefined;
  private readonly meshPrimitiveCache: MeshPrimitiveCache;

  private readonly _worldMatrixTmp: Matrix4 = new Matrix4();
  private _jointMatricesTmp: Matrix4[] | undefined;
  private _modelViewMatrixTmp: Matrix4 = new Matrix4();

  private constructor({ name, transform, materialOverrides, meshPrimitiveCache, parent, meshPrimitiveDefinitions, meshGeometry }: ModelPartConstructorArgs) {
    this.name = name;
    this.meshPrimitiveCache = meshPrimitiveCache;
    this.materialOverrides = materialOverrides;
    this.meshPrimitiveDefinitions = meshPrimitiveDefinitions;
    this.meshGeometry = meshGeometry;

    this._transform = new Transform<ModelPart>(this, parent?.transform);
    this._transform.position = transform.position;
    this._transform.rotation.q = transform.rotation;
    this._transform.scale = transform.scale;
  }

  public createInstance(materialOverrides: ModelMaterialOverrides, parentInstance: ModelPart | undefined): ModelPart {
    const instance = new ModelPart({
      name: this.name,
      transform: {
        position: this.position,
        rotation: this.rotation.q,
        scale: this.scale,
      },
      parent: parentInstance,
      meshPrimitiveDefinitions: this.meshPrimitiveDefinitions,
      materialOverrides: materialOverrides,
      meshPrimitiveCache: this.meshPrimitiveCache,
      meshGeometry: this.meshGeometry,
    });

    return instance;
  }

  public draw(
    engine: IEngine,
    drawQueues: DrawQueues,
    viewMatrix: Matrix4,
    worldMatrix: Matrix4,
  ): void {
    if (!this.meshPrimitiveDefinitions?.length) return; // @NOTE Don't bother doing math unless we need it

    this._worldMatrixTmp.setValue(worldMatrix).multiplySelf(this.worldMatrix);

    if (this.skin !== undefined) {
      this.skin.skeleton.forEach((bone, i) => {
        this._jointMatricesTmp![i]
          .setValue(this.worldMatrix)
          .invertSelf()
          .multiplySelf(bone.worldMatrix)
          .multiplySelf(this.skin!.inverseBindMatrices[i]);
      });
    }

    this._modelViewMatrixTmp
      .setValue(viewMatrix)
      .multiplySelf(this._worldMatrixTmp);

    for (const primitive of this.meshPrimitiveDefinitions) {
      let materialOverrides: MaterialOverride[] | undefined = undefined;
      if (primitive.material) {
        materialOverrides = this.materialOverrides.getOverrides(primitive.material.name);
      }
      const [primitiveInstance, materialInstance] = this.meshPrimitiveCache.getOrCreate(primitive, materialOverrides);
      primitiveInstance.draw(engine, drawQueues, this._modelViewMatrixTmp, this._worldMatrixTmp, this._jointMatricesTmp, materialInstance);
    }
  }

  public static async fromDefinition(engine: IEngine, definition: ModelPartDefinition, parent: ModelPart | undefined, materialOverrides: ModelMaterialOverrides): Promise<ModelPart> {
    const meshPrimitiveCache = new MeshPrimitiveCache(engine);
    let meshGeometry: MeshGeometry | undefined = undefined;
    if (definition.mesh) {
      for (const meshPrimitiveDefinition of definition.mesh.primitives) {
        await meshPrimitiveCache.init(engine, meshPrimitiveDefinition);
      }

      meshGeometry = new MeshGeometry(definition.mesh);
    }

    return new ModelPart({
      name: definition.name,
      parent,
      transform: definition.transform,
      materialOverrides,
      meshPrimitiveCache,
      meshPrimitiveDefinitions: definition.mesh?.primitives,
      meshGeometry,
    });
  }


  public get transform(): Transform<ModelPart> { return this._transform; }
  public get skin(): MeshSkin | undefined { return this._skin; }
  public set skin(value: MeshSkin | undefined) {
    this._skin = value;
    this._jointMatricesTmp = value?.skeleton.map(() => new Matrix4());
  }
  public get children(): ModelPart[] { return this.transform.children.map((childTransform) => childTransform.node); }

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

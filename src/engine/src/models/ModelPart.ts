import { Matrix4 } from "@lofi/core/math/Matrix4";
import { Vector3 } from "@lofi/core/math/Vector3";
import { Transform } from "@lofi/core/transform/Transform";
import type { Rotation } from "@lofi/core/transform/Rotation";
import { Computed } from "@lofi/core/util/Computed";
import type { ModelPartDefinition, TransformDefinition } from "@lofi/engine/loaders/definitions/model";
import type { DrawTask, IEngine } from "@lofi/engine/Engine";
import { MaterialInstance } from "@lofi/engine/materials";

import { MeshSkin } from "./MeshSkin";
import type { ModelMaterialOverrides } from "./ModelMaterialOverrides";
import { MeshPrimitiveCache } from "./MeshPrimitiveCache";
import { ModelPartGeometry } from "./geometry";

export interface ModelPartConstructorArgs {
  name: string;
  transform: TransformDefinition;
  primitiveCaches: MeshPrimitiveCache[];
  parent?: ModelPart;
  skin: MeshSkin | undefined;
}

/**
 * A node in the hierarchy of a model. Can represent a mesh (with or without a skin/skeleton)
 * or a non-visual "bone" used only in rendering calculations.
 */
export class ModelPart {
  public readonly name: string;
  private readonly _transform: Transform<ModelPart>;
  private readonly _skin: MeshSkin | undefined;
  public readonly primitiveCaches: MeshPrimitiveCache[]; // @TODO Does it need a better name?
  private readonly jointMatricesComputed: Computed<Matrix4[]> | undefined;
  public readonly geometry: ModelPartGeometry;


  private constructor({ name, transform, primitiveCaches, parent, skin }: ModelPartConstructorArgs) {
    this.name = name;
    this.primitiveCaches = primitiveCaches;
    this._transform = new Transform<ModelPart>(this, parent?.transform);
    this._transform.position = transform.position;
    this._transform.rotation.q = transform.rotation;
    this._transform.scale = transform.scale;
    this._skin = skin;

    if (this.skin) {
      this.jointMatricesComputed = new Computed<Matrix4[]>(this.skin.skeleton.map(() => new Matrix4()), {
        dependencies: [
          ...this.skin.skeleton.map((bone) => bone.localMatrixComputed),
        ],
        recompute: (self) => {
          const skin = this.skin!;
          for (let i = 0; i < skin.skeleton.length; i++) {
            self[i]
              .setValue(skin.skeleton[i].localMatrix)
              .multiplySelf(skin.inverseBindMatrices[i]);
          }
        },
      });
    }

    this.geometry = new ModelPartGeometry({
      primitiveCaches,
      localMatrixComputed: this.localMatrixComputed,
      skinJointMatricesComputed: this.jointMatricesComputed,
    });
  }

  public createInstance(parentInstance: ModelPart | undefined, skin: MeshSkin | undefined): ModelPart {
    const instance = new ModelPart({
      name: this.name,
      transform: {
        position: this.position,
        rotation: this.rotation.q,
        scale: this.scale,
      },
      parent: parentInstance,
      primitiveCaches: this.primitiveCaches,
      skin,
    });

    return instance;
  }

  private tmp_draw_worldMatrix = Matrix4.identity();
  private tmp_draw_jointMatricesBytes: Float32Array | undefined;
  private tmp_draw_modelViewMatrix: Matrix4 = new Matrix4();
  public draw(
    engine: IEngine,
    drawQueue: DrawTask[],
    viewMatrix: Matrix4,
    worldMatrix: Matrix4,
    materialOverrides: ModelMaterialOverrides,
    renderLayer: number,
  ): void {
    // Don't bother doing math unless we need to draw something
    if (this.primitiveCaches.length === 0) return;

    // World matrix (may / may not be premultiplied)
    this.tmp_draw_worldMatrix
      .setValue(worldMatrix);

    if (this.skin !== undefined) {
      // Model has skin
      // Initialise / resize joint matrix buffer
      const JointMatricesTotalBytes = engine.config.models.maxBones * 16;
      if (this.tmp_draw_jointMatricesBytes === undefined || this.tmp_draw_jointMatricesBytes.length !== JointMatricesTotalBytes) {
        this.tmp_draw_jointMatricesBytes = new Float32Array(JointMatricesTotalBytes);
      }

      // Write joint matrices to matrix buffer
      const jointMatrices = this.jointMatricesComputed!.value;
      for (let i = 0; i < jointMatrices.length; i++) {
        jointMatrices[i].writeTo(this.tmp_draw_jointMatricesBytes, i * 16);
      }
    } else {
      // Model has no skin
      // @NOTE Premultiply world matrix by local matrix as it is needed
      // by both vertex position AND vertex normal
      this.tmp_draw_worldMatrix
        .multiplySelf(this.localMatrix);
    }

    const drawTaskUniforms: DrawTask['uniforms'] = {
      worldMatrix: this.tmp_draw_worldMatrix,
      skinWeights: this.tmp_draw_jointMatricesBytes,
    };

    this.tmp_draw_modelViewMatrix
      .setValue(viewMatrix)
      .multiplySelf(this.tmp_draw_worldMatrix);

    for (const primitiveCache of this.primitiveCaches) {
      let material = MaterialInstance.DefaultMaterial;
      if (primitiveCache.geometry.defaultMaterialDefinition) {
        material = materialOverrides.getResult(primitiveCache.geometry.defaultMaterialDefinition.name);
      }
      const primitiveInstance = primitiveCache.getOrCreate(material);
      primitiveInstance.draw(
        drawQueue,
        renderLayer,
        this.tmp_draw_modelViewMatrix,
        material,
        drawTaskUniforms,
      );
    }
  }

  public static fromDefinition(engine: IEngine, definition: ModelPartDefinition, parent: ModelPart | undefined, skin: MeshSkin | undefined): ModelPart {
    const primitiveDefinitions = definition.mesh?.primitives ?? [];
    const meshPrimitives = primitiveDefinitions.map((definition) => new MeshPrimitiveCache(engine, definition));

    return new ModelPart({
      name: definition.name,
      parent,
      transform: definition.transform,
      primitiveCaches: meshPrimitives,
      skin,
    });
  }


  public get transform(): Transform<ModelPart> { return this._transform; }
  public get skin(): MeshSkin | undefined { return this._skin; }
  public get parent(): ModelPart | undefined { return this.transform.parent?.node; }
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

  public get localMatrix(): Matrix4 { return this.transform.worldMatrix; }
  public get localMatrixComputed(): Computed<Matrix4> { return this.transform.worldMatrixComputed; }
}

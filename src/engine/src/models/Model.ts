import { Vector3 } from "@lofi/core/math/vector";
import type { Matrix4 } from "@lofi/core/math/Matrix4";
import type { DrawQueues, IEngine } from "@lofi/engine/Engine";
import type { ModelDefinition, ModelPartDefinition } from "@lofi/engine/loaders/definitions";
import { Animation } from "@lofi/engine/animation";
import type { Material } from "@lofi/engine/materials";

import type { Edge, EdgeIndices, Triangle, TriangleIndices } from "./MeshGeometry";
import { ModelPart } from "./ModelPart";
import { MeshSkin } from "./MeshSkin";
import { ModelMaterialOverrides, type MaterialOverrideType } from "./ModelMaterialOverrides";

/**
 * A 3D model, comprised of a hierarchy of `ModelPart`s, which are comprised
 * of a collection of `MeshPrimitive`s (or not in the case of a bone).
 * ```
 * Model => (0..*) ModelPart => (0..*) MeshPrimitive
 * ```
 */
export class Model {
  private isInstance: boolean;
  private readonly rootParts: ModelPart[];
  public readonly allParts: ModelPart[];
  public readonly animations: Animation[];

  private readonly materialOverrides: ModelMaterialOverrides;

  private constructor(rootParts: ModelPart[], allParts: ModelPart[], animations: Animation[], materialOverrides: ModelMaterialOverrides) {
    this.isInstance = false;
    this.rootParts = rootParts;
    this.allParts = allParts;
    this.animations = animations;
    this.materialOverrides = materialOverrides;
  }

  public createInstance(): Model {
    const newRootParts: ModelPart[] = [];
    const newParts: ModelPart[] = [];

    const tidyUpTasks: (() => void)[] = [];
    const oldToNewLookup = new Map<ModelPart, ModelPart>();

    const materialOverrides = this.materialOverrides.createInstance();

    function createModelPartInstance(modelPart: ModelPart, parentInstance?: ModelPart): ModelPart {
      const instance = modelPart.createInstance(materialOverrides, parentInstance);

      newParts.push(instance);
      oldToNewLookup.set(modelPart, instance);

      for (const childModelPart of modelPart.children) {
        createModelPartInstance(childModelPart, instance);
      }

      if (modelPart.skin) {
        // Map old skeleton parts to new instances, but we first need to wait
        // until we've created instances of all the model parts before we
        // can look them up.
        tidyUpTasks.push(() => {
          instance.skin = new MeshSkin(
            modelPart.skin!.skeleton.map((prototypePart) => {
              const instance = oldToNewLookup.get(prototypePart);
              if (!instance) {
                // @NOTE Hopefully, this should not be possible
                throw new Error(`Error creating model instance. Model part skin references part that could not be found in list of new model part instances`);
              }
              return instance;
            }),
            modelPart.skin!.inverseBindMatrices,
          );
        });
      }

      return instance;
    }

    for (const rootPart of this.rootParts) {
      const instance = createModelPartInstance(rootPart);
      newRootParts.push(instance);
    }

    tidyUpTasks.forEach((task) => task());

    const instance = new Model(
      newRootParts,
      newParts,
      this.animations,
      materialOverrides,
    );
    instance.isInstance = true;
    return instance;
  }

  public setMaterialOverride(materialName: string, material: Material, type: MaterialOverrideType = 'override'): void {
    this.materialOverrides.setOverride(materialName, material, type, this.isInstance);
  }

  public removeMaterialOverride(materialName: string): void {
    this.materialOverrides.removeOverride(materialName, this.isInstance);
  }

  public draw(engine: IEngine, drawQueues: DrawQueues, viewMatrix: Matrix4, worldMatrix: Matrix4): void {
    for (const modelPart of this.allParts) {
      modelPart.draw(
        engine,
        drawQueues,
        viewMatrix,
        worldMatrix,
      );
    }
  }

  public static async fromDefinition(engine: IEngine, definition: ModelDefinition): Promise<Model> {
    const tidyUpTasks: (() => void)[] = [];
    const modelPartLookup = new Map<ModelPartDefinition, ModelPart>();
    const rootParts: ModelPart[] = [];
    const allParts: ModelPart[] = [];
    const materialOverrides = ModelMaterialOverrides.createNew();

    for (const rootPart of definition.rootParts) {
      const modelPart = await createModelPart(rootPart);
      rootParts.push(modelPart);
    }

    async function createModelPart(partDefinition: ModelPartDefinition, parent?: ModelPart): Promise<ModelPart> {
      const modelPart = await ModelPart.fromDefinition(engine, partDefinition, parent, materialOverrides);

      modelPartLookup.set(partDefinition, modelPart);
      allParts.push(modelPart);

      // Build skin
      if (partDefinition.skin) {
        tidyUpTasks.push(() => {
          const skeleton = partDefinition.skin!.jointParts.map((jointPart) => modelPartLookup.get(jointPart)!);
          modelPart.skin = new MeshSkin(skeleton, partDefinition.skin!.inverseBindMatrices);
        });
      }

      // Instantiate children
      for (const childDefinition of partDefinition.children) {
        await createModelPart(childDefinition, modelPart);
      }

      return modelPart;
    }

    // Animations
    const animations: Animation[] = [];
    for (const animationDefinition of definition.animations) {
      const animation = new Animation(animationDefinition);
      animations.push(animation);
    }

    tidyUpTasks.forEach((task) => task());

    return new Model(rootParts, allParts, animations, materialOverrides);
  }

  // @TODO cache these somehow
  public get allVertexPositions(): Vector3[] { return this.allParts.flatMap((part) => part.allVertexPositions ?? []); }
  public get allVertexNormals(): Vector3[] { return this.allParts.flatMap((part) => part.allVertexNormals ?? []); }
  public get allTriangles(): Triangle[] { return this.allParts.flatMap((part) => part.allTriangles ?? []); }
  public get allTriangleIndices(): TriangleIndices[] {
    let totalVertices = 0;
    return this.allParts.flatMap((part) => {
      const result = part.allTriangleIndices?.map((triangleIndices) => [
        triangleIndices[0] + totalVertices,
        triangleIndices[1] + totalVertices,
        triangleIndices[2] + totalVertices,
      ] satisfies TriangleIndices);

      totalVertices += part.allVertexPositions?.length ?? 0;

      return result ?? [];
    });
  };
  public get allTriangleNormals(): Vector3[] { return this.allParts.flatMap((part) => part.allTriangleNormals ?? []); }
  public get allEdges(): Edge[] { return this.allParts.flatMap((part) => part.allEdges ?? []); }
  public get allEdgeIndices(): EdgeIndices[] {
    let totalVertices = 0;
    return this.allParts.flatMap((part) => {
      const result = part.allEdgeIndices?.map((edgeIndices) => [
        edgeIndices[0] + totalVertices,
        edgeIndices[1] + totalVertices,
      ] satisfies EdgeIndices);

      totalVertices += part.allVertexPositions?.length ?? 0;

      return result ?? [];
    });
  };
}

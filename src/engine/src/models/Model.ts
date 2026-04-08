import { Vector3 } from "@lofi/core/math/vector";
import type { Matrix4 } from "@lofi/core/math/Matrix4";
import type { DrawQueues, IEngine } from "@lofi/engine/Engine";
import type { ModelDefinition, NodeDefinition } from "@lofi/engine/loaders/definitions";
import { Animation } from "@lofi/engine/animation";
import type { Material } from "@lofi/engine/materials";

import type { Edge, EdgeIndices, Triangle, TriangleIndices } from "./MeshGeometry";
import { MeshNode } from "./MeshNode";
import { MeshSkin } from "./MeshSkin";

export class Model {
  private isInstance: boolean;
  private readonly rootNodes: MeshNode[];
  public readonly allNodes: MeshNode[];
  public readonly animations: Animation[];

  private readonly materialOverrides: ModelMaterialOverrides;

  private constructor(rootNodes: MeshNode[], allNodes: MeshNode[], animations: Animation[], materialOverrides: ModelMaterialOverrides) {
    this.isInstance = false;
    this.rootNodes = rootNodes;
    this.allNodes = allNodes;
    this.animations = animations;
    this.materialOverrides = materialOverrides;
  }

  public createInstance(): Model {
    const newRootNodes: MeshNode[] = [];
    const newNodes: MeshNode[] = [];

    const tidyUpTasks: (() => void)[] = [];
    const oldToNewLookup = new Map<MeshNode, MeshNode>();

    const materialOverrides = this.materialOverrides.createInstance();

    function createModelPartInstance(modelPart: MeshNode): MeshNode {
      const instance = modelPart.createInstance(materialOverrides);

      newNodes.push(instance);
      oldToNewLookup.set(modelPart, instance);

      for (const childModelPart of modelPart.children) {
        const childInstance = createModelPartInstance(childModelPart);
        instance.addChild(childInstance);
        childInstance.position = childModelPart.position;
        childInstance.rotation.q.setValue(childModelPart.rotation.q);
        childInstance.scale = childModelPart.scale;
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
                throw new Error(`Error creating model instance. Model part skin references node that could not be found in list of new model part instances`);
              }
              return instance;
            }),
            modelPart.skin!.inverseBindMatrices,
          );
        });
      }

      return instance;
    }

    for (const rootNode of this.rootNodes) {
      const instance = createModelPartInstance(rootNode);
      newRootNodes.push(instance);
      instance.position = rootNode.transform.position;
      instance.rotation.q.setValue(rootNode.transform.rotation.q);
      instance.scale = rootNode.transform.scale;
    }

    tidyUpTasks.forEach((task) => task());

    const instance = new Model(
      newRootNodes,
      newNodes,
      this.animations,
      materialOverrides,
    );
    instance.isInstance = true;
    return instance;
  }

  public setMaterialOverride(materialName: string, material: Material | undefined): void {
    if (material !== undefined) {
      this.materialOverrides.setOverride(materialName, material, this.isInstance);
    } else {
      this.materialOverrides.removeOverride(materialName, this.isInstance);
    }
  }

  public draw(engine: IEngine, drawQueues: DrawQueues, viewMatrix: Matrix4, worldMatrix: Matrix4): void {
    for (const modelPart of this.allNodes) {
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
    const modelPartLookup = new Map<NodeDefinition, MeshNode>();
    const rootNodes: MeshNode[] = [];
    const allNodes: MeshNode[] = [];
    const materialOverrides = new ModelMaterialOverrides();

    for (const rootNode of definition.rootNodes) {
      const modelPart = await createModelPart(rootNode);
      modelPart.position = rootNode.transform.position;
      modelPart.rotation.set(rootNode.transform.rotation);
      modelPart.scale = rootNode.transform.scale;
      rootNodes.push(modelPart);
    }

    async function createModelPart(nodeDefinition: NodeDefinition): Promise<MeshNode> {
      const modelPart = await MeshNode.fromDefinition(engine, nodeDefinition, materialOverrides);

      modelPartLookup.set(nodeDefinition, modelPart);
      allNodes.push(modelPart);

      // Build skin
      if (nodeDefinition.skin) {
        tidyUpTasks.push(() => {
          const skeleton = nodeDefinition.skin!.jointNodes.map((jointNode) => modelPartLookup.get(jointNode)!);
          modelPart.skin = new MeshSkin(skeleton, nodeDefinition.skin!.inverseBindMatrices);
        });
      }

      // Instantiate children
      for (const childDefinition of nodeDefinition.children) {
        const child = await createModelPart(childDefinition);
        modelPart.addChild(child);
        // @NOTE We have to have established the hierarchy first, otherwise
        // position/rotation/scale will be wrong, since it is updated when you
        // call `addChild()`
        child.position = childDefinition.transform.position;
        child.rotation.set(childDefinition.transform.rotation);
        child.scale = childDefinition.transform.scale;
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

    return new Model(rootNodes, allNodes, animations, materialOverrides);
  }

  // @TODO cache these somehow
  public get allVertexPositions(): Vector3[] { return this.allNodes.flatMap((node) => node.allVertexPositions ?? []); }
  public get allVertexNormals(): Vector3[] { return this.allNodes.flatMap((node) => node.allVertexNormals ?? []); }
  public get allTriangles(): Triangle[] { return this.allNodes.flatMap((node) => node.allTriangles ?? []); }
  public get allTriangleIndices(): TriangleIndices[] {
    let totalVertices = 0;
    return this.allNodes.flatMap((node) => {
      const result = node.allTriangleIndices?.map((triangleIndices) => [
        triangleIndices[0] + totalVertices,
        triangleIndices[1] + totalVertices,
        triangleIndices[2] + totalVertices,
      ] satisfies TriangleIndices);

      totalVertices += node.allVertexPositions?.length ?? 0;

      return result ?? [];
    });
  };
  public get allTriangleNormals(): Vector3[] { return this.allNodes.flatMap((node) => node.allTriangleNormals ?? []); }
  public get allEdges(): Edge[] { return this.allNodes.flatMap((node) => node.allEdges ?? []); }
  public get allEdgeIndices(): EdgeIndices[] {
    let totalVertices = 0;
    return this.allNodes.flatMap((node) => {
      const result = node.allEdgeIndices?.map((edgeIndices) => [
        edgeIndices[0] + totalVertices,
        edgeIndices[1] + totalVertices,
      ] satisfies EdgeIndices);

      totalVertices += node.allVertexPositions?.length ?? 0;

      return result ?? [];
    });
  };
}

export class ModelMaterialOverrides {
  private sharedOverrides: Map<string, Material>;
  private instanceOverrides: Map<string, Material>;

  public constructor() {
    this.sharedOverrides = new Map();
    this.instanceOverrides = new Map();
  }

  public createInstance(): ModelMaterialOverrides {
    const instance = new ModelMaterialOverrides();
    instance.sharedOverrides = this.sharedOverrides;
    return instance;
  }

  public getOverride(materialName: string): Material | undefined {
    const instanceOverride = this.instanceOverrides.get(materialName);
    const sharedOverride = this.sharedOverrides.get(materialName);
    return instanceOverride ?? sharedOverride;
  }

  public setOverride(materialName: string, material: Material, isInstance: boolean): void {
    if (isInstance) {
      this.instanceOverrides.set(materialName, material);
    } else {
      this.sharedOverrides.set(materialName, material);
    }
  }

  public removeOverride(materialName: string, isInstance: boolean): void {
    if (isInstance) {
      this.instanceOverrides.delete(materialName);
    } else {
      this.sharedOverrides.delete(materialName);
    }
  }
}

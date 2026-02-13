import type { DrawQueues, IEngine } from "@polyzone/engine/Engine";
import { Vector3 } from "@polyzone/engine/util/vector";
import type { Matrix4 } from "@polyzone/engine/util/Matrix4";
import type { ModelDefinition, NodeDefinition } from "@polyzone/engine/loaders/definitions";
import { Animation } from "@polyzone/engine/animation";

import type { Edge, EdgeIndices, Triangle, TriangleIndices } from "./MeshGeometry";
import { MeshNode } from "./MeshNode";
import { MeshSkin } from "./MeshSkin";

export class Model {
  private readonly rootNodes: MeshNode[];
  public readonly allNodes: MeshNode[];
  public readonly animations: Animation[];

  private constructor(rootNodes: MeshNode[], allNodes: MeshNode[], animations: Animation[]) {
    this.rootNodes = rootNodes;
    this.allNodes = allNodes;
    this.animations = animations;
  }

  public createInstance(): Model {
    const newRootNodes: MeshNode[] = [];
    const newNodes: MeshNode[] = [];

    const tidyUpTasks: (() => void)[] = [];
    const oldToNewLookup = new Map<MeshNode, MeshNode>();

    function createModelPartInstance(modelPart: MeshNode): MeshNode {
      const instance = modelPart.createInstance();

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

    return new Model(
      newRootNodes,
      newNodes,
      this.animations,
    );
  }

  public draw(drawQueues: DrawQueues, viewMatrix: Matrix4, worldMatrix: Matrix4): void {
    for (const modelPart of this.allNodes) {
      modelPart.draw(
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

    for (const rootNode of definition.rootNodes) {
      const modelPart = await createModelPart(rootNode);
      modelPart.position = rootNode.transform.position;
      modelPart.rotation.set(rootNode.transform.rotation);
      modelPart.scale = rootNode.transform.scale;
      rootNodes.push(modelPart);
    }

    async function createModelPart(nodeDefinition: NodeDefinition): Promise<MeshNode> {
      const modelPart = await MeshNode.fromDefinition(engine, nodeDefinition);

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

    return new Model(rootNodes, allNodes, animations);
  }

  // @TODO cache these somehow
  public get allVertexPositions(): Vector3[] { return this.allNodes.flatMap((node) => node.allVertexPositions ?? []); }
  public get allVertexNormals(): Vector3[] { return this.allNodes.flatMap((node) => node.allVertexNormals ?? []); }
  public get allTriangles(): Triangle[] { return this.allNodes.flatMap((node) => node.allTriangles ?? []); }
  public get allTriangleIndices(): TriangleIndices[] { return this.allNodes.flatMap((node) => node.allTriangleIndices ?? []); }
  public get allTriangleNormals(): Vector3[] { return this.allNodes.flatMap((node) => node.allTriangleNormals ?? []); }
  public get allEdges(): Edge[] { return this.allNodes.flatMap((node) => node.allEdges ?? []); }
  public get allEdgeIndices(): EdgeIndices[] { return this.allNodes.flatMap((node) => node.allEdgeIndices ?? []); }
}

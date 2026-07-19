import  { Scene } from "@lopoly/engine/scene";

import { MockEngine, type MockEngineConstructorArgs } from "@test/mock/MockEngine";
import { MockSceneNode } from "@test/mock/MockSceneNode";


export interface CreateMockSceneResult {
  engine: MockEngine,
  scene: Scene,
}

export interface CreateMockSceneNodeResult extends CreateMockSceneResult {
  sceneNode: MockSceneNode,
}

export function createMockScene(mockEngineArgs?: MockEngineConstructorArgs): CreateMockSceneResult {
  const engine = new MockEngine(mockEngineArgs);
  const scene = new Scene(engine);
  return {
    engine,
    scene,
  };
}

export function createMockSceneNode(name: string = "mock_object", mockEngineArgs?: MockEngineConstructorArgs): CreateMockSceneNodeResult {
  const { engine, scene } = createMockScene(mockEngineArgs);
  const sceneNode = new MockSceneNode(scene, name);
  return {
    engine,
    scene,
    sceneNode,
  };
}

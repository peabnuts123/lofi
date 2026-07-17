import { CollisionSystem } from "@lofi/engine/collision";
import type { EngineConfig, IEngine, OnUpdateFn } from "@lofi/engine/Engine";
import type { IFileSystem } from "@lofi/engine/filesystem";
import type { IScene } from "@lofi/engine/scene";
import { type IAudioSystem } from "@lofi/engine/audio/AudioSystem";
import { type IInputSystem } from "@lofi/engine/input";
import { type IDebugDraw } from "@lofi/engine/util/DebugDraw";
import { MockFileSystem } from "./MockFileSystem";
import { MockAudioSystem } from './MockAudioSystem';
import { MockInputSystem } from "./MockInputSystem";
import { createMockWebGLContext } from "./MockWebGLContext";
import { MockDebugDraw } from "./MockDebugDraw";

export interface MockEngineConstructorArgs {
  fileSystem?: IFileSystem;
}

export class MockEngine implements IEngine {
  config: EngineConfig;
  readonly gl: WebGL2RenderingContext;
  fileSystem: IFileSystem;
  collisionSystem: CollisionSystem;
  audioSystem: IAudioSystem;
  inputSystem: IInputSystem;
  debugDraw: IDebugDraw;
  activeScene: IScene | undefined;

  public constructor({ fileSystem }: MockEngineConstructorArgs = {}) {
    this.gl = createMockWebGLContext();
    this.fileSystem = fileSystem ?? new MockFileSystem();
    this.collisionSystem = new CollisionSystem();
    this.config = {
      audio: {
        numChannels: 2,
      },
      lighting: {
        maxPointLights: 2,
        defaultPointLightRange: 10,
        maxDirectionalLights: 1,
      },
      models: {
        maxBones: 64,
      },
    };
    this.audioSystem = new MockAudioSystem();
    this.inputSystem = new MockInputSystem();
    this.debugDraw = new MockDebugDraw();
  }

  public loadScene(scene: IScene): void {
    this.activeScene = scene;
  }

  public run(_onUpdate: OnUpdateFn): void {
    throw new Error(`run() is not mocked in MockEngine`);
  }
}

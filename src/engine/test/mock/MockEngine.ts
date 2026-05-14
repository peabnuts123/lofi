import { CollisionSystem } from "@lofi/engine/collision";
import type { EngineConfig, IEngine, OnUpdateFn } from "@lofi/engine/Engine";
import type { IFileSystem } from "@lofi/engine/filesystem";
import type { IScene } from "@lofi/engine/scene";
import { type IAudioSystem } from "@lofi/engine/audio/AudioSystem";
import { type IInputSystem } from "@lofi/engine/input";
import { MockFileSystem } from "./MockFileSystem";
import { MockAudioSystem } from './MockAudioSystem';
import { MockInputSystem } from "./MockInputSystem";

export interface MockEngineConstructorArgs {
  fileSystem?: IFileSystem;
}

export class MockEngine implements IEngine {
  fileSystem: IFileSystem;
  collisionSystem: CollisionSystem;
  audioSystem: IAudioSystem;
  inputSystem: IInputSystem;
  activeScene: IScene | undefined;
  config: EngineConfig;

  public constructor({ fileSystem }: MockEngineConstructorArgs = {}) {
    this.fileSystem = fileSystem ?? new MockFileSystem();
    this.collisionSystem = new CollisionSystem();
    this.config = {
      audio: {
        numChannels: 2,
      },
      lighting: {
        maxPointLights: 2,
        maxDirectionalLights: 1,
      },
      models: {
        maxBones: 64,
      },
    };
    this.audioSystem = new MockAudioSystem();
    this.inputSystem = new MockInputSystem();
  }

  public loadScene(scene: IScene): void {
    this.activeScene = scene;
  }

  public run(_onUpdate: OnUpdateFn): void {
    throw new Error(`run() is not mocked in MockEngine`);
  }

  public get gl(): WebGL2RenderingContext {
    throw new Error(`GL context not implemented in MockEngine`);
  }
}

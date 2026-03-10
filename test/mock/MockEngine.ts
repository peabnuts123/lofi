import { CollisionSystem } from "@polyzone/engine/collision";
import type { EngineConfig, IEngine } from "@polyzone/engine/Engine";
import type { IFileSystem } from "@polyzone/engine/filesystem";
import type { IScene } from "@polyzone/engine/scene";
import { type IAudioSystem } from "@polyzone/engine/audio/AudioSystem";
import { MockFileSystem } from "./MockFileSystem";
import { MockAudioSystem } from './MockAudioSystem';

export interface MockEngineConstructorArgs {
  fileSystem?: IFileSystem;
}

export class MockEngine implements IEngine {
  fileSystem: IFileSystem;
  collisionSystem: CollisionSystem;
  audioSystem: IAudioSystem;
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
        maxLights: 2,
      },
      models: {
        maxBones: 64,
      },
    };
    this.audioSystem = new MockAudioSystem();
  }

  public loadScene(scene: IScene): void {
    this.activeScene = scene;
  }

  public run(_onUpdate: (dt: number, stop: () => void) => void): void {
    throw new Error(`run() is not mocked in MockEngine`);
  }

  public get gl(): WebGL2RenderingContext {
    throw new Error(`GL context not implemented in MockEngine`);
  }
}

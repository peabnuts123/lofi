import { CollisionSystem } from "@polyzone/engine/collision";
import type { IEngine } from "@polyzone/engine/Engine";
import type { IFileSystem } from "@polyzone/engine/filesystem";
import type { IScene } from "@polyzone/engine/scene";
import { AudioSystem } from "@polyzone/engine/audio/AudioSystem";
import { MockFileSystem } from "./MockFileSystem";

export interface MockEngineConstructorArgs {
  fileSystem?: IFileSystem;
}

export class MockEngine implements IEngine {
  fileSystem: IFileSystem;
  collisionSystem: CollisionSystem;
  audioSystem: AudioSystem;
  activeScene: IScene | undefined;

  public constructor({ fileSystem }: MockEngineConstructorArgs = {}) {
    this.fileSystem = fileSystem ?? new MockFileSystem();
    this.collisionSystem = new CollisionSystem();
    this.audioSystem = new AudioSystem({ channels: 4 });
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

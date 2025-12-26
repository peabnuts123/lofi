import { CameraUboIndex, CameraUboName, CameraUboPropertyNames, type CameraUbo } from "./scene/nodes/CameraNode";
import type { IFileSystem } from "./filesystem";
import { LightingUboIndex, LightingUboName, LightingUboPropertyNames, type LightingUbo } from "./scene/SceneLighting";
import { Ubo } from "./materials";
import type { Scene } from "./scene";

export class Engine {
  private readonly canvas: HTMLCanvasElement;
  public readonly gl: WebGL2RenderingContext;
  public readonly fileSystem: IFileSystem;

  private _activeScene: Scene | undefined;
  private cameraUbo: CameraUbo;
  private lightingUbo: LightingUbo;

  public constructor(canvas: HTMLCanvasElement, fileSystem: IFileSystem) {
    this.canvas = canvas;
    this.fileSystem = fileSystem;
    const gl = this.canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (gl === null) {
      throw new Error(`WebGL2 not supported`);
    }

    this.gl = gl;

    // Global UBOs
    this.cameraUbo = new Ubo(this, CameraUboName, CameraUboIndex, CameraUboPropertyNames);
    this.lightingUbo = new Ubo(this, LightingUboName, LightingUboIndex, LightingUboPropertyNames);
  }

  public loadScene(scene: Scene): void {
    // @TODO a lot more than just this
    this.activeScene = scene;
  }

  public run(onUpdate: (dt: number) => void): void {
    let lastFrameTime = performance.now();

    const tick = (): void => {
      const thisFrameTime = performance.now();
      const dt = (thisFrameTime - lastFrameTime) / 1000;
      lastFrameTime = thisFrameTime;

      const gl = this.gl;

      gl.clearColor(0.05, 0.05, 0.2, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      // gl.cullFace(gl.BACK);
      // gl.frontFace(gl.CCW);
      // gl.viewport(0, 0, this.canvas.width, this.canvas.height);

      /* Update internal state first */
      this.activeScene?.onUpdate(dt);

      /* Update external (user-controlled) state second */
      onUpdate(dt);

      /* Update global UBOs */
      if (this.activeScene) {
        /* Camera UBO */
        if (this.activeScene.activeCamera) {
          this.activeScene.activeCamera.bindToUbo(this.gl, this.cameraUbo);
        }

        /* Lighting UBO */
        this.activeScene.lighting.bindToUbo(this.gl, this.lightingUbo);
      }

      /* Draw scene */
      this.activeScene?.draw();

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  public get activeScene(): Scene | undefined {
    return this._activeScene;
  }
  private set activeScene(value: Scene) {
    this._activeScene = value;
  }
}

import { CameraUboIndex, CameraUboName, CameraUboPropertyNames, type CameraUbo } from "./scene/nodes/CameraNode";
import type { IFileSystem } from "./filesystem";
import { LightingUboIndex, LightingUboName, LightingUboPropertyNames, type LightingUbo } from "./scene/SceneLighting";
import { Ubo } from "./materials";
import type { Scene } from "./scene";
import { rateCounter } from "./util/debug";

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
    const gl = this.canvas.getContext('webgl2', {
      antialias: false, // Disable anti-aliasing
      preserveDrawingBuffer: true, // Allow capturing canvas buffer
      alpha: false, // Do not blend with HTML background
     });
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

  public run(onUpdate: (dt: number, stop: () => void) => void): void {
    let lastFrameTime = performance.now();
    let isStopped = false;

    const debug_runStart = performance.now();
    const debug_frameTimes: number[] = [];

    // Count number of frames drawn per second
    const fps = rateCounter('FPS');
    const tick = (): void => {
      fps.count();
      const startFrameTime = performance.now();
      const dt = (startFrameTime - lastFrameTime) / 1000;
      lastFrameTime = startFrameTime;

      const gl = this.gl;

      gl.clearColor(0.05, 0.05, 0.2, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      // gl.cullFace(gl.BACK);
      // gl.frontFace(gl.CCW);
      // gl.viewport(0, 0, this.canvas.width, this.canvas.height);

      const debug_startFrame = performance.now();

      /* Update internal state first */
      this.activeScene?.onUpdate(dt);

      /* Update external (user-controlled) state second */
      onUpdate(dt, () => isStopped = true);

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

      const debug_endFrame = performance.now();
      const debug_frameTime = debug_endFrame - debug_startFrame;
      debug_frameTimes.push(debug_frameTime);

      if (!isStopped) {
        requestAnimationFrame(tick);
      } else {
        const debug_runStop = performance.now();
        const averageFrameTime = debug_frameTimes.reduce((sum, frameTime) => {
          sum += frameTime;
          return sum;
        }, 0) / debug_frameTimes.length;
        console.log(`[Engine] Stopped.`);
        console.log(`[DEBUG] Average frame time over ${(debug_runStop - debug_runStart).toFixed(0)}ms: ${averageFrameTime.toFixed(3)})`);
      }
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

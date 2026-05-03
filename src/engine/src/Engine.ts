import { CannotInvertMatrixError, Matrix3 } from "@lofi/core/math/Matrix3";
import type { DeepPartial } from "@lofi/core/util/types";

import { CameraUboIndex, CameraUboName, CameraUboPropertyNames, type CameraUbo } from "./scene/nodes/CameraNode";
import type { IFileSystem } from "./filesystem";
import { LightingUboIndex, LightingUboName, LightingUboPropertyNames, type LightingUbo } from "./scene/SceneLighting";
import { MaterialInstance, ShaderVariant, Ubo } from "./materials";
import type { DrawTask, IScene, TransparentDrawTask } from "./scene";
import { rateCounter } from "./util/debug";
import { CollisionSystem } from "./collision";
import { AudioSystem, type IAudioSystem } from "./audio/AudioSystem";

import { DebugModule } from "./util/DebugModule";
import { InputSystem, type IInputSystem } from "./input";

/*
  @TODO Not sure when I'll be back to think about Gizmo / layering poc.
  - Thought deeply, pretty confident we can just collapse the draw queue into one queue.
  - Transparent tasks will have a flag / a different interface and the draw queue will be a union of the different draw tasks
  - Then we can just do a "mega-sort" on the queue such that things are first sorted by render layer and then by whether they are transparent (with transparent being rendered second), and then different logic for sorting therein (based on whether task is opaque or transparent).
  - So i.e. megasort would sort draw queue like this:
    ```
      // RENDER LAYER 0
      // - OPAQUE TASKS (sorted by texture, model, material, etc.)
      { renderLayer: 0, isTransparent: false, (unique vao, texture, etc.) }
      { renderLayer: 0, isTransparent: false, (unique vao, texture, etc.) }
      { renderLayer: 0, isTransparent: false, (unique vao, texture, etc.) }
      // - TRANSPARENT TASKS (sorted by depth)
      // - OPAQUE TASKS (sorted by texture, model, material, etc.)
      { renderLayer: 0, isTransparent: true, (depth) }
      { renderLayer: 0, isTransparent: true, (depth) }
      { renderLayer: 0, isTransparent: true, (depth) }
      // RENDER LAYER 1
      // - OPAQUE TASKS (sorted by texture, model, material, etc.)
      { … }
      { … }
      { … }
      // - TRANSPARENT TASKS (sorted by depth)
      { … }
      { … }
      { … }
    ```
  - Then while we are iterating we just need to detect when `renderLayer` changes and clear the depth mask.
  - THEN THEORETICALLY tasks can define a custom layer to just draw on top of everything else (e.g. Editor gizmos)
 */
export interface DrawQueues {
  opaque: DrawTask[];
  transparent: TransparentDrawTask[];
}

export interface EngineConfig {
  readonly audio: {
    readonly numChannels: number;
  },
  readonly lighting: {
    readonly maxPointLights: number;
    readonly maxDirectionalLights: number;
  },
  readonly models: {
    readonly maxBones: number;
  },
}
export const DefaultEngineConfig = {
  audio: {
    numChannels: 24,
  },
  lighting: {
    maxPointLights: 4,
    maxDirectionalLights: 2,
  },
  models: {
    maxBones: 64,
  },
} satisfies EngineConfig;

export interface IEngine {
  loadScene(scene: IScene): void;
  run(onUpdate: (dt: number, stop: () => void) => void): void;

  get config(): EngineConfig;
  get gl(): WebGL2RenderingContext;
  get fileSystem(): IFileSystem;
  get collisionSystem(): CollisionSystem; // @TODO These should probably be behind interfaces
  get audioSystem(): IAudioSystem;
  get inputSystem(): IInputSystem;
  get activeScene(): IScene | undefined;
}

export class Engine implements IEngine {
  private readonly canvas: HTMLCanvasElement;
  public readonly gl: WebGL2RenderingContext;
  public readonly fileSystem: IFileSystem;
  public readonly collisionSystem: CollisionSystem;
  public readonly audioSystem: IAudioSystem;
  public readonly inputSystem: InputSystem;
  public readonly config: EngineConfig;

  private _normalTmp: Matrix3 = new Matrix3();

  private _activeScene: IScene | undefined;
  private cameraUbo: CameraUbo;
  private lightingUbo: LightingUbo;
  private fpsLimit: number | undefined;

  // @TODO Expose canvas aspect ratio and also somehow a method of listening to it
  public constructor(canvas: HTMLCanvasElement, fileSystem: IFileSystem, options?: DeepPartial<EngineConfig>) {
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

    this.config = {
      audio: {
        numChannels: options?.audio?.numChannels ?? DefaultEngineConfig.audio.numChannels,
      },
      lighting: {
        maxPointLights: options?.lighting?.maxPointLights ?? DefaultEngineConfig.lighting.maxPointLights,
        maxDirectionalLights: options?.lighting?.maxDirectionalLights ?? DefaultEngineConfig.lighting.maxDirectionalLights,
      },
      models: {
        maxBones: options?.models?.maxBones ?? DefaultEngineConfig.models.maxBones,
      },
    };

    this.gl = gl;
    this.collisionSystem = new CollisionSystem();
    this.audioSystem = new AudioSystem({ channels: this.config.audio.numChannels });
    this.inputSystem = new InputSystem(canvas);


    // Global UBOs
    this.cameraUbo = new Ubo(this, CameraUboName, CameraUboIndex, CameraUboPropertyNames);
    this.lightingUbo = new Ubo(this, LightingUboName, LightingUboIndex, LightingUboPropertyNames);

    // Register self in debug module
    DebugModule.registerEngineInstance(this, canvas);
  }

  public loadScene(scene: IScene): void {
    // @TODO a lot more than just this
    this.activeScene = scene;
  }

  /**
   * Set or clear the FPS limit for the render loop.
   * @param fps The target FPS, or undefined to disable limiting.
   */
  public setFpsLimit(fps: number | undefined): void {
    this.fpsLimit = fps;
  }

  public run(onUpdate: (dt: number, stop: () => void) => void): void {
    let lastFrameTime: DOMHighResTimeStamp | null = null;
    let isStopped = false;

    const debug_runStart = performance.now();
    const debug_frameTimes: number[] = [];

    // Count number of frames drawn per second
    const fps = rateCounter('FPS');
    const tick = (timestamp: DOMHighResTimeStamp): void => {
      if (lastFrameTime === null) {
        lastFrameTime = timestamp;
      }

      if (this.fpsLimit !== undefined) {
        const framePeriod = 1000 / this.fpsLimit;
        if (timestamp < lastFrameTime + framePeriod) {
          requestAnimationFrame(tick);
          return;
        }
      }

      fps.count();
      const startFrameTime = timestamp;
      const dt = (startFrameTime - lastFrameTime) / 1000;
      if (this.fpsLimit !== undefined) {
        lastFrameTime = lastFrameTime + (1000 / this.fpsLimit);
      } else {
        lastFrameTime = startFrameTime;
      }

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
        this.activeScene.lighting.bindToUbo(this.gl, this.lightingUbo, this.config.lighting);
      }

      /* Audio system */
      this.audioSystem.onUpdate(this);

      /* Input system */
      this.inputSystem.onUpdate();

      /* Draw scene */
      // @TODO Is there a way we can efficiently clear this memory?
      const drawQueues: DrawQueues = {
        opaque: [],
        transparent: [],
      };
      this.activeScene?.draw(drawQueues);

      drawQueues.opaque.sort((taskA, taskB) => {
        return taskA.renderPass - taskB.renderPass ||
          taskA.shaderVariant.id - taskB.shaderVariant.id ||
          taskA.material.id - taskB.material.id ||
          taskA.draw.id - taskB.draw.id;
      });
      drawQueues.transparent.sort((drawTaskA, drawTaskB) => drawTaskA.depth - drawTaskB.depth);

      this.drawQueue(drawQueues.opaque);
      this.drawQueue(drawQueues.transparent);

      const debug_endFrame = performance.now();
      const debug_frameTime = debug_endFrame - debug_startFrame;
      debug_frameTimes.push(debug_frameTime);

      if (!isStopped) {
        requestAnimationFrame(tick);
      } else {
        this.audioSystem.destroy();
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

  private drawQueue(drawQueue: DrawTask[]): void {
    const { gl } = this;

    let currentShaderVariant: ShaderVariant = undefined!;
    let currentMaterial: MaterialInstance = undefined!;
    let currentDraw: DrawTask['draw'] = undefined!;

    for (const task of drawQueue) {

      /* GL Program */
      if (task.shaderVariant.id !== currentShaderVariant?.id) {
        currentShaderVariant = task.shaderVariant;
        gl.useProgram(task.shaderVariant.program);
      }

      /* Material */
      if (task.material.id !== currentMaterial?.id) {
        currentMaterial = task.material;
        const diffuseColorUniform = currentShaderVariant.getUniform('diffuseColor');
        if (task.material.diffuseColor !== undefined && diffuseColorUniform) {
          gl.uniform4fv(diffuseColorUniform, new Float32Array([
            task.material.diffuseColor.r / 255,
            task.material.diffuseColor.g / 255,
            task.material.diffuseColor.b / 255,
            task.material.diffuseColor.a / 255,
          ]));
        }

        // Blending
        switch (task.material.blendingMode.type) {
          case 'None':
            // No blending. No-op.
            break;
          case 'Average':
            // Average blending:
            //   Transparent pixel (alpha = 0.5):   0.5 * src + 0.5 * dest
            //   Opaque pixel (alpha = 1):          1 * src + 0 * dest
            gl.enable(gl.BLEND);
            gl.depthMask(false);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            break;
          case 'Additive':
            // Additive blending:
            //   Transparent pixel (alpha = 0):     1 * src + 1 * dest
            //   Opaque pixel (alpha = 1):          1 * src + 0 * dest
            gl.enable(gl.BLEND);
            gl.depthMask(false);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            break;
          case 'Subtractive':
            // Subtractive blending:
            //   Transparent pixel (alpha = 0):     1 * src - 1 * dest
            //   Opaque pixel (alpha = 1):          1 * src - 0 * dest
            gl.enable(gl.BLEND);
            gl.depthMask(false);
            gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            break;
          case 'AlphaBlend':
            // Alpha blending:
            //   Transparent pixel (alpha = X):     X * src + (1-X) * dest
            //   Opaque pixel (alpha = 1):          1 * src + 0 * dest
            gl.enable(gl.BLEND);
            gl.depthMask(false);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            break;
          case 'AlphaClip': {
            // Alpha clipping:
            //  No blending.
            //  Transparent pixel (alpha < cutoff):  0 * src + 1 * dest (discarded)
            //  Opaque pixel (alpha >= cutoff):      1 * src + 0 * dest
            const alphaCutoffUniform = currentShaderVariant.getUniform('alphaCutoff');
            if (alphaCutoffUniform) {
              gl.uniform1f(alphaCutoffUniform, task.material.blendingMode.cutoff);
            }
            break;
          }
          default:
            throw new Error(`Unimplemented blending mode: ${(task.material.blendingMode as { type: unknown }).type}`);
        }

        // Texture
        const textureSamplerUniform = currentShaderVariant.getUniform('sampler');
        if (textureSamplerUniform && task.material.diffuseTexture) {
          const textureIndex = 0; // @TODO ?
          gl.activeTexture(gl.TEXTURE0 + textureIndex);
          gl.bindTexture(gl.TEXTURE_2D, task.material.diffuseTexture.glTexture);
          gl.uniform1i(textureSamplerUniform, textureIndex);
        } else {
          gl.bindTexture(gl.TEXTURE_2D, null);
        }
      }

      /* Uniforms */
      // World matrix uniform
      const worldMatrixUniform = currentShaderVariant.getUniform('worldMatrix');
      if (worldMatrixUniform) {
        gl.uniformMatrix4fv(worldMatrixUniform, false, task.uniforms.worldMatrix.toArray());
      }

      // Lighting uniform
      const normalMatrixUniform = currentShaderVariant.getUniform('normalMatrix');
      if (normalMatrixUniform) {
        try {
          this._normalTmp.normalSelf(task.uniforms.worldMatrix);
        } catch (e) {
          // @NOTE Don't render if matrix cannot invert (e.g. scale=0)
          if (e instanceof CannotInvertMatrixError) return;
          else throw e;
        }
        gl.uniformMatrix3fv(normalMatrixUniform, false, this._normalTmp.toArray());
      }

      // Joint matrices uniform
      const jointMatrixUniform = currentShaderVariant.getUniform('jointMatrix');
      if (task.uniforms.skinWeights && jointMatrixUniform) {
        gl.uniformMatrix4fv(jointMatrixUniform, false, task.uniforms.skinWeights);
      }

      /* Mesh */
      if (task.draw.id !== currentDraw?.id) {
        currentDraw = task.draw;
        task.draw.init(this);
      }

      currentDraw.exec(this);
    }

    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.depthMask(true);
  }

  public get activeScene(): IScene | undefined {
    return this._activeScene;
  }
  private set activeScene(value: IScene) {
    this._activeScene = value;
  }
}

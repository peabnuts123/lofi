import { CannotInvertMatrixError, Matrix3 } from "@lofi/core/math/Matrix3";
import type { DeepPartial } from "@lofi/core/util/types";
import { type Matrix4 } from "@lofi/core/math";

import { CameraUboIndex, CameraUboName, CameraUboPropertyNames, type CameraUbo } from "./scene/nodes/CameraNode";
import type { IFileSystem } from "./filesystem";
import { LightingUboIndex, LightingUboName, LightingUboPropertyNames, type LightingUbo } from "./scene/SceneLighting";
import { MaterialInstance, ShaderVariant, Ubo } from "./materials";
import type { IScene } from "./scene";
import { RateCounter } from "@lofi/core/util/RateCounter";
import { CollisionSystem } from "./collision";
import { AudioSystem, type IAudioSystem } from "./audio/AudioSystem";
import { DebugModule } from "./util/DebugModule";
import { InputSystem, type IInputSystem } from "./input";

export type DrawTask = OpaqueDrawTask | TransparentDrawTask;

export interface DrawTaskCommon {
  renderLayer: number;
  shaderVariant: ShaderVariant;
  material: MaterialInstance;
  uniforms: {
    worldMatrix: Matrix4;
    skinWeights?: Float32Array; // @TODO poorly named? Should be skin matrix bytes
  },
  draw: {
    id: number;
    init: (engine: IEngine) => void;
    exec: (engine: IEngine) => void;
  },
}

export interface OpaqueDrawTask extends DrawTaskCommon {
  isTransparent: false;
}

export interface TransparentDrawTask extends DrawTaskCommon {
  isTransparent: true;
  depth: number;
}

export interface EngineConfig {
  readonly audio: {
    readonly numChannels: number;
  },
  readonly lighting: {
    readonly maxPointLights: number;
    readonly defaultPointLightRange: number;
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
    defaultPointLightRange: 10,
    maxDirectionalLights: 2,
  },
  models: {
    maxBones: 64,
  },
} satisfies EngineConfig;

export type OnUpdateFn = (dt: number, time: number, stop: () => void) => void

export interface IEngine {
  loadScene(scene: IScene): void;
  run(onUpdate: OnUpdateFn): void;

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
        defaultPointLightRange: options?.lighting?.defaultPointLightRange ?? DefaultEngineConfig.lighting.defaultPointLightRange,
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

  public run(onUpdate?: OnUpdateFn): void {
    let lastFrameTime: DOMHighResTimeStamp | null = null;
    let isStopped = false;

    // Count number of frames drawn per second
    const fps = new RateCounter('FPS');
    // RateCounter.tmp = new RateCounter('tmp_per_frame', fps);

    const Debug_ResourceCountersEnabled = false;
    const debug_resourceCounters = {
      shader: {
        new: new RateCounter('shader:new', fps, { startDisabled: !Debug_ResourceCountersEnabled }),
        shared: new RateCounter('shader:shared', fps, { startDisabled: !Debug_ResourceCountersEnabled }),
      },
      material: {
        new: new RateCounter('material:new', fps, { startDisabled: !Debug_ResourceCountersEnabled }),
        shared: new RateCounter('material:shared', fps, { startDisabled: !Debug_ResourceCountersEnabled }),
      },
      mesh: {
        new: new RateCounter('mesh:new', fps, { startDisabled: !Debug_ResourceCountersEnabled }),
        shared: new RateCounter('mesh:shared', fps, { startDisabled: !Debug_ResourceCountersEnabled }),
      },
      drawCalls: new RateCounter('draw calls', fps, { startDisabled: !Debug_ResourceCountersEnabled }),
    };
    const forEachResourceCounter = (callbackFn: (rateCounter: RateCounter) => void, __target?: object): void => {
      const target = __target ?? debug_resourceCounters;
      for (const key of Object.values(target)) {
        if (key instanceof RateCounter) {
          callbackFn(key);
        } else {
          forEachResourceCounter(callbackFn, key as object);
        }
      }
    };

    const drawQueue: DrawTask[] = [];
    const tick = (timestamp: DOMHighResTimeStamp): void => {
      if (lastFrameTime === null) {
        lastFrameTime = timestamp - (1000 / 60); // @NOTE First frame defaults to 60fps
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

      /* Update internal state first */
      this.activeScene?.onUpdate(dt, timestamp / 1000);

      /* Update external (user-controlled) state second */
      onUpdate?.(dt, timestamp / 1000, () => isStopped = true);

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
      drawQueue.length = 0; // @NOTE Overwrite memory instead of reallocating every frame
      this.activeScene?.draw(drawQueue);
      this.sortDrawQueue(drawQueue);
      // @TODO probably formalise the debug counters into a concrete type
      const resources = this.draw(drawQueue);
      debug_resourceCounters.shader.new.count(resources.shader.new);
      debug_resourceCounters.shader.shared.count(resources.shader.shared);
      debug_resourceCounters.material.new.count(resources.material.new);
      debug_resourceCounters.material.shared.count(resources.material.shared);
      debug_resourceCounters.mesh.new.count(resources.mesh.new);
      debug_resourceCounters.mesh.shared.count(resources.mesh.shared);
      debug_resourceCounters.drawCalls.count(resources.drawCalls);

      if (!isStopped) {
        requestAnimationFrame(tick);
      } else {
        fps.stop();
        forEachResourceCounter((rateCounter) => rateCounter.stop());
        this.audioSystem.destroy();
        console.log(`[Engine] Stopped.`);
      }
    };

    requestAnimationFrame(tick);
  }

  private tmp_draw_color4Buffer = new Float32Array(4);
  private tmp_draw_mat4Buffer = new Float32Array(16);
  private tmp_draw_mat3Buffer = new Float32Array(9);
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private draw(drawQueue: DrawTask[]) {
    const { gl } = this;

    gl.clearColor(0.05, 0.05, 0.2, 1); // @TODO configurable lol
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    // gl.cullFace(gl.BACK);
    // gl.frontFace(gl.CCW);
    // gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    let currentShaderVariant: ShaderVariant = undefined!;
    let currentMaterial: MaterialInstance = undefined!;
    let currentDraw: OpaqueDrawTask['draw'] = undefined!;

    const ResourceCount = {
      shader: { new: 0, shared: 0 },
      material: { new: 0, shared: 0 },
      mesh: { new: 0, shared: 0 },
      drawCalls: 0,
    };

    // Early exit if we don't need to draw anything
    if (drawQueue.length === 0) {
      return ResourceCount;
    }

    let currentRenderLayer = drawQueue[0].renderLayer;

    for (const task of drawQueue) {
      /* Render layer */
      if (task.renderLayer !== currentRenderLayer) {
        currentRenderLayer = task.renderLayer;
        gl.depthMask(true);
        gl.clear(gl.DEPTH_BUFFER_BIT);
      }

      /* GL Program */
      if (task.shaderVariant.id !== currentShaderVariant?.id) {
        ResourceCount.shader.new++;
        currentShaderVariant = task.shaderVariant;
        gl.useProgram(task.shaderVariant.program);
      } else {
        ResourceCount.shader.shared++;
      }

      /* Material */
      if (task.material.id !== currentMaterial?.id) {
        ResourceCount.material.new++;
        currentMaterial = task.material;
        // Diffuse color
        const diffuseColorUniform = currentShaderVariant.getUniform('diffuseColor');
        if (task.material.diffuseColor !== undefined && diffuseColorUniform) {
          this.tmp_draw_color4Buffer[0] = task.material.diffuseColor.r / 255;
          this.tmp_draw_color4Buffer[1] = task.material.diffuseColor.g / 255;
          this.tmp_draw_color4Buffer[2] = task.material.diffuseColor.b / 255;
          this.tmp_draw_color4Buffer[3] = task.material.diffuseColor.a / 255;
          gl.uniform4fv(diffuseColorUniform, this.tmp_draw_color4Buffer);
        }

        // Blending
        switch (task.material.blendingMode.type) {
          case 'None':
            // No blending. No-op.
            gl.disable(gl.BLEND);
            gl.depthMask(true);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.ONE, gl.ZERO);
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
            gl.disable(gl.BLEND);
            gl.depthMask(true);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.ONE, gl.ZERO);
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

        // Diffuse texture
        const diffuseTextureSamplerUniform = currentShaderVariant.getUniform('diffuseTextureSampler');
        if (diffuseTextureSamplerUniform && task.material.diffuseTexture) {
          const textureSlot = 0;
          gl.activeTexture(gl.TEXTURE0 + textureSlot);
          gl.bindTexture(gl.TEXTURE_2D, task.material.diffuseTexture.glTexture);
          gl.uniform1i(diffuseTextureSamplerUniform, textureSlot);
        } else {
          gl.bindTexture(gl.TEXTURE_2D, null);
        }

        /* Reflection - cubemap */
        const cubemapSamplerUniform = currentShaderVariant.getUniform('cubemapSampler');
        if (cubemapSamplerUniform && task.material.reflectionCubemap) {
          const textureSlot = 1;
          gl.activeTexture(gl.TEXTURE0 + textureSlot);
          gl.bindTexture(gl.TEXTURE_CUBE_MAP, task.material.reflectionCubemap.glTexture);
          gl.uniform1i(cubemapSamplerUniform, textureSlot);
        }

        /* Reflection - intensity */
        const cubemapIntensityUniform = currentShaderVariant.getUniform('cubemapIntensity');
        if (cubemapIntensityUniform) {
          gl.uniform1f(cubemapIntensityUniform, task.material.reflectionIntensity);
        }
      } else {
        ResourceCount.material.shared++;
      }

      /* Uniforms */
      // World matrix uniform
      const worldMatrixUniform = currentShaderVariant.getUniform('worldMatrix');
      if (worldMatrixUniform) {
        task.uniforms.worldMatrix.writeTo(this.tmp_draw_mat4Buffer);
        gl.uniformMatrix4fv(worldMatrixUniform, false, this.tmp_draw_mat4Buffer);
      }

      // Lighting uniform
      const normalMatrixUniform = currentShaderVariant.getUniform('normalMatrix');
      if (normalMatrixUniform) {
        try {
          this._normalTmp.normalSelf(task.uniforms.worldMatrix);
        } catch (e) {
          // @NOTE Don't render if matrix cannot invert (e.g. scale=0)
          if (e instanceof CannotInvertMatrixError) continue;
          else throw e;
        }
        this._normalTmp.writeTo(this.tmp_draw_mat3Buffer);
        gl.uniformMatrix3fv(normalMatrixUniform, false, this.tmp_draw_mat3Buffer);
      }

      // Joint matrices uniform
      const jointMatrixUniform = currentShaderVariant.getUniform('jointMatrix');
      if (task.uniforms.skinWeights && jointMatrixUniform) {
        gl.uniformMatrix4fv(jointMatrixUniform, false, task.uniforms.skinWeights);
      }

      /* Mesh */
      if (task.draw.id !== currentDraw?.id) {
        ResourceCount.mesh.new++;
        currentDraw = task.draw;
        task.draw.init(this);
      } else {
        ResourceCount.mesh.shared++;
      }

      ResourceCount.drawCalls++;
      currentDraw.exec(this);
    }

    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ZERO);

    return ResourceCount;
  }

  private sortDrawQueue(drawQueue: DrawTask[]): void {
    drawQueue.sort((taskA, taskB) => {
      return (taskA.renderLayer - taskB.renderLayer) ||
        // @ts-expect-error bools CAN be subtracted it's FINE
        (taskA.isTransparent - taskB.isTransparent) ||
        (taskA.isTransparent ? (
          /* Transparent */
          // @NOTE We only enter this "branch" if `isTransparent` is the same for both tasks
          // Sort descending (draw most distant tasks first)
          (taskB as TransparentDrawTask).depth - taskA.depth
        ) : (
          /* Opaque */
          (taskA.shaderVariant.id - taskB.shaderVariant.id) ||
          (taskA.material.id - taskB.material.id) ||
          (taskA.draw.id - taskB.draw.id)
        ));
    });
  }

  public get activeScene(): IScene | undefined {
    return this._activeScene;
  }
  private set activeScene(value: IScene) {
    this._activeScene = value;
  }
}

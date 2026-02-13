import { CameraUboIndex, CameraUboName, CameraUboPropertyNames, type CameraUbo } from "./scene/nodes/CameraNode";
import type { IFileSystem } from "./filesystem";
import { LightingUboIndex, LightingUboName, LightingUboPropertyNames, type LightingUbo } from "./scene/SceneLighting";
import { Material, ShaderProgram, Ubo } from "./materials";
import type { DrawTask, IScene, TransparentDrawTask } from "./scene";
import { rateCounter } from "./util/debug";
import { CollisionSystem } from "./collision";
import { CannotInvertMatrixError, Matrix3 } from "./util/Matrix3";

export interface DrawQueues {
  opaque: DrawTask[];
  transparent: TransparentDrawTask[];
}

export interface IEngine {
  loadScene(scene: IScene): void;
  run(onUpdate: (dt: number, stop: () => void) => void): void;

  get gl(): WebGL2RenderingContext;
  get fileSystem(): IFileSystem;
  get collision(): CollisionSystem;
  get activeScene(): IScene | undefined;
}

export class Engine implements IEngine {
  private readonly canvas: HTMLCanvasElement;
  public readonly gl: WebGL2RenderingContext;
  public readonly fileSystem: IFileSystem;
  public readonly collision: CollisionSystem;

  private _normalTmp: Matrix3 = new Matrix3();

  private _activeScene: IScene | undefined;
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
    this.collision = new CollisionSystem();

    // Global UBOs
    this.cameraUbo = new Ubo(this, CameraUboName, CameraUboIndex, CameraUboPropertyNames);
    this.lightingUbo = new Ubo(this, LightingUboName, LightingUboIndex, LightingUboPropertyNames);
  }

  public loadScene(scene: IScene): void {
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
      // @TODO Is there a way we can efficiently clear this memory?
      const drawQueues: DrawQueues = {
        opaque: [],
        transparent: [],
      };
      this.activeScene?.draw(drawQueues);

      drawQueues.opaque.sort((taskA, taskB) => {
        return taskA.renderPass - taskB.renderPass ||
          taskA.glProgram.id - taskB.glProgram.id ||
          taskA.material.id - taskB.material.id ||
          taskA.mesh.id - taskB.mesh.id;
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

    let currentGlProgram: ShaderProgram = undefined!;
    let currentMaterial: Material = undefined!;
    let currentMesh: DrawTask['mesh'] = undefined!;

    for (const task of drawQueue) {

      /* GL Program */
      if (currentGlProgram !== task.glProgram) {
        currentGlProgram = task.glProgram;
        gl.useProgram(task.glProgram.program);
      }

      /* Material */
      if (currentMaterial !== task.material) {
        currentMaterial = task.material;
        const diffuseColorUniform = currentGlProgram.getUniform('diffuseColor');
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
            const alphaCutoffUniform = currentGlProgram.getUniform('alphaCutoff');
            if (alphaCutoffUniform) {
              gl.uniform1f(alphaCutoffUniform, task.material.blendingMode.cutoff);
            }
            break;
          }
          default:
            throw new Error(`Unimplemented blending mode: ${(task.material.blendingMode as { type: unknown }).type}`);
        }

        // Texture
        const textureSamplerUniform = currentGlProgram.getUniform('sampler');
        if (textureSamplerUniform && task.material.diffuseTexture) {
          const textureIndex = 0; // @TODO ?
          gl.activeTexture(gl.TEXTURE0 + textureIndex);
          gl.bindTexture(gl.TEXTURE_2D, task.material.diffuseTexture.texture);
          gl.uniform1i(textureSamplerUniform, textureIndex);
        } else {
          gl.bindTexture(gl.TEXTURE_2D, null);
        }
      }

      /* Uniforms */
      // World matrix uniform
      const worldMatrixUniform = currentGlProgram.getUniform('worldMatrix');
      if (worldMatrixUniform) {
        gl.uniformMatrix4fv(worldMatrixUniform, false, task.uniforms.worldMatrix.toArray());
      }

      // Lighting uniform
      const normalMatrixUniform = currentGlProgram.getUniform('normalMatrix');
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
      const jointMatrixUniform = currentGlProgram.getUniform('jointMatrix');
      if (task.uniforms.skinWeights && jointMatrixUniform) {
        gl.uniformMatrix4fv(jointMatrixUniform, false, task.uniforms.skinWeights);
      }

      /* Mesh */
      if (task.mesh !== currentMesh) {
        currentMesh = task.mesh;
        gl.bindVertexArray(task.mesh.vao);
      }

      currentMesh.draw();
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

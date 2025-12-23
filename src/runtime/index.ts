import { mat4, vec3, glMatrix } from 'gl-matrix';

import { Lighting, LightingUboIndex, LightingUboPropertyNames, PointLight } from '@polyzone/engine/lighting';
import { Camera, CameraUboIndex, CameraUboPropertyNames } from '@polyzone/engine/camera';
import { Mesh, type GeometryDefinition } from '@polyzone/engine/models';
import type { Vector3 } from '@polyzone/engine/util/vector';
import { Material, Ubo } from '@polyzone/engine/materials';
import { GameObject } from '@polyzone/engine/objects';
import { Texture } from '@polyzone/engine/textures';


export interface CartridgeDefinition {
  geometry: GeometryDefinition[],
}

export async function fetchBytes(url: string): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(url);
  if (response.ok) {
    return response.bytes();
  } else {
    throw new Error(`Failed to get: ${url}`);
  }
}

export class Runtime {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;

  private isCartridgeLoaded: boolean = false;
  private camera: Camera | undefined;
  private lighting: Lighting | undefined;
  private debugObjects: GameObject[] | undefined;
  private debug_lightFacades: GameObject[] | undefined;

  public constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = this.canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (gl === null) {
      throw new Error(`WebGL2 not supported`);
    }

    this.gl = gl;
  }

  public async loadCartridge(cartridge: CartridgeDefinition): Promise<void> {
    const { gl } = this;

    this.isCartridgeLoaded = false;


    const stoneTextureBytes = await fetchBytes('/textures/stones.png');
    const stoneTexture = await Texture.fromBytes(gl, stoneTextureBytes);

    const stoneMaterial = new Material(gl, "Stone", {}, stoneTexture);

    const lightingUbo = new Ubo(gl, 'Lighting', LightingUboIndex, LightingUboPropertyNames, stoneMaterial.shader);
    this.lighting = new Lighting(lightingUbo);
    this.lighting.ambientColor = { r: 0.1, g: 0.1, b: 0.1 };
    const LightDistance = 2.5;
    this.lighting.pointLights.push(new PointLight(
      {
        x: LightDistance * Math.sin(2 * Math.PI * 1 / 3),
        y: 2,
        z: LightDistance * Math.cos(2 * Math.PI * 1 / 3),
      },
      // { r: 1, g: 0, b: 0 },
      { r: 1, g: 1, b: 1 },
    ));
    // this.lighting.pointLights.push(new PointLight(
    //   {
    //     x: LightDistance * Math.sin(2 * Math.PI * 2 / 3),
    //     y: 2,
    //     z: LightDistance * Math.cos(2 * Math.PI * 2 / 3),
    //   },
    //   // { r: 0, g: 1, b: 0 },
    //   { r: 0.8, g: 0.8, b: 0.8 },
    // ));
    // this.lighting.pointLights.push(new PointLight(
    //   {
    //     x: LightDistance * Math.sin(2 * Math.PI * 3 / 3),
    //     y: 2,
    //     z: LightDistance * Math.cos(2 * Math.PI * 3 / 3),
    //   },
    //   { r: 0, g: 0, b: 1 },
    // ));

    const debugMesh = new Mesh(gl, cartridge.geometry[0], stoneMaterial);
    this.debugObjects = [
      // (() => {
      //   const object = new GameObject(debugMesh);
      //   object.position.x = -1.5;
      //   return object;
      // })(),
      // (() => {
      //   const object = new GameObject(debugMesh);
      //   object.position.x = 1.5;
      //   return object;
      // })(),
      // (() => {
      //   const object = new GameObject(debugMesh);
      //   object.position.z = -1.5;
      //   return object;
      // })(),
      // (() => {
      //   const object = new GameObject(debugMesh);
      //   object.position.z = 1.5;
      //   return object;
      // })(),
      (() => {
        const object = new GameObject(debugMesh);
        object.position.y = -1;
        object.scale.x = 4;
        object.scale.z = 4;
        return object;
      })(),
      ...cartridge.geometry.slice(1).map((geometry) => {
        const object = new GameObject(
          new Mesh(
            gl,
            geometry,
            new Material(
              gl,
              geometry.material.name ?? "",
              geometry.material,
              undefined,
            ),
          ),
        );
        object.position.y = -0.5;
        object.scale = { x: 3, y: 3, z: 3 };
        return object;
      }),
    ];
    this.debug_lightFacades = this.lighting.pointLights.map((light) => {
      const object = new GameObject(debugMesh);
      object.position = light.position;
      object.scale = { x: 0.1, y: 0.1, z: 0.1 };
      return object;
    });

    const cameraUbo = new Ubo(gl, 'Camera', CameraUboIndex, CameraUboPropertyNames, stoneMaterial.shader);
    this.camera = new Camera(50, this.canvas.width / this.canvas.height, cameraUbo);
    this.camera.position = {
      x: 0,
      y: 1,
      z: 3.5,
    };

    this.isCartridgeLoaded = true;
  }

  public run(): void {
    if (!this.isCartridgeLoaded) {
      throw new Error('Cartridge not loaded');
    }
    const { gl } = this;

    // @TODO ???
    // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    let lastFrameTime = performance.now();

    /* @TODO Mostly a bunch of @DEBUG nonsense */
    const CameraRotationSpeedDegreesPerSecond = 15;
    let debug_cameraAngle = 0;

    const rotationMatrixTmp = mat4.create();
    const rotationResultTmp = vec3.create();
    function rotateVector3(vector: Vector3, degrees: number): void {
      // Construct rotation matrix
      mat4.fromYRotation(rotationMatrixTmp, glMatrix.toRadian(degrees));
      // Load into rotation tmp
      rotationResultTmp[0] = vector.x;
      rotationResultTmp[1] = vector.y;
      rotationResultTmp[2] = vector.z;
      // Multiply by rotation matrix
      vec3.transformMat4(rotationResultTmp, rotationResultTmp, rotationMatrixTmp);
      // Read back into vector
      vector.x = rotationResultTmp[0];
      vector.y = rotationResultTmp[1];
      vector.z = rotationResultTmp[2];
    }
    const draw = (): void => {
      if (!this.isCartridgeLoaded) {
        throw new Error('Cartridge not loaded');
      }

      const camera = this.camera!;
      const debugObjects = this.debugObjects!;
      const debug_lightFacedes = this.debug_lightFacades!;
      const lighting = this.lighting!;

      const thisFrameTime = performance.now();
      const dt = (thisFrameTime - lastFrameTime) / 1000;
      lastFrameTime = thisFrameTime;

      gl.clearColor(0.05, 0.05, 0.2, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      // gl.cullFace(gl.BACK);
      // gl.frontFace(gl.CCW);
      // gl.viewport(0, 0, this.canvas.width, this.canvas.height);


      /* @DEBUG Mostly just fancy demoscene stuff */
      debug_cameraAngle += dt * glMatrix.toRadian(CameraRotationSpeedDegreesPerSecond);
      rotateVector3(camera.position, dt * CameraRotationSpeedDegreesPerSecond);
      camera.position.y = Math.sin(debug_cameraAngle) + 2;
      camera.pointAt({ x: 0, y: -1, z: 0 });
      for (const light of lighting.pointLights) {
        rotateVector3(light.position, dt * 25);
      }

      // Update UBOs
      camera.recalculateViewProjectionMatrix(gl);
      lighting.recalculateLightingData(gl);

      // Draw scene
      for (const debugObject of debugObjects) {
        debugObject.draw(gl);
      }
      for (const obj of debug_lightFacedes) {
        obj.draw(gl);
      }

      requestAnimationFrame(draw);
    };

    requestAnimationFrame(draw);
  }
}


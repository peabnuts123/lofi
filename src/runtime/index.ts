import { mat4, vec3, glMatrix } from 'gl-matrix';

import { PointLight } from '@polyzone/engine/lighting';
import { Camera } from '@polyzone/engine/camera';
import { Model, ModelNode, type ModelDefinition } from '@polyzone/engine/models';
import type { Vector3 } from '@polyzone/engine/util/vector';
import { Engine } from '@polyzone/engine/Engine';
import { Scene } from '@polyzone/engine/scene';
import { WebFileSystem } from '@polyzone/engine/filesystem/WebFileSystem';

export interface CartridgeDefinition {
  models: ModelDefinition[];
}

export class Runtime {
  private engine: Engine | undefined;
  private camera: Camera | undefined;
  private lights: PointLight[] | undefined;

  public async loadCartridge(canvas: HTMLCanvasElement, cartridge: CartridgeDefinition): Promise<void> {
    const fileSystem = new WebFileSystem();
    const engine = this.engine = new Engine(canvas, fileSystem);
    const scene = new Scene(engine);
    scene.lighting.ambientColor = { r: 0.1, g: 0.1, b: 0.1 };

    const camera = this.camera = new Camera('camera', 70, canvas.width / canvas.height);
    camera.position = { x: 0, y: 1, z: 3.5 };
    scene.addNode(camera);

    const LightDistance = 2.5;
    const lights = this.lights = [] as PointLight[];
    const light0 = new PointLight(
      'light0',
      {
        x: LightDistance * Math.sin(2 * Math.PI * 1 / 3),
        y: 2,
        z: LightDistance * Math.cos(2 * Math.PI * 1 / 3),
      },
      { r: 1, g: 0, b: 0 },
    );
    scene.addNode(light0);
    lights.push(light0);
    const light1 = new PointLight(
      'light1',
      {
        x: LightDistance * Math.sin(2 * Math.PI * 2 / 3),
        y: 2,
        z: LightDistance * Math.cos(2 * Math.PI * 2 / 3),
      },
      { r: 0, g: 1, b: 0 },
    );
    scene.addNode(light1);
    lights.push(light1);
    const light2 = new PointLight(
      'light2',
      {
        x: LightDistance * Math.sin(2 * Math.PI * 3 / 3),
        y: 2,
        z: LightDistance * Math.cos(2 * Math.PI * 3 / 3),
      },
      { r: 0, g: 0, b: 1 },
    );
    scene.addNode(light2);
    lights.push(light2);

    // Load models
    const boxModel = await Model.fromDefinition(engine, cartridge.models[0]);
    const burgerModel = await Model.fromDefinition(engine, cartridge.models[1]);

    // Create @DEBUG objects
    const eastBox = new ModelNode('east', boxModel);
    eastBox.position.x = -1.5;
    scene.addNode(eastBox);

    const westBox = new ModelNode('west', boxModel);
    westBox.position.x = 1.5;
    scene.addNode(westBox);

    const southBox = new ModelNode('south', boxModel);
    southBox.position.z = -1.5;
    scene.addNode(southBox);

    const northBox = new ModelNode('north', boxModel);
    northBox.position.z = 1.5;
    scene.addNode(northBox);

    const ground = new ModelNode('ground', boxModel);
    ground.position.y = -1;
    ground.scale.x = 4;
    ground.scale.z = 4;
    scene.addNode(ground);

    const burger = new ModelNode('burger', burgerModel);
    burger.position.y = -0.5;
    burger.scale = { x: 3, y: 3, z: 3 };
    scene.addNode(burger);
  }

  public run(): void {
    if (!this.engine) throw new Error(`Haven't initialised yet`);

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

    this.engine.run((dt: number): void => {
      const camera = this.camera!;
      const lights = this.lights!;

      /* Spin / oscillate camera */
      debug_cameraAngle += dt * glMatrix.toRadian(CameraRotationSpeedDegreesPerSecond);
      rotateVector3(camera.position, dt * CameraRotationSpeedDegreesPerSecond);
      camera.position.y = Math.sin(debug_cameraAngle) + 2;
      camera.pointAt({ x: 0, y: -1, z: 0 });

      /* Spin lights */
      for (const light of lights) {
        rotateVector3(light.position, dt * 25);
      }
    });
  }
}


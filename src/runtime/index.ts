import { mat4, vec3, glMatrix } from 'gl-matrix';

import { CameraNode, ModelNode, PointLightNode } from '@polyzone/engine/scene/nodes';
import { Model, type ModelDefinition } from '@polyzone/engine/models';
import { Vector3 } from '@polyzone/engine/util/vector';
import { Engine } from '@polyzone/engine/Engine';
import { Scene } from '@polyzone/engine/scene';
import { WebFileSystem } from '@polyzone/engine/filesystem/WebFileSystem';
import { Color3 } from '@polyzone/engine/util/color';

export interface CartridgeDefinition {
  models: ModelDefinition[];
}
const GridW = 20;
const GridH = 20;
const GridSpacing = 0.6;

export class Runtime {
  private engine: Engine | undefined;

  private camera: CameraNode | undefined;
  private lights: PointLightNode[] | undefined;

  // private burger: ModelNode | undefined;

  private testObjects: ModelNode[][] | undefined;

  public async loadCartridge(canvas: HTMLCanvasElement, cartridge: CartridgeDefinition): Promise<void> {
    const fileSystem = new WebFileSystem();
    const engine = this.engine = new Engine(canvas, fileSystem);
    const scene = new Scene(engine);
    scene.lighting.ambientColor = new Color3(0.1, 0.1, 0.1);

    const camera = this.camera = new CameraNode(scene, 'camera', 60, canvas.width / canvas.height);
    camera.position = new Vector3(-3.5, 2, 3.5);
    camera.pointAt(new Vector3(0, -1, 0));

    const LightDistance = 2.5;
    const lights = this.lights = [] as PointLightNode[];
    const light0 = new PointLightNode(scene, 'light0', new Color3(1, 0, 0));
    light0.position = new Vector3(
      LightDistance * Math.sin(2 * Math.PI * 0.2 / 3),
      2,
      LightDistance * Math.cos(2 * Math.PI * 1 / 3),
    );
    lights.push(light0);
    const light1 = new PointLightNode(scene, 'light1', new Color3(0, 1, 0));
    light1.position = new Vector3(
      LightDistance * Math.sin(2 * Math.PI * 2 / 3),
      2,
      LightDistance * Math.cos(2 * Math.PI * 2 / 3),
    );
    lights.push(light1);
    const light2 = new PointLightNode(scene, 'light2', new Color3(0, 0, 1));
    light2.position = new Vector3(
      LightDistance * Math.sin(2 * Math.PI * 3 / 3),
      2,
      LightDistance * Math.cos(2 * Math.PI * 3 / 3),
    );
    lights.push(light2);

    // Load models
    const boxModel = await Model.fromDefinition(engine, cartridge.models[0]);
    const burgerModel = await Model.fromDefinition(engine, cartridge.models[1]);

    // Create @DEBUG objects
    // const eastBox = new ModelNode(scene, 'east', boxModel);
    // eastBox.position.x = -1.5;

    // const westBox = new ModelNode(scene, 'west', boxModel);
    // westBox.position.x = 1.5;

    // const southBox = new ModelNode(scene, 'south', boxModel);
    // southBox.position.z = -1.5;

    // const northBox = new ModelNode(scene, 'north', boxModel);
    // northBox.position.z = 1.5;

    const ground = new ModelNode(scene, 'ground', boxModel);
    ground.position.y = -1;
    ground.scale.x = 4;
    ground.scale.z = 4;

    // this.burger = new ModelNode(scene, 'burger', burgerModel);
    // this.burger.position.y = -0.5;
    // this.burger.rotation.y = 40;
    // this.burger.scale = new Vector3(3, 3, 3);

    // const miniBurger = new ModelNode(scene, 'mini-burger', burgerModel);
    // miniBurger.position = new Vector3(0, -0.5, 1.5);
    // this.burger.addChild(miniBurger);

    this.testObjects = [];

    for (let i = 0; i < GridW; i++) {
      this.testObjects[i] = [];
      for (let j = 0; j < GridH; j++) {
        const burger = new ModelNode(scene, 'burger', burgerModel);
        this.testObjects[i].push(burger);

        burger.position = new Vector3((i - GridW / 2) * GridSpacing + 0.5, -0.5, (j - GridH / 2) * GridSpacing + 0.5);
        burger.scale.multiplySelf(1.7);

        const miniBurger = new ModelNode(scene, 'mini-burger', burgerModel);
        burger.addChild(miniBurger);
        miniBurger.position = new Vector3(0.2, 0, 0.2);
        miniBurger.scale.multiplySelf(0.5);
      }
    }
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

    let time = 0;
    const CyclePeriod = 4;
    function cycleBehaviours(reset: () => void, behaviours: Array<() => void>): void {
      reset();
      const behaviourIndex = ~~(time / CyclePeriod) % (behaviours.length + 1);
      if (behaviourIndex < behaviours.length) {
        behaviours[behaviourIndex]();
      }
    }

    const MaxRuntimeSeconds = 30;

    this.engine.run((dt, stop): void => {
      const camera = this.camera!;
      const lights = this.lights!;
      // const burger = this.burger!;
      const testObjects = this.testObjects!;

      /* Spin / oscillate camera */
      debug_cameraAngle += dt * glMatrix.toRadian(CameraRotationSpeedDegreesPerSecond);
      rotateVector3(camera.position, dt * CameraRotationSpeedDegreesPerSecond);
      camera.position.y = Math.sin(debug_cameraAngle) + 2;
      camera.pointAt(new Vector3(0, -1, 0));

      let n = 0;
      for (let i = 0; i < testObjects.length; i++) {
        for (let j = 0; j < testObjects[i].length; j++) {
          const testObject = testObjects[i][j];
          const uniqueParam = (time + (n / 10));
          testObject.rotation.y = (uniqueParam * 360 / 8) % 360;
          testObject.position = new Vector3(
            (i - testObjects.length / 2) * GridSpacing + 0.5 + Math.sin(uniqueParam) * 0.3,
            -0.5,
            (j - testObjects[i].length / 2) * GridSpacing + 0.5 + Math.cos(uniqueParam) * 0.3,
          );
          testObject.scale = Vector3.one().multiplySelf(Math.sin(uniqueParam) / 3 + 1);
          n++;
        }
      }

      // cycleBehaviours(() => {
      //   burger.position = Vector3.zero().withY(-0.5);
      //   // burger.rotation.set(Quaternion.identity());
      //   burger.scale = Vector3.one().multiplySelf(2);
      // }, [
      //   () => burger.rotation.y = (time * 360 / 8) % 360,
      //   () => burger.position = new Vector3(Math.sin(time) * 2, burger.position.y, Math.cos(time) * 2),
      //   () => burger.scale = Vector3.one().multiplySelf(Math.sin(time * 2 * Math.PI / 4) + 1.1),
      // ]);

      /* Spin lights */
      for (const light of lights) {
        rotateVector3(light.position, dt * 25);
      }

      time += dt;

      if (time > MaxRuntimeSeconds) {
        stop();
      }
    });
  }
}


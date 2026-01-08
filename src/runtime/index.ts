import { CameraNode, ModelNode, ObjectNode, PointLightNode } from '@polyzone/engine/scene/nodes';
import { Model, type ModelDefinition } from '@polyzone/engine/models';
import { Vector3 } from '@polyzone/engine/util/vector';
import { Engine, type IEngine } from '@polyzone/engine/Engine';
import { Scene, SceneNode } from '@polyzone/engine/scene';
import { WebFileSystem } from '@polyzone/engine/filesystem/WebFileSystem';
import { Color3 } from '@polyzone/engine/util/Color3';
import { Quaternion } from '@polyzone/engine/util/quaternion';
import { DegreesToRadians } from '@polyzone/engine/util/math';

export interface CartridgeDefinition {
  models: ModelDefinition[];
}
interface SceneState {
  cameraOrigin: SceneNode;
  camera: CameraNode;
  lightOrigin: SceneNode;
  burger: ModelNode;
  testObjects: ModelNode[][] | undefined;
}

const TestObjectsEnabled = false;
const GridW = 20;
const GridH = 20;
const GridSpacing = 0.5;

export class Runtime {
  private engine: IEngine | undefined;

  private scene: SceneState | undefined;

  public async loadCartridge(canvas: HTMLCanvasElement, cartridge: CartridgeDefinition): Promise<void> {
    const fileSystem = new WebFileSystem();
    const engine = this.engine = new Engine(canvas, fileSystem);
    const scene = new Scene(engine);
    scene.lighting.ambientColor = new Color3(30, 30, 30);

    // Load models
    const boxModel = await Model.fromDefinition(engine, cartridge.models[0]);
    const burgerModel = await Model.fromDefinition(engine, cartridge.models[1]);

    const cameraOrigin = new ObjectNode(scene, 'camera_origin');
    const camera = new CameraNode(scene, 'camera', 70, canvas.width / canvas.height);
    camera.position = new Vector3(-3.5, 2, 3.5);
    camera.pointAt(new Vector3(0, 0, 0));
    cameraOrigin.addChild(camera);

    const LightDistance = 5;
    const lightOrigin = new ObjectNode(scene, 'light_origin');
    const light0 = new PointLightNode(scene, 'light0', Color3.red());
    light0.position = new Vector3(
      LightDistance * Math.sin(2 * Math.PI * 0.2 / 3),
      LightDistance,
      LightDistance * Math.cos(2 * Math.PI * 1 / 3),
    );
    lightOrigin.addChild(light0);
    const light1 = new PointLightNode(scene, 'light1', Color3.green());
    light1.position = new Vector3(
      LightDistance * Math.sin(2 * Math.PI * 2 / 3),
      LightDistance,
      LightDistance * Math.cos(2 * Math.PI * 2 / 3),
    );
    lightOrigin.addChild(light1);
    const light2 = new PointLightNode(scene, 'light2', Color3.blue());
    light2.position = new Vector3(
      LightDistance * Math.sin(2 * Math.PI * 3 / 3),
      LightDistance,
      LightDistance * Math.cos(2 * Math.PI * 3 / 3),
    );
    lightOrigin.addChild(light2);

    // Create @DEBUG objects
    const eastBox = new ModelNode(scene, 'east', boxModel);
    eastBox.position.x = -1.5;
    eastBox.scale.y = 0.1;
    eastBox.position.y = eastBox.scale.y / 2;

    const westBox = new ModelNode(scene, 'west', boxModel);
    westBox.position.x = 1.5;
    westBox.scale.y = 0.2;
    westBox.position.y = westBox.scale.y / 2;


    const southBox = new ModelNode(scene, 'south', boxModel);
    southBox.position.z = -1.5;
    southBox.scale.y = 0.3;
    southBox.position.y = southBox.scale.y / 2;


    const northBox = new ModelNode(scene, 'north', boxModel);
    northBox.position.z = 1.5;
    northBox.scale.y = 0.4;
    northBox.position.y = northBox.scale.y / 2;


    const ground = new ModelNode(scene, 'ground', boxModel);
    ground.position.y = -0.5;
    ground.scale.x = 4;
    ground.scale.z = 4;

    const burger = new ModelNode(scene, 'burger', burgerModel);
    burger.rotation.y = 40;
    burger.scale = new Vector3(3, 3, 3);

    const miniBurger = new ModelNode(scene, 'mini-burger', burgerModel);
    miniBurger.position = new Vector3(0, 0, 0.75);
    burger.addChild(miniBurger);


    let testObjects: ModelNode[][] | undefined = undefined;
    if (TestObjectsEnabled) {
      testObjects = [];
      for (let i = 0; i < GridW; i++) {
        testObjects[i] = [];
        for (let j = 0; j < GridH; j++) {
          const burger = new ModelNode(scene, 'burger', burgerModel);
          testObjects[i].push(burger);

          burger.position = new Vector3((i - GridW / 2) * GridSpacing + 0.5, -0.5, (j - GridH / 2) * GridSpacing + 0.5);
          burger.scale.multiplySelf(1.7);

          const miniBurger = new ModelNode(scene, 'mini-burger', burgerModel);
          burger.addChild(miniBurger);
          miniBurger.position = new Vector3(0.2, 0, 0.2);
          miniBurger.scale.multiplySelf(0.5);
        }
      }
    }

    /* @NOTE Blending test stuff */
    const blendingModel_average = await Model.fromDefinition(engine, cartridge.models[2]);
    const blendingAverage = new ModelNode(scene, 'blending_average', blendingModel_average);
    blendingAverage.position.x = 1.5;
    blendingAverage.position.y = 0.5;
    blendingAverage.position.z = 1.5;
    const blendingModel_additive = await Model.fromDefinition(engine, cartridge.models[3]);
    const blendingAdditive = new ModelNode(scene, 'blending_additive', blendingModel_additive);
    blendingAdditive.position.x = -1.5;
    blendingAdditive.position.y = 0.5;
    blendingAdditive.position.z = 1.5;
    const blendingModel_subtractive = await Model.fromDefinition(engine, cartridge.models[4]);
    const blendingSubtractive = new ModelNode(scene, 'blending_subtractive', blendingModel_subtractive);
    blendingSubtractive.position.x = 1.5;
    blendingSubtractive.position.y = 0.5;
    blendingSubtractive.position.z = -1.5;
    const blendingModel_sourceAlpha = await Model.fromDefinition(engine, cartridge.models[5]);
    const blendingSourceAlpha = new ModelNode(scene, 'blending_sourceAlpha', blendingModel_sourceAlpha);
    blendingSourceAlpha.position.x = -1.5;
    blendingSourceAlpha.position.y = 0.5;
    blendingSourceAlpha.position.z = -1.5;


    this.scene = {
      burger,
      camera,
      cameraOrigin,
      lightOrigin,
      testObjects,
    };
  }

  public run(): void {
    if (!this.engine) throw new Error(`Haven't initialised yet`);

    /* @TODO Mostly a bunch of @DEBUG nonsense */
    const CameraRotationSpeedDegreesPerSecond = 15;
    const LightRotationSpeedDegreesPerSecond = 25;

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
      const scene = this.scene;
      if (scene === undefined) throw new Error(`State is undefined`);

      /* Camera */
      scene.cameraOrigin.rotation.multiply(Quaternion.fromAxisAngle(Vector3.up(), dt * CameraRotationSpeedDegreesPerSecond));
      scene.camera.position.y = Math.sin(time * CameraRotationSpeedDegreesPerSecond * 2 * DegreesToRadians) * 1 + 2;
      scene.camera.pointAt(new Vector3(0, 0, 0));

      /* Collection of test objects */
      if (scene.testObjects !== undefined) {
        let n = 0;
        for (let i = 0; i < scene.testObjects.length; i++) {
          for (let j = 0; j < scene.testObjects[i].length; j++) {
            const testObject = scene.testObjects[i][j];
            const uniqueParam = (time + (n / 10));
            // testObject.rotation.y = (uniqueParam * 360 / 8) % 360;
            testObject.rotation.set(Quaternion.fromAxisAngle(Vector3.up(), (uniqueParam * 360 / 8) % 360));
            testObject.position = new Vector3(
              (i - scene.testObjects.length / 2) * GridSpacing + 0.5 + Math.sin(uniqueParam) * 0.3,
              0,
              (j - scene.testObjects[i].length / 2) * GridSpacing + 0.5 + Math.cos(uniqueParam) * 0.3,
            );
            testObject.scale = Vector3.one().multiplySelf(Math.sin(uniqueParam) / 3 + 1);
            n++;
          }
        }
      }

      /* Burger */
      cycleBehaviours(() => {
        scene.burger.position = Vector3.zero();
        scene.burger.rotation.set(Quaternion.identity());
        scene.burger.scale = Vector3.one().multiplySelf(2);
      }, [
        () => scene.burger.rotation.y = time * 360 / 8,
        () => scene.burger.position = new Vector3(Math.sin(time) * 2, scene.burger.position.y, Math.cos(time) * 2),
        () => scene.burger.scale = Vector3.one().multiplySelf(Math.sin(time * 2 * Math.PI / 4) + 1.5),
      ]);

      /* Spin lights */
      scene.lightOrigin.rotation.multiply(Quaternion.fromAxisAngle(Vector3.up(), dt * LightRotationSpeedDegreesPerSecond));

      time += dt;

      if (time > MaxRuntimeSeconds) {
        stop();
      }
    });
  }
}


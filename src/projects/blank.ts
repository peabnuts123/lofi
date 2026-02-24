import { CameraNode, ModelNode, PointLightNode } from '@polyzone/engine/scene/nodes';
import { Model } from '@polyzone/engine/models';
import { Vector3 } from '@polyzone/engine/util/vector';
import { Engine } from '@polyzone/engine/Engine';
import { Scene } from '@polyzone/engine/scene';
import { WebFileSystem } from '@polyzone/engine/filesystem/WebFileSystem';
import { Color3 } from '@polyzone/engine/util/Color3';
import { Quaternion } from '@polyzone/engine/util/quaternion';

import { DebugGeometry } from 'src/util/DebugGeometry';

const MaxRuntimeSeconds = 20;
const fileSystem = new WebFileSystem();
const debugGeometry = new DebugGeometry(fileSystem);

export abstract class Blank {
  public static async run(canvas: HTMLCanvasElement): Promise<void> {
    /* Engine */
    const engine = new Engine(canvas, fileSystem);
    const scene = new Scene(engine);
    scene.lighting.ambientColor = new Color3(30, 30, 30);

    /* Lighting */
    const light = new PointLightNode(scene, 'light', Color3.white());
    light.position = Vector3.one().withX(-1);

    /* Camera */
    const camera = new CameraNode(scene, 'camera', 70, canvas.width / canvas.height);
    camera.position = Vector3.one().multiplySelf(3);
    camera.pointAt(Vector3.zero());

    /* Models */
    const cubeModel = await Model.fromDefinition(engine, {
      rootNodes: [debugGeometry.simpleNode({ name: 'cube' })],
      animations: [],
    });

    /* Scene */
    const defaultCube = new ModelNode(scene, 'default_cube', cubeModel);

    /* Run */
    let time = 0;
    engine.run((dt, stop) => {
      // Spin cube
      defaultCube.rotation.multiply(Quaternion.fromAxisAngle(Vector3.up(), 45 * dt));

      time += dt;

      if (time > MaxRuntimeSeconds) {
        stop();
      }
    });
  }
}

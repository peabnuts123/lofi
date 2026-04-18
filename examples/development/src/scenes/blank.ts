import { Vector3, Color3, Quaternion } from '@lofi/core/math';
import { CameraNode, ModelNode, PointLightNode } from '@lofi/engine/scene/nodes';
import { Model } from '@lofi/engine/models';
import { Engine } from '@lofi/engine/Engine';
import { Scene } from '@lofi/engine/scene';
import { WebFileSystem } from '@lofi/engine/filesystem/WebFileSystem';

import { DebugGeometry } from '@game/util/DebugGeometry';

const MaxRuntimeSeconds = 20;
const fileSystem = new WebFileSystem();
const debugGeometry = new DebugGeometry(fileSystem);

const Flags = {
  /* @NOTE Flags duplicated so they can be turned off via commenting */
  ...{
    LightingEnabled: false,
  },
  LightingEnabled: true,
};

export abstract class Game {
  public static async run(canvas: HTMLCanvasElement): Promise<void> {
    /* Engine */
    const engine = new Engine(canvas, fileSystem);
    const scene = new Scene(engine);
    scene.lighting.ambientColor = new Color3(30, 30, 30);

    const runLoopHooks: Array<(dt: number) => void> = [];

    /* Lighting */
    if (Flags.LightingEnabled) {
      const light = new PointLightNode(scene, 'light', Color3.white());
      light.position = Vector3.one().setX(-1);
    }

    /* Camera */
    const camera = new CameraNode(scene, 'camera', 70, canvas.width / canvas.height);
    camera.position = Vector3.one().multiplySelf(3);
    camera.pointAt(Vector3.zero());

    /* Models */
    const cubeModel = await Model.fromDefinition(engine, {
      rootParts: [debugGeometry.simplePart({ name: 'cube' })],
      animations: [],
    });

    /* Scene */
    const defaultCube = new ModelNode(scene, 'default_cube', cubeModel);
    runLoopHooks.push((dt) => {
      // Spin cube
      defaultCube.rotation.multiply(Quaternion.fromAxisAngle(Vector3.up(), 45 * dt));
    });

    /* Run */
    let time = 0;
    engine.run((dt, stop) => {
      runLoopHooks.forEach((hook) => hook(dt));

      time += dt;
      if (time > MaxRuntimeSeconds) {
        stop();
      }
    });
  }
}

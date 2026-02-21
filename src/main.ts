// import { ObjLoader } from '@polyzone/engine/loaders';

import { Runtime, type CartridgeDefinition } from './runtime';
import { DebugModule } from './util/DebugModule';
import { WebFileSystem } from './engine/filesystem/WebFileSystem';

import './style.css';
import { Color4 } from './engine/util/Color4';
import { DebugGeometry } from './util/DebugGeometry';
import { GltfLoader } from './engine/loaders/GltfLoader';

DebugModule.register();


const fileSystem = new WebFileSystem();
const debugGeometry = new DebugGeometry(fileSystem);

const cartridge: CartridgeDefinition = {
  models: [
    /* 00 - Ground */
    {
      rootNodes: [debugGeometry.simpleNode({
        name: 'ground',
        primitive: debugGeometry.cubePrimitive(),
        material: await debugGeometry.material({
          name: 'ground',
          diffuseTexturePath: '/textures/stones.png',
        }),
      })],
      animations: [],
    },
    /* 01 - Real model */
    await GltfLoader.loadModel('/models/burger.glb', fileSystem),
    /* 02 - Blending sample */
    {
      rootNodes: [debugGeometry.simpleNode({
        name: 'blending',
        primitive: debugGeometry.cubePrimitive(),
        material: await debugGeometry.material({
          name: 'blending',
          diffuseTexturePath: '/textures/stones.png',
          diffuseColor: Color4.white().withA(0),
        }),
      })],
      animations: [],
    },
    /* 03 - Dumpster model */
    await GltfLoader.loadModel('/models/dumpster.glb', fileSystem),
    /* 04 - Animated model */
    await GltfLoader.loadModel('/models/temp/rig_mage.glb', fileSystem),
    /* 05 - Non-animated model */
    await GltfLoader.loadModel('/models/temp/Knight.glb', fileSystem),
  ],
};

const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
// @TODO delete runtime, inline here

const startButton = document.getElementById('start-button') as HTMLButtonElement;
// eslint-disable-next-line @typescript-eslint/no-misused-promises
startButton.addEventListener('click', async () => {
  const runtime = new Runtime();
  await runtime.loadCartridge(canvas, cartridge);
  startButton.remove();
  runtime.run();
});

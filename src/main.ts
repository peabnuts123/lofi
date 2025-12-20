import './style.css';
import { Runtime, type CartridgeDefinition } from './runtime';

const cartridge: CartridgeDefinition = {
  geometry: [{
    vertexPositions: [
      /* GL Triangle */
      // { x: 0.0, y: 0.5, z: 0 },
      // { x: -0.5, y: -0.5, z: 0 },
      // { x: 0.5, y: -0.5, z: 0 },

      /* Cube */
      { x: -0.5, y: -0.5, z:  0.5 },
      { x:  0.5, y: -0.5, z:  0.5 },
      { x:  0.5, y:  0.5, z:  0.5 },
      { x: -0.5, y:  0.5, z:  0.5 },
      { x: -0.5, y: -0.5, z: -0.5 },
      { x:  0.5, y: -0.5, z: -0.5 },
      { x:  0.5, y:  0.5, z: -0.5 },
      { x: -0.5, y:  0.5, z: -0.5 },
    ],
    faces: [
      /* GL Triangle */
      // [0, 1, 2],

      /* Cube */
      [0, 1, 2], [2, 3, 0], // Front face
      [1, 5, 6], [6, 2, 1], // Right face
      [5, 4, 7], [7, 6, 5], // Back face
      [4, 0, 3], [3, 7, 4], // Left face
      [3, 2, 6], [6, 7, 3], // Top face
      [4, 5, 1], [1, 0, 4], // Bottom face
    ],
    vertexColors: [
      { r: 0.0, g: 0.0, b: 1.0 }, // 0: -X, -Y, +Z = Blue
      { r: 1.0, g: 0.0, b: 1.0 }, // 1: +X, -Y, +Z = Magenta
      { r: 1.0, g: 1.0, b: 1.0 }, // 2: +X, +Y, +Z = White
      { r: 0.0, g: 1.0, b: 1.0 }, // 3: -X, +Y, +Z = Cyan
      { r: 0.0, g: 0.0, b: 0.0 }, // 4: -X, -Y, -Z = Black
      { r: 1.0, g: 0.0, b: 0.0 }, // 5: +X, -Y, -Z = Red
      { r: 1.0, g: 1.0, b: 0.0 }, // 6: +X, +Y, -Z = Yellow
      { r: 0.0, g: 1.0, b: 0.0 }, // 7: -X, +Y, -Z = Green
    ],
  }],
};

// Initialize the WebGL engine
// const engine = new WebGLEngine('webgl-canvas');
const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
const runtime = new Runtime(canvas);

runtime.loadCartridge(cartridge);
runtime.run();

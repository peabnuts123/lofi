import './style.css';
import { Runtime, type CartridgeDefinition } from './runtime';

const cartridge: CartridgeDefinition = {
  geometry: [{
    vertexPositions: [
      // Front face (z = 0.5) - indices 0-3
      { x: -0.5, y: -0.5, z: 0.5 },
      { x: 0.5, y: -0.5, z: 0.5 },
      { x: 0.5, y: 0.5, z: 0.5 },
      { x: -0.5, y: 0.5, z: 0.5 },

      // Right face (x = 0.5) - indices 4-7
      { x: 0.5, y: -0.5, z: 0.5 },
      { x: 0.5, y: -0.5, z: -0.5 },
      { x: 0.5, y: 0.5, z: -0.5 },
      { x: 0.5, y: 0.5, z: 0.5 },

      // Back face (z = -0.5) - indices 8-11
      { x: 0.5, y: -0.5, z: -0.5 },
      { x: -0.5, y: -0.5, z: -0.5 },
      { x: -0.5, y: 0.5, z: -0.5 },
      { x: 0.5, y: 0.5, z: -0.5 },

      // Left face (x = -0.5) - indices 12-15
      { x: -0.5, y: -0.5, z: -0.5 },
      { x: -0.5, y: -0.5, z: 0.5 },
      { x: -0.5, y: 0.5, z: 0.5 },
      { x: -0.5, y: 0.5, z: -0.5 },

      // Top face (y = 0.5) - indices 16-19
      { x: -0.5, y: 0.5, z: 0.5 },
      { x: 0.5, y: 0.5, z: 0.5 },
      { x: 0.5, y: 0.5, z: -0.5 },
      { x: -0.5, y: 0.5, z: -0.5 },

      // Bottom face (y = -0.5) - indices 20-23
      { x: -0.5, y: -0.5, z: -0.5 },
      { x: 0.5, y: -0.5, z: -0.5 },
      { x: 0.5, y: -0.5, z: 0.5 },
      { x: -0.5, y: -0.5, z: 0.5 },
    ],
    faces: [
      [0, 1, 2], [2, 3, 0],       // Front face
      [4, 5, 6], [6, 7, 4],       // Right face
      [8, 9, 10], [10, 11, 8],    // Back face
      [12, 13, 14], [14, 15, 12], // Left face
      [16, 17, 18], [18, 19, 16], // Top face
      [20, 21, 22], [22, 23, 20], // Bottom face
    ],
    textureCoordinates: [
      // Front face
      { u: 0.0, v: 0.0 },
      { u: 1.0, v: 0.0 },
      { u: 1.0, v: 1.0 },
      { u: 0.0, v: 1.0 },

      // Right face
      { u: 0.0, v: 0.0 },
      { u: 1.0, v: 0.0 },
      { u: 1.0, v: 1.0 },
      { u: 0.0, v: 1.0 },

      // Back face
      { u: 0.0, v: 0.0 },
      { u: 1.0, v: 0.0 },
      { u: 1.0, v: 1.0 },
      { u: 0.0, v: 1.0 },

      // Left face
      { u: 0.0, v: 0.0 },
      { u: 1.0, v: 0.0 },
      { u: 1.0, v: 1.0 },
      { u: 0.0, v: 1.0 },

      // Top face
      { u: 0.0, v: 0.0 },
      { u: 1.0, v: 0.0 },
      { u: 1.0, v: 1.0 },
      { u: 0.0, v: 1.0 },

      // Bottom face
      { u: 0.0, v: 0.0 },
      { u: 1.0, v: 0.0 },
      { u: 1.0, v: 1.0 },
      { u: 0.0, v: 1.0 },
    ],
    vertexColors: [
      // Front face - RGB cube colors based on position
      { r: 0.0, g: 0.0, b: 1.0 }, // -X, -Y, +Z = Blue
      { r: 1.0, g: 0.0, b: 1.0 }, // +X, -Y, +Z = Magenta
      { r: 1.0, g: 1.0, b: 1.0 }, // +X, +Y, +Z = White
      { r: 0.0, g: 1.0, b: 1.0 }, // -X, +Y, +Z = Cyan

      // Right face
      { r: 1.0, g: 0.0, b: 1.0 }, // +X, -Y, +Z = Magenta
      { r: 1.0, g: 0.0, b: 0.0 }, // +X, -Y, -Z = Red
      { r: 1.0, g: 1.0, b: 0.0 }, // +X, +Y, -Z = Yellow
      { r: 1.0, g: 1.0, b: 1.0 }, // +X, +Y, +Z = White

      // Back face
      { r: 1.0, g: 0.0, b: 0.0 }, // +X, -Y, -Z = Red
      { r: 0.0, g: 0.0, b: 0.0 }, // -X, -Y, -Z = Black
      { r: 0.0, g: 1.0, b: 0.0 }, // -X, +Y, -Z = Green
      { r: 1.0, g: 1.0, b: 0.0 }, // +X, +Y, -Z = Yellow

      // Left face
      { r: 0.0, g: 0.0, b: 0.0 }, // -X, -Y, -Z = Black
      { r: 0.0, g: 0.0, b: 1.0 }, // -X, -Y, +Z = Blue
      { r: 0.0, g: 1.0, b: 1.0 }, // -X, +Y, +Z = Cyan
      { r: 0.0, g: 1.0, b: 0.0 }, // -X, +Y, -Z = Green

      // Top face
      { r: 0.0, g: 1.0, b: 1.0 }, // -X, +Y, +Z = Cyan
      { r: 1.0, g: 1.0, b: 1.0 }, // +X, +Y, +Z = White
      { r: 1.0, g: 1.0, b: 0.0 }, // +X, +Y, -Z = Yellow
      { r: 0.0, g: 1.0, b: 0.0 }, // -X, +Y, -Z = Green

      // Bottom face
      { r: 0.0, g: 0.0, b: 0.0 }, // -X, -Y, -Z = Black
      { r: 1.0, g: 0.0, b: 0.0 }, // +X, -Y, -Z = Red
      { r: 1.0, g: 0.0, b: 1.0 }, // +X, -Y, +Z = Magenta
      { r: 0.0, g: 0.0, b: 1.0 }, // -X, -Y, +Z = Blue
    ],
  }],
};

// Initialize the WebGL engine
// const engine = new WebGLEngine('webgl-canvas');
const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
const runtime = new Runtime(canvas);

await runtime.loadCartridge(cartridge);
runtime.run();

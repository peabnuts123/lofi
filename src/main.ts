import { ObjLoader } from '@polyzone/engine/loaders';

import { Runtime, type CartridgeDefinition } from './runtime';
import { DebugModule } from './util/DebugModule';
import { WebFileSystem } from './engine/filesystem/WebFileSystem';
import type { MeshGeometryDefinition } from './engine/models';
import { ShaderBlendingMode } from './engine/materials';

import './style.css';

DebugModule.register();

const WHITE = { r: 0xFF, g: 0xFF, b: 0xFF };

const filesystem = new WebFileSystem();
const burgerModel = await ObjLoader.loadModel('/models/burgerCheese.obj', filesystem);
const dumpsterModel = await ObjLoader.loadModel('/models/detailDumpster_closed.obj', filesystem);
const cartridge: CartridgeDefinition = {
  models: [
    /* 00 - Ground */
    {
      subMeshes: [
        {
          geometry: cubeGeometry(),
          material: {
            name: 'default',
            diffuseTexturePath: '/textures/stones.png',
          },
        },
      ],
    },
    /* 01 - Real model */
    burgerModel,
    /* 02 - Blending mode: Average */
    {
      subMeshes: [
        {
          geometry: cubeGeometry(),
          material: {
            name: 'blending_average',
            diffuseTexturePath: '/textures/stones.png',
            blendingMode: ShaderBlendingMode.Average,
            diffuseColor: { r: 0xFF, g: 0xFF, b: 0xFF, a: 0 },
          },
        },
      ],
    },
    /* 03 - Blending mode: Additive */
    {
      subMeshes: [
        {
          geometry: cubeGeometry(),
          material: {
            name: 'blending_additive',
            diffuseTexturePath: '/textures/stones.png',
            blendingMode: ShaderBlendingMode.Additive,
            diffuseColor: { r: 0x00, g: 0xFF, b: 0x00, a: 0 },
            unlit: true,
          },
        },
      ],
    },
    /* 04 - Blending mode: Subtractive */
    {
      subMeshes: [
        {
          geometry: cubeGeometry(),
          material: {
            name: 'blending_subtractive',
            diffuseTexturePath: '/textures/stones.png',
            blendingMode: ShaderBlendingMode.Subtractive,
            diffuseColor: { r: 0x80, g: 0x80, b: 0x80, a: 0 },
            unlit: true,
          },
        },
      ],
    },
    /* 05 - Blending mode: SourceAlpha */
    {
      subMeshes: [
        {
          geometry: cubeGeometry(),
          material: {
            name: 'blending_sourceAlpha',
            diffuseTexturePath: '/textures/bars.png',
            blendingMode: ShaderBlendingMode.SourceAlpha,
          },
        },
      ],
    },
    /* 06 - Dumpster model */
    dumpsterModel,
  ],
};

const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
// @TODO delete runtime, inline here
const runtime = new Runtime();
await runtime.loadCartridge(canvas, cartridge);
runtime.run();

function cubeGeometry(): MeshGeometryDefinition {
  return {
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
    triangles: [
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
    // eslint-disable-next-line no-constant-condition
    vertexColors: /* RGBCube? */false ? [
      // Front face - RGB cube colors based on position
      { r: 0x00, g: 0x00, b: 0xFF }, // -X, -Y, +Z = Blue
      { r: 0xFF, g: 0x00, b: 0xFF }, // +X, -Y, +Z = Magenta
      { r: 0xFF, g: 0xFF, b: 0xFF }, // +X, +Y, +Z = White
      { r: 0x00, g: 0xFF, b: 0xFF }, // -X, +Y, +Z = Cyan

      // Right face
      { r: 0xFF, g: 0x00, b: 0xFF }, // +X, -Y, +Z = Magenta
      { r: 0xFF, g: 0x00, b: 0x00 }, // +X, -Y, -Z = Red
      { r: 0xFF, g: 0xFF, b: 0x00 }, // +X, +Y, -Z = Yellow
      { r: 0xFF, g: 0xFF, b: 0xFF }, // +X, +Y, +Z = White

      // Back face
      { r: 0xFF, g: 0x00, b: 0x00 }, // +X, -Y, -Z = Red
      { r: 0x00, g: 0x00, b: 0x00 }, // -X, -Y, -Z = Black
      { r: 0x00, g: 0xFF, b: 0x00 }, // -X, +Y, -Z = Green
      { r: 0xFF, g: 0xFF, b: 0x00 }, // +X, +Y, -Z = Yellow

      // Left face
      { r: 0x00, g: 0x00, b: 0x00 }, // -X, -Y, -Z = Black
      { r: 0x00, g: 0x00, b: 0xFF }, // -X, -Y, +Z = Blue
      { r: 0x00, g: 0xFF, b: 0xFF }, // -X, +Y, +Z = Cyan
      { r: 0x00, g: 0xFF, b: 0x00 }, // -X, +Y, -Z = Green

      // Top face
      { r: 0x00, g: 0xFF, b: 0xFF }, // -X, +Y, +Z = Cyan
      { r: 0xFF, g: 0xFF, b: 0xFF }, // +X, +Y, +Z = White
      { r: 0xFF, g: 0xFF, b: 0x00 }, // +X, +Y, -Z = Yellow
      { r: 0x00, g: 0xFF, b: 0x00 }, // -X, +Y, -Z = Green

      // Bottom face
      { r: 0x00, g: 0x00, b: 0x00 }, // -X, -Y, -Z = Black
      { r: 0xFF, g: 0x00, b: 0x00 }, // +X, -Y, -Z = Red
      { r: 0xFF, g: 0x00, b: 0xFF }, // +X, -Y, +Z = Magenta
      { r: 0x00, g: 0x00, b: 0xFF }, // -X, -Y, +Z = Blue
    ] : [
      WHITE, WHITE, WHITE, WHITE,
      WHITE, WHITE, WHITE, WHITE,
      WHITE, WHITE, WHITE, WHITE,
      WHITE, WHITE, WHITE, WHITE,
      WHITE, WHITE, WHITE, WHITE,
      WHITE, WHITE, WHITE, WHITE,
    ],
    vertexNormals: [
      // Front face (pointing towards +Z)
      { x: 0.0, y: 0.0, z: 1.0 },
      { x: 0.0, y: 0.0, z: 1.0 },
      { x: 0.0, y: 0.0, z: 1.0 },
      { x: 0.0, y: 0.0, z: 1.0 },

      // Right face (pointing towards +X)
      { x: 1.0, y: 0.0, z: 0.0 },
      { x: 1.0, y: 0.0, z: 0.0 },
      { x: 1.0, y: 0.0, z: 0.0 },
      { x: 1.0, y: 0.0, z: 0.0 },

      // Back face (pointing towards -Z)
      { x: 0.0, y: 0.0, z: -1.0 },
      { x: 0.0, y: 0.0, z: -1.0 },
      { x: 0.0, y: 0.0, z: -1.0 },
      { x: 0.0, y: 0.0, z: -1.0 },

      // Left face (pointing towards -X)
      { x: -1.0, y: 0.0, z: 0.0 },
      { x: -1.0, y: 0.0, z: 0.0 },
      { x: -1.0, y: 0.0, z: 0.0 },
      { x: -1.0, y: 0.0, z: 0.0 },

      // Top face (pointing towards +Y)
      { x: 0.0, y: 1.0, z: 0.0 },
      { x: 0.0, y: 1.0, z: 0.0 },
      { x: 0.0, y: 1.0, z: 0.0 },
      { x: 0.0, y: 1.0, z: 0.0 },

      // Bottom face (pointing towards -Y)
      { x: 0.0, y: -1.0, z: 0.0 },
      { x: 0.0, y: -1.0, z: 0.0 },
      { x: 0.0, y: -1.0, z: 0.0 },
      { x: 0.0, y: -1.0, z: 0.0 },
    ],
  };
}

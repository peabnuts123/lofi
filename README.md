# LoPoly
> _lofi game engine to relax/study to._

LoPoly is a simple 3D WebGL game engine for making games from the year 2000.

## Design philosophy

### Constrained
LoPoly's capabilities are influenced by early 3D consoles such as the PS1 and the N64. This makes it quite limited compared to modern game engines. These constraints benefit in a few ways:

1. The engine is simple - it lacks the complexity of modern game engines.
2. It's easy to achieve an authentic retro style, without having to fight the engine.

### Simple
LoPoly is a code-first engine which means you create games entirely by writing code. The API is very small and straightforward, so it's simple to get things up and running.

The API has a fixed-function design based on features typically found in older games. Common features are preferred to be built-in to the engine rather than requiring every developer recreate them individually.

### Web
LoPoly is built using WebGL, so it only targets the web. This makes games easy to make, play, and share. LoPoly is designed for indies, hobbyists, and tinkerers to make weird and wonderful things.

### Free
LoPoly is free and open-source, with an [MIT License](./LICENSE) so that anybody can use it. You are more than welcome to make commercial projects using LoPoly.


## Installation

Install the package `@lopoly/engine` using your favourite package manager:

```
npm install @lopoly/engine
```

## Documentation

See [the engine project](./src/engine/README.md) for full documentation on how to build things with LoPoly.

There are also several [examples](./examples/README.md) of small games in this repository.

### Basic usage

```html
<!-- index.html -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Game</title>
</head>
<body>
  <canvas id="game" width="640" height="480" style="image-rendering: pixelated">
  <script src="index.ts"></script>
</body>
</html>
```

```typescript
// index.ts
import { Color3, Vector3 } from '@lopoly/core/math';
import { Engine, WebFileSystem, GltfLoader, Model, Scene, CameraNode, DirectionalLightNode, ModelNode } from '@lopoly/engine';

// Create engine attached to canvas + virtual "file system"
const canvas = document.getElementById('game') as HTMLCanvasElement;
const fileSystem = new WebFileSystem();
const engine = new Engine(canvas, fileSystem);

// Scene + ambient lighting + clear colour
const scene = new Scene(engine);
scene.lighting.ambientColor = new Color3(0x20, 0x20, 0x20);
scene.clearColour = new Color3(0x10, 0x20, 0x50);

// Lighting - DirectionalLightNode or PointLightNode
const sun = new DirectionalLightNode(scene, 'sun', { color: Color3.white() });
sun.rotation.x = -90;

// Camera that points at 0,0,0
const camera = new CameraNode(scene, 'camera', 70, canvas.width / canvas.height);
camera.position = new Vector3(1, 1, 1);
camera.pointAt(Vector3.zero());

// Load + parse 3D model
const ratModelDefinition = await GltfLoader.loadModel('/models/rat.glb', fileSystem);
const ratModel = await Model.fromDefinition(engine, ratModelDefinition);

// Display 3D model
const rat = new ModelNode(scene, 'rat', ratModel);

// Start the engine + callback loop
engine.run((dt) => {
  // Rotate the model
  rat.rotation.z += dt * 25;
});
```
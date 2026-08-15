## Installation

Install the package `@lopoly/engine` using your favourite package manager:

```
npm install @lopoly/engine
```

## Documentation

### Concepts

LoPoly games are assembled from a small hierarchy of concepts:
  - [Engine](#engine) `(1)`
    - [Scene](#scene) `(0..*)`
      - [SceneNode](#scene-nodes) `(0..*)`
        - [SceneNode](#scene-nodes) `(0..*)`
          - ...

The Engine has many Scenes, each of which contain a hierarchy of many SceneNodes. If you have any experience with Godot, this should feel pretty familiar - except for the differentiation between scenes (levels / scenes) and scene nodes (the objects within a scene).

#### Engine

[Engine](#engine-1) is the top-level object. It contains all the logic for running the game, and is in charge of the run loop.

An engine is created from 2 things:
  - A `<canvas>` instance
  - An [IFileSystem](#ifilesystem) instance

The canvas is the HTMLCanvasElement that will be used to render the game. Style and position this element to display your game somewhere on the page. The canvas also dictates the resolution at which your game runs (through `width` and `height` HTML attributes).

The file system is an abstract interface that tells the engine how to access all the code and assets for your game. See [file systems](#file-systems) for more information.

#### File systems

[IFileSystem](#ifilesystem) is an abstract interface that lets LoPoly access the data for your game. For example, a default [WebFileSystem](#webfilesystem) is provided that lets LoPoly read resources from web urls (e.g. `/models/player.glb` reads from `https://foo.com/models/player.glb`).

This allows you to serve LoPoly games from different sources e.g. from a web domain, from memory, from [Tauri's file system plugin](https://v2.tauri.app/plugin/file-system/), etc.

#### Scene

A scene is best thought of as a "level" or "screen" within your game. Only one scene can be loaded at a time. A scene contains a hierarchy of [SceneNodes](#scene-nodes) which make up all the objects and behaviours for your game.

**Note** that in LoPoly - unlike Godot - scenes cannot contain other scenes.

#### Scene nodes

[SceneNode](#scenenode) is any node in the hierarchy within a scene. There are many types of scene node:
- [ModelNode](#modelnode)
- [CameraNode](#cameranode)
- [PointLightNode](#pointlightnode)
- [BoxColliderNode](#boxcollidernode)
- [AudioSourceNode](#audiosourcenode)
- etc.

Scene nodes have a [Transform](#transform) (i.e. position, rotation, scale) as well as children. Scene nodes inherit their parent's transform (e.g. moving the parent also moves the child).

When accessing a scene node's transform, you will note two versions of each property e.g.
  - `position`
  - `absolutePosition`

Both properties are mutable. The absolute property (e.g. `absolutePosition`) references the property irrespective of the hierarchy (e.g. the node's actual position within the scene), whereas the other property (e.g. `position`) references the property local to its parent (e.g. the node's position relative to its parent).

**Note** that, unlike Unity, nodes don't have "components" or any other attributes. Rather, "game objects" are composed of hierarchies of different nodes.

### Loading assets

All assets are loaded through the engine's [file system](#file-systems). Different types of assets are loaded through different classes.

#### Models

LoPoly supports loading the following 3D model formats:
  - [glTF](https://github.com/khronosgroup/gltf) (`.glb` or `.gltf` + external resources)
    - Use `GltfLoader.loadModel(path, fileSystem)`
  - [Wavefront OBJ](https://en.wikipedia.org/wiki/Wavefront_.obj_file)
    - Use `ObjLoader.loadModel(path, fileSystem)`

Loading a model reads the file format and returns a [ModelDefinition](#modeldefinition). A model definition is an in-memory representation of the geometry, animations and materials contained within a model asset.

A model definition cannot be used directly. It must first be loaded into a [Model](#model) using `Model.fromDefinition(engine, definition)`. This separation exists for a few reasons:
- Allow editing of a model definition before it is loaded (e.g. to add more capabilities, such as vertex colors)
- Allow selective sharing of model modifications and overrides between many [ModelNode](#modelnode) instances (e.g. loading a model twice to make "red" and "blue" versions)


Example of loading and displaying a 3D model asset:

```typescript
// Read file from file system
const playerModelDefinition = await GltfLoader.loadModel('/models/player.glb', fileSystem);
// Create model asset from definition
const playerModel = await Model.fromDefinition(engine, playerModelDefinition);
// Display model in the scene
const player = new ModelNode(scene, 'player', playerModel);
```

[Read more](#models-1) about using models in LoPoly.

#### Audio

Loading audio clips is simple:

```typescript
const playerJumpClip = await AudioClip.load(engine, '/audio/player_jump.wav');
```

Support for different formats is based on the user's browser. See [MDN's guide on audio codecs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs) or [caniuse](https://caniuse.com/?search=audio+format) for more information. You can generally expect support for common audio formats like:
- WAV
- MP3
- AAC (MP4)
- FLAC
- OGG
- Opus

Example of loading and playing an audio clip:

```typescript
// Load audio clip from file system
const playerJumpClip = await AudioClip.load(engine, '/audio/player_jump.wav');
// Create audio source in the scene
const audioSource = new AudioSourceNode(scene, 'player:audio');
// Play clip from audio source
audioSource.playClip(playerJumpClip);
```

[Read more](#audio-1) about playing audio in LoPoly.

#### Textures and Cubemaps

Textures can be loaded as follows:

```typescript
const playerRed = await Texture.load(engine, '/textures/player_red.png');
```

Cubemaps are a type of 3D texture used in reflections and skyboxes. Cubemaps can be loaded similarly:

```typescript
const skybox = await Cubemap.loadBoxNet(engine, '/textures/cubemaps/skybox.png');
```

Cubemaps require specific layouts in the source image asset (e.g. `boxNet`). See [Cubemap](#cubemap) for more details.

Support for different formats is based on the user's browser. See [MDN's guide on image formats](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types) for more information. You can generally expect support for common image formats like:
- JPEG
- PNG
- GIF
- WebP
- AVIF
- etc.

Example of loading and using a Texture and a Cubemap:

```typescript
// Load texture + cubemap
const playerRed = await Texture.load(engine, '/textures/player_red.png');
const skybox = await Cubemap.loadBoxNet(engine, '/textures/cubemaps/skybox.png');
// Use in a material override
playerModel.setMaterialOverride('player', new Material({
  diffuseTexture: playerRed,
  reflectionCubemap: skybox,
}));
```

[Read more](#materials) about using materials in LoPoly.

### Models

Models are the primary way of displaying 3D graphics. Models are loaded from assets in a file system (see documentation on [loading models](#models)).

```typescript
// Read file from file system
const playerModelDefinition = await GltfLoader.loadModel('/models/player.glb', fileSystem);
// Create model asset from definition
const playerModel = await Model.fromDefinition(engine, playerModelDefinition);
```

A [Model](#model) instance stores all the geometry, [materials](#materials), and [animations](#animations) of a 3D asset. Models are comprised of a hierarchy of [ModelPart](#modelpart) objects, which may be comprised of many [MeshPrimitive](#meshprimitive) objects.

```
Model -> (0..*) ModelPart -> (0..*) MeshPrimitive
```

Model parts can be transformed separately to create different poses and animations. Furthermore, a model part may also define a [skin](#meshskin) to deform its mesh primitives based on other model parts (e.g. to transform a character model based on "bones").

### Animations

> **NOTE:** Animation in LoPoly is currently in an early MVP state. All animations are looped, and stopping an animation does not reset the model back to any kind of rest pose. Its recommended for now that you implement an `idle` animation to play when the model should stop animating.

Animations are stored as a set of keyframes containing transform changes for model parts over time (e.g. `at 0.6 seconds, part 'arm.r' should have rotation '0, 0.1, 0.23, 0.8'`). Animations are loaded as part of a model, not as a separate asset.


You can play an animation on a [ModelNode](#modelnode) like so:

```typescript
// Create ModelNode instance
const player = new ModelNode(scene, 'player', playerModel);
// Play animation
player.playAnimation('idle');
```

#### Sharing animations

You can use the animations from one model to animate another (so-called "animation retargeting"), though no attempt is made to ensure the animations are appropriate for the target model. This is useful for e.g. sharing common animations with skeletons that have been designed for them.

```typescript
// Load a common 'animation rig' model containing many common animations (e.g. idle, run, jump, etc.)
const animationRig = await Model.fromDefinition(engine, animationRigDefinition);

// Create player model node - use animation rig as source for animations
const player = new ModelNode(scene, 'player', playerModel);
player.animationSource = animationRig;
player.playAnimation('run');
```

Animations target model parts by name, so the skeleton/hierarchy has to match between the source and target models.

### Materials

Individual [mesh primitives](#meshprimitive) are drawn using a single [Material](#material). Materials in LoPoly have a few simple properties:
- Diffuse color
  - A [Color4](#color4) "tint" applied to the mesh primitive
  - Multiplied with vertex color and diffuse texture
- Diffuse texture
  - A [Texture](#texture) to apply to the mesh primitive based on the vertices' texture coordinates
  - Multiplied with vertex color and diffuse color
- Blending mode
  - A [ShaderBlendingMode](#shaderblendingmode) specifying how each transparent pixel of the mesh primitive is written into the draw buffer. Since transparent materials are drawn after opaque materials, the blending mode specifies how the mesh primitive is "blended" with the data already in the draw buffer
  - **NOTE:** Opaque pixels ALWAYS overwrite the draw buffer (i.e. are NOT blended)
  - There are several blending modes:
    - **None**: All pixels are drawn directly to / overwrite the buffer (opaque)
    - **Average**: Transparent pixels are averaged with the contents of the draw buffer
    - **Additive**: Transparent pixels are added to the contents of the draw buffer
    - **Subtractive**: Transparent pixels are subtracted from the contents of the draw buffer
    - **AlphaBlend**: Transparent pixels are combined with the contents of the draw buffer based on the pixel's alpha value (i.e. 0x00 = Fully transparent, 0xFF = Fully opaque)
    - **AlphaClip**: Pixels either overwrite the draw buffer or are discarded based on whether their alpha value is above or below some threshold. NOTE that this makes `AlphaClip` an OPAQUE blending mode (see [ShaderBlendingMode](#shaderblendingmode) for more details)
- Unlit
  - Whether lighting should be ignored when drawing the mesh primitive
- Reflection cubemap
  - A [Cubemap](#cubemap) to render as a reflection on the surface of the mesh primitive
- Reflection cubemap intensity
  - How visible the reflection is, if specified
<!-- - @TODO Reflection blending mode -->

### Collision handling

LoPoly has a simple collision handling system that can detect and resolve collisions between a few types of shapes:
  - [Box](#boxcollidernode)
    - A box with x/y/z dimensions. Does not have to be axis-aligned.
  - [Convex mesh](#convexmeshcollidernode)
    - Any convex shape (specified via a [Model](#model)). A mesh is "convex" if any line passing through it can only intersect the shape once or, in other terms, any shape whose interior angles are all less than 180°

#### Collision groups

All colliders have a "collision group" which is a number between 0 (inclusive) and `CollisionSystem.MaxCollisionGroups` (exclusive - 32 by default). Collision groups are used to specify which colliders can interact. For example, if the player, monsters, and platforms all have different collision groups, one could specify that players can jump on platforms, but monsters cannot.

Configuring the interactions between collision groups is done through the [CollisionSystem](#collisionsystem) object on `IEngine.collisionSystem`:

```typescript
const { collisionSystem } = engine;
// Specify that collision groups 0 and 1 cannot interact
collisionSystem.setInteraction(0, 1, false);

// Check whether two groups can interact
collisionSystem.canInteract(0, 1); // Returns `false`
```

#### Using colliders

Colliders are scene nodes just like anything else. Constructing them is simple:

```typescript
const playerCollisionGroup = 0;
const playerCollider = new BoxColliderNode(scene, 'player:collider', playerCollisionGroup, { x: 30, y: 30, z: 70 });
```

Colliders have a function called `move` that can compute a movement and apply it to a target. For example:

```typescript
// Create player object
const player = new ModelNode(scene, 'player', playerModel);
// Create collider as child of player
const playerCollider = new BoxColliderNode(scene, 'player:collider', 0, { x: 30, y: 30, z: 70 }, player);
// Compute the movement (0, 5, 0) and apply the result to `player`
playerCollider.move(player, new Vector3(0, 5, 0));
```

When calling `move(target, vector)`, the collider attempts to move by `vector`, resolving any collisions that may occur as a result of this movement, and then applies this result to `target`. Collisions are resolved using a "minimum translation vector" which produces a "sliding" effect when colliders intersect. You can also call `computeMove(vector)` which just does the calculation and returns the result, without applying it to anything.

### Audio

LoPoly features a simple but robust system for playing audio. There are three main components:
  - The [AudioSystem](#audiosystem) itself (a singleton stored on Engine)
  - [Audio clips](#audioclip) - individual sounds
  - [AudioSourceNode](#audiosourcenode) instances - scene nodes used to play audio

Audio clips are assets loaded from a file system and played through audio source nodes:

```typescript
// Load audio clip
const playerJumpSound = await AudioClip.load(engine, '/audio/player/jump.wav');
// Create source node
const playerAudioSource = new AudioSourceNode(scene, 'player:audio', player);

// ... (later, in the game loop)
if (inputSystem.wasButtonPressed('jump')) {
  playerAudioSource.playClip(playerJumpSound);
}
```

All audio source nodes are 3D by default and will pan audio left/right based on the their direction from the camera. Playing audio is also attenuated based on distance. You can set min and max ranges to control how volume fades out over distance:

```typescript
// Any audio closer than 10 units will play at max volume
playerAudioSource.minRange = 10;
// Audio will fade out to 0% volume by this distance
playerAudioSource.maxRange = 50;
```

Audio source nodes can also be configured to be "global" - playing all audio at the same volume everywhere - by setting the `global` property:
<!-- You can disable this behaviour on an individual audio source node which will play sound at the same volume everywhere (useful for e.g. background music): -->

```typescript
const musicSource = new AudioSourceNode(scene, 'music');
musicSource.global = true;
```

This is useful for e.g. background music.

#### Audio channels and priority

The audio system has a finite number of audio "channels" (24 by default). A vacant audio channel is required to play an audio clip. If no channels are free, the requested audio clip must either be dropped or replace a playing clip. A playing clip will be replaced if its priority is **less than or equal to** that of the requested audio clip. The playing clip with the lowest priority will be replaced, or the clip that has been playing the longest if there is a tie. If the requested audio clip has a lower priority than every playing clip, it will be dropped and not played. An audio channel becomes free as soon as a playing clip stops.

Audio clips are played with a priority of `0` by default. You can specify the priority of an audio clip when it is played (negative priorities are allowed):
```typescript
playerAudioSource.playClip(playerJumpSound, { priority: 2 });
```

The number of audio channels can be customised in the [Engine](#engine-1) constructor configuration:
```typescript
// Set the number of audio channels to 40 (default: 24)
const engine = new Engine(canvas, fileSystem, {
  audio: {
    numChannels: 40,
  }
});
```

#### Controlling audio speed / pitch

> **Note:** Currently speed and pitch are tied together. Playing a clip at a faster speed will play it at a higher pitch. In the future, these two properties will ideally be decoupled. This is a [limitation of the default functionality in the Web Audio API](https://github.com/WebAudio/web-audio-api/issues/2487). This can be worked around, but it requires implementing custom audio processing.

Audio clips can be played at different speeds / pitches:
```typescript
// Play at 200% speed
playerAudioSource.playClip(playerJumpSound, { speed: 2 });
```

You can also specify a speed range to randomly pick a speed in the interval `[speed - speedRange, speed + speedRange)`:

```typescript
// Play clip between 150% (inclusive) and 200% (exclusive) speed
playerAudioSource.playClip(playerWalkSound, { speed: 2, speedRange: 0.5 });
```

This is useful for making audio clips sound less repetitive (e.g. footsteps, gun shots, etc).


### Input handling

LoPoly supports many forms of input including gamepads, keyboard, and pointer devices (e.g. mouse, or touch input).

#### Inputs and Input Bindings

The input system is based around the concept of _Inputs_ which are labels given to controls in your game (e.g. `jump`, `player:x`, `back`, etc). An input can be defined as either a `button` or an `axis` type. Buttons are discrete inputs that are either on or off, and axes are continuous inputs that can be polled for their current value. A typical example of a button type input would be a pause button that opens the menu, and a typical example of an axis type input would be the horizontal component of the player's movement.

Inputs can't do anything without _Input Bindings_ which tie inputs to the controls on a physical device such as `KeyCode.KeyW`, `GamepadAxis.JoyRightX` or `MouseButton.Left`.

Even though input bindings tend to function naturally as either a button or an axis, any input binding can be used for either type. Analog bindings can be bound to a button input (e.g. using an analog gamepad trigger like a button), and a pair of buttons can be bound to an axis input (e.g. using the arrow keys on a keyboard like a movement axis).

#### Configuring inputs

Inputs and input bindings can be configured all at once by calling `InputSystem.configure()`:

```typescript
const { inputSystem: input } = engine;

input.configure({
  buttons: [
    {
      name: 'player:jump',
      bindings: [
        KeyCode.Space,
        GamepadButton.South,
      ],
    },
    // ...
  ],
  axes: [
    {
      name: 'player:x',
      bindings: [
        { min: KeyCode.KeyA, max: KeyCode.KeyD },
        GamepadAxis.JoyLeftX,
      ],
    },
    {
      name: 'player:y',
      bindings: [
        { min: KeyCode.KeyS, max: KeyCode.KeyW },
        GamepadAxis.JoyLeftY,
      ],
    },
    // ...
  ],
});
```

Inputs and input bindings can be updated at any time:

```typescript
// Add a new input
input.addInput({
  type: 'button',
  name: 'player:shoot',
  bindings: [MouseButton.Left, GamepadButton.R2],
});
// Remove an input
input.removeInput('button', 'menu:accept');

// Add a set of input bindings to an input
input.addInputBinding({
  type: 'button',
  name: 'player:boost',
  bindings: [GamepadButton.South],
});
// Remove a set of input bindings from an input
input.removeInputBinding({
  type: 'button',
  name: 'player:shoot',
  bindings: [GamepadButton.R2],
});
```

Calling these methods updates the current input config, whereas calling `InputSystem.configure()` replaces it.

The following inputs are configured by default:

| Type | Name | Bindings |
| ---- | ---- | -------- |
| Button | `jump` | `KeyCode.Space` <br> `GamepadButton.South` |
| Button | `action` | `KeyCode.KeyF` <br> `GamepadButton.West` |
| Axis | `player:x` | `GamepadAxis.JoyLeftX` <br> `[KeyCode.KeyA, KeyCode.KeyD]` <br> `[KeyCode.ArrowLeft, KeyCode.ArrowRight]` |
| Axis | `player:y` | `GamepadAxis.JoyLeftY` <br> `[KeyCode.KeyS, KeyCode.KeyW]` <br> `[KeyCode.ArrowDown, KeyCode.ArrowUp]` |

#### Input devices

The following types of input device are supported:

**Keyboard**
- Input bindings are specified using {@link input.KeyCode KeyCode}.
- Only 1 keyboard input is supported at a time.

**Gamepad**
- Input bindings are specified using {@link input.GamepadButton GamepadButton} or {@link input.GamepadAxis GamepadAxis}.
- Multiple gamepads are supported at a time. See [Multiple players](#multiple-players).
- Any device that is detected by browsers as a [Standard Gamepad](https://w3c.github.io/gamepad/#dfn-standard-gamepad) is supported. This should include any modern gaming console controller.

**Pointer (mouse and touch)**
- Input bindings are specified using {@link input.MouseButton MouseButton}.
- Touch inputs are registered as `MouseButton.Left`.
- For simplicity, the Pointer device can only be assigned to a player in tandem with the keyboard device. A player cannot be assigned gamepad + pointer. See [Multiple players](#multiple-players).

#### Button inputs

Button type inputs are discrete - they're either pressed or not pressed. To check the state of a button you can call {@link input.IInputSystem.isButtonDown isButtonDown()}:

```typescript
const isPressingJump = input.isButtonDown('player:jump');
```

Often times, however, you want to perform some logic when the state of a button _changes_. To support this, LoPoly exposes the following functions:

```typescript
const wasJumpPressed = input.wasButtonPressed('player:jump');
const wasJumpReleased = input.wasButtonReleased('player:jump');
```

These functions return `true` only on the frame that the input was pressed / released.

If you want to use the value of a button in an equation (e.g. to multiply the speed of something by the value of a button), you can call {@link input.IInputSystem.getButtonValue getButtonValue()}:

```typescript
// Note: An Axis type input would be better suited for this specific scenario
const speedLeft = input.getButtonValue('player:move.left');
const speedRight = input.getButtonValue('player:move.right');
player.position.x += (speedRight - speedLeft) * PlayerSpeed;
```

{@link input.IInputSystem.getButtonValue getButtonValue()} returns `1` if the button is pressed, or `0` otherwise.

Button inputs can be defined as follows:

```typescript
input.addInput({
  name: 'player:jump',
  type: 'button',
  bindings: [
    // Discrete inputs
    KeyCode.Space,
    GamepadButton.South,
    // Analog input configured as a button (i.e. Pressing "up" on the left joystick)
    {
      axis: GamepadAxis.JoyLeftY,
      direction: 'positive',
    },
  ],
});
```

When using an analog input binding as a button, the threshold for determining whether an axis is "pressed" is based on {@link input.IInputSystem.analogButtonPressedThreshold InputSystem.analogButtonPressedThreshold}, which can be configured:

```typescript
// Default value is 0.2
input.analogButtonPressedThreshold = 0.1;
```

#### Axis inputs

Axis type inputs are continuous - they are represented by a value between `-1` and `1`. To get the value of an axis you can call {@link input.IInputSystem.getAxisValue getAxisValue()}:

```typescript
const playerXInput = input.getAxisValue('player:x');
player.position.x += playerXInput
```

Axis inputs can be defined as follows:

```typescript
input.addInput({
  name: 'player:x',
  type: 'axis',
  bindings: [
    // Analog input
    GamepadAxis.JoyLeftX,
    // Discrete inputs configured as an axis
    {
      min: KeyCode.KeyA, max: KeyCode.KeyD,
    },
  ],
});
```

When using discrete input bindings as an axis, pressing `min` will return `-1`, pressing `max` will return `1`, and pressing both (or neither) will return `0`.

Axis inputs have a configurable "deadzone" wherein their value will be rounded to `0` if the absolute value of the axis is less than the deadzone threshold. This can be configured:

```typescript
// Default value is 0.1
input.axisDeadZone = 0.2;
```

#### Pointer input

LoPoly supports reading input from a pointer device (e.g. mouse or touch input). This is a secondary type of input that represents a position on the screen. You can read the pointer input state by calling {@link input.IInputSystem.getPointer getPointer()}:

```typescript
const pointerState = input.getPointer();
```

{@link input.IInputSystem.getPointer getPointer()} returns a {@link input.PointerState PointerState} object which has properties like {@link input.PointerState.x x} and {@link input.PointerState.y y} specifying the pointer's position on the screen in pixels. The pointer state also has delta properties {@link input.PointerState.xDelta xDelta} and {@link input.PointerState.yDelta yDelta} which represent how many pixels the pointer has moved since the previous frame. Pointer coordinates are relative to the top-left of the game canvas.

The pointer can also be "locked" which hides the cursor (if present) and prevents it from leaving the game canvas area. This is usually used for e.g. controlling a camera, where having a physical cursor on the screen is not desirable.

```typescript
// Lock the pointer
input.lockPointer();

// Release pointer lock
input.releasePointer();
```

Locking the pointer often requires some input from the user so it might not lock immediately on calling `lockPointer()`. In this scenario it will be locked as soon as the player performs a pointer interaction (usually clicking on the game canvas).

#### Multiple players

LoPoly supports assigning different input devices to different players for creating multiplayer games. By default, all input devices are assigned to player 0 - the default player that is read when calling input methods like {@link input.IInputSystem.wasButtonPressed wasButtonPressed()}.

A specific input device can be assigned to a player by calling {@link input.IInputSystem.assignInputDeviceToPlayer assignInputDeviceToPlayer()}:

```typescript
// Assign keyboard+mouse input device to player 2 (which has player index 1)
input.assignInputDeviceToPlayer(1, KeyboardAndMouseDeviceId);
```

Assigning the Keyboard & Mouse input device is straightforward since there can only be 1 of these "devices" connected. However, assigning a gamepad requires a gamepad index parameter:

```typescript
// Assign gamepad with index 2 to player 1
input.assignInputDeviceToPlayer(0, gamepadIndexToDeviceId(2));
```

This gamepad index parameter is generally an arbitrary number with no bearing on the device to which it relates. To make it easier for developers to build user interfaces that map physical devices to input device IDs, LoPoly exposes a function called {@link input.IInputSystem.listenForDevices listenForDevices()}:

```typescript
// Start listening for input from all devices
input.listenForDevices((inputDeviceId) => {
  // ...
});
```

While this function is "active", it's called every time any input is pressed on any device. The parameter is the input device ID on which the input was pressed. This can be used to assign input devices to players:

```typescript
let currentPlayer = 0;
input.listenForDevices((inputDeviceId) => {
  const player = currentPlayer++;
  // Assign input device to player X
  input.assignInputDeviceToPlayer(player, inputDeviceId);

  // (Example) Show on the UI that player X was assigned device Y (e.g. keyboard / gamepad)
  ui.setPlayerDevice(player, inputDeviceId.type);

  // Stop listening once all players have been assigned
  if (currentPlayer >= MaxPlayers) {
    input.stopListeningForDevices();
  }
});
```

If you are familiar with Nintendo Switch, this allows you to build a system very similar to their player-assigning screen. This is the preferred way to assign input devices since it is more natural for players and easier to code (requiring no reference to specific input device IDs).

Once all players have been assigned input devices, you can stop listening for inputs with {@link input.IInputSystem.stopListeningForDevices stopListeningForDevices()}:

```typescript
input.stopListeningForDevices();
```

@TODO Change all references to these bad boys to docs references
## API Reference

### Engine
### Scene
### Transform
### IFileSystem
### WebFileSystem

### SceneNode
### CameraNode
### ModelNode
### PointLightNode
### DirectionalLightNode
### BoxColliderNode
### ConvexMeshColliderNode
### AudioSourceNode
### ObjectNode

### ModelDefinition

### Model
### ModelPart
### MeshSkin
### MeshPrimitiveCache
### MeshPrimitive
### Animation
### AnimationChannel
### Texture
### Cubemap
@TODO Boxnet, separate layouts
### Material
### ShaderBlendingMode

### Color3
### Color4
### Vector3
### Vector2
### EulerVector3
### Quaternion
### Matrix3
### Matrix4
### Transform
### Rotation

### AudioClip

### AudioSystem
### CollisionSystem
### ? other systems

## @TODO
- Computed properties?
- Debug.___
- Coordinate system: RH, Z-Up
- Ensure everthing in EngineConfig is referenced somewhere
- Using run callback + overriding onUpdate
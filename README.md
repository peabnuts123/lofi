# LoFi
> _lofi game engine to relax/study to._

LoFi is a 3D game engine built using WebGL with only simple/retro features which makes it very simple to use.

## Installation

Work in progress. LoFi is not published to npm yet, but it will be soon.

## Milestone: 0.1
  - [x] ~~Transform hierarchy~~
  - [x] ~~`Rotation` as a type that deals with quaternions OR euler angles?~~
  - [x] ~~Rotation vectors wrap somehow~~
  - [x] ~~Interface for colors is 0xFF, shader receives [0..1] (use `normalized` prop in gl calls)~~
  - [x] ~~Transparency in rendering~~
  - [x] ~~Collision handling~~
  - [x] ~~Core maths: Vector, Quaternion~~
    - [x] ~~Replace as much gl-matrix logic with this as possible, ideally all of it~~
  - [x] ~~Picking / ray casting~~
    - [ ] Move ray casting into Scene or something
  - [x] ~~3D Animation including bones~~

    - [x] ~~Rename a bunch of model stuff (such as? oh, like `MeshNode` and `SubMesh`)~~
  - [x] ~~Turning on Test objects now produces a performance problem! (at least with wireframe enabled / ray casting)~~
  - [x] ~~DrawDebug - what's the future here?~~
  - [x] ~~? POSSIBLE BUG?: `addChild` recomputes transforms. What happens to transitive children e.g. `c.addChild(b); a.addChild(b);` - Does C update correctly?~~
  - [x] ~~Sound and audio (PoC)~~
  - [x] ~~Basic Input system~~
  - [x] ~~Materials can be reused~~
  - [ ] POC for gizmos
    - [x] ~~Some way to render on a different "layer" (not to mention, UI?)~~
    - [ ] Calculate bounding box of node/hierarchy
  - [x] ~~Remaining material properties needed by PolyZone~~
    - [x] ~~Reflection~~
  - [x] ~~Directional light~~
  - [ ] Lights have range or intensity or colour or something.
  - [ ] Config for Clear color on scene, or camera?
  - [ ] Move AABB + others into `util/maths` or something
  - [x] ~~Redo ObjLoader~~
  - [x] ~~Configurable number of max lights (not DYNAMIC but CONFIGURABLE)~~
  - [x] ~~Remove old shaders~~
  - [ ] Fix DebugModule
  - [ ] Build pipeline and CD
  - [ ] Split up combined files
    - [ ] vector.ts
    - [ ] observable.ts
    - [ ] ____Geometry
  - [ ] MATH API REFACTOR: Flip the order of math operators (e.g. `Matrix4.transform(Vector3)` instead of `Vector3.multiplySelf(Matrix4)`)

## Milestone: 0.2
  - [ ] Collision handling for concave geometry e.g. levels
  - [ ] Ability to reset / stop animation
    - [ ] Config e.g. animation looping
  - [ ] At least write down what tests need to be written
  - [ ] Implement CUBICSPLINE animation
  - [ ] Allow camera to look straight down with pointAt()

## Backlog
These items are roughly in priority order.

  - [ ] Fog / culling
  - [ ] Light falloff
  - [ ] Alpha channel in vertex colors
  - [ ] Configuration options
    - [ ] Anti-aliasing
    - [ ] Texture filtering
  - [ ] Changing of scenes
  - [ ] Skyboxes
  - [ ] Custom shaders
  - [ ] Animated textures

### Not yet prioritised
  - Test all Model properties e.g. VertexColors
  - Lighting UBO can probably use an array lol
  - redundantly calling `gl.bindBuffer` immediately after `createBuffer()`
  - `DrawDebug.drawWireframe()` should probably be replaced with a shader / material option. For example, joint weights are ignored.
  - Materials should be able to be overrides instead of replacements
  - Storing `transform.position` gets a reference instead of a copy. Is that chill?
  - Some kind of generic "muted" button that people can include automatically
  - Camera should infer its aspect ratio, it shouldn't be a param
  - Think about gamma vs linear colour encoding (e.g. doing maths with Color3 vs displaying Color3)
  - Finish off comments in `observable.ts`
  - Redo test for Rotation
  - Write tests for Transform, Vector, Quaternion, Observable/Computed
  - Implement cubic spline interpolation in animation
  - Gamepad vibration
  - Custom mappings for non-standard controllers
  - Some kind of engine-native "Pause" functionality?
  - Pointerlock: support for disable mouse acceleration
  - Split screen multiplayer / multiple activate cameras (gl.viewport, gl.scissor)
  - Support for 2 players 1 keyboard (etc) (basically just assign the same device to multiple players)
  - Callbacks for input devices disconnecting / connecting (what do we care about?)
  - Virtual input devices (on screen)
  - [ ] `Matrix3` observable
  - [ ] `Vector2` tests
  - Still a bunch of stuff @TODO left in GltfLoader
  - Dreaded ArrayBuffer / Uint8Array refactor / audit. WHAT IS THE CORRECT THING
  - Do not import GLTF stuff outside GltfLoader
  - Make examples reference npm instead of local package aliases
  - BUG: Shader blending modes (or just Subtractive?) not quite interacting properly with non-transparent stuff. Subtractive = black.
  - BUG: Holding arrow keys still scrolls the page
  - Overhaul / tidy up Recording
    - Dump raw WAV audio even if it's silent. Webm is screwing me.
  - [ ] Fix errors introduced by `exactOptionalPropertyTypes` / make the project compile
  - Trigger type colliders
  - Ability to change scene
  - Have opinions about what file types are supported (e.g. only png/jpeg/etc). Look at file extension e.g. for model texture file dependencies, or maybe even header bytes for known MIME types.
  - Ability to ignore certain results when ray casting the scene (? if that API even got built)
  - Replace `new Matrix4` with `Matrix4.identity()`
  - Generate missing normals in the model loaders (instead of in the mesh primitive geometry)
  - If an Observable (e.g. Vector3) drops out of scope, can it be garbage collected? Or is it captured by the closure of the function that called `.onChange()`?
  - I think we need to use finalizers to clean up held GL resources (e.g. vao in MeshPrimitive, buffers in MeshPrim geometry, etc.)
  - MeshPrimitive geometry: We should be more careful about skin joints/weights being handled separately. For example, if one is set but not the other, the code will not handle it correctly. We should maybe collapse these types into a single type that's either set or not.
  - Make sure all tmp values are called `tmp_<thing>_<purpose>` and are static where possible


## Ideas
  - Built-in 3d primitives e.g. cube, sphere, etc.
  - Lights based on camera proximity (or is this a PolyZone feature?)
  - A second param for `addChild()` that lets you mutate the child, or a factory function?
    - Or a `parent` param for Node constructors for implicit local coordinates
    - Or `addChild()` returns the param for fluent-style adding
  - Memoize / cache values like `getVerticesWorldSpace`
    - ~~Some kind of generic pattern for Dirty____?~~ observables.
    - Should be more possible now that we have observables.
    - Or potentially a specific worldMatrix-based cache

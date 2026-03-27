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
    - [ ] Ability to reset / stop animation
    - [ ] Config e.g. animation looping
    - [ ] Rename a bunch of model stuff (such as? oh, like `MeshNode` and `SubMesh`)
  - [x] ~~Turning on Test objects now produces a performance problem! (at least with wireframe enabled / ray casting)~~
  - [x] ~~DrawDebug - what's the future here?~~
  - [ ] ? POSSIBLE BUG?: `addChild` recomputes transforms. What happens to transitive children e.g. `c.addChild(b); a.addChild(b);` - Does C update correctly?
  - [x] ~~Sound and audio (PoC)~~
  - [x] ~~Basic Input system~~
  - [x] ~~Materials can be reused~~
  - [ ] Fix errors introduced by `exactOptionalPropertyTypes` / make the project compile
  - [ ] POC for gizmos
    - [ ] Some way to render on a different "layer" (not to mention, UI?)
    - [ ] Calculate bounding box of node/hierarchy
  - [ ] Remaining material properties needed by PolyZone
    - [ ] Emission
    - [ ] Reflection
  - [ ] Directional light
  - [ ] Config for Clear color on scene, or camera?
  - [ ] Move AABB + others into `util/maths` or something
  - [ ] Redo ObjLoader
  - [ ] Configurable number of max lights
  - [ ] Remove old shaders
  - [ ] Fix DebugModule
  - [ ] Build pipeline and CD

## Milestone: 0.2
  - [ ] Collision handling for concave geometry e.g. levels

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
  - Tidy up and commit the coco scene
  - Virtual input devices (on screen)
  - [ ] `Color3` observable
  - [ ] `Vector2` tests

## Ideas
  - Built-in 3d primitives e.g. cube, sphere, etc.
  - Lights based on camera proximity (or is this a PolyZone feature?)
  - A second param for `addChild()` that lets you mutate the child, or a factory function?
    - Or a `parent` param for Node constructors for implicit local coordinates
    - Or `addChild()` returns the param for fluent-style adding
  - Memoize / cache values like `getVerticesWorldSpace`
    - Some kind of generic pattern for Dirty____?
    - Or potentially a specific worldMatrix-based cache

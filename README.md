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
  - [~] Picking / ray casting
  - [~] 3D Animation including bones
    - [ ] Ability to reset / stop animation
    - [ ] Config e.g. animation looping
  - [x] ~~Turning on Test objects now produces a performance problem! (at least with wireframe enabled / ray casting)~~
  - [ ] ? POSSIBLE BUG?: `addChild` recomputes transforms. What happens to transitive children e.g. `c.addChild(b); a.addChild(b);` - Does C update correctly?
  - [ ] Sound and audio (PoC)
  - [ ] Basic Input system
  - [~] Materials can be reused
  - [ ] Redo / remove wireframe API and wireframe drawing (use worldMatrix?) (draw a `Model`?)
  - [ ] POC for gizmos
    - [ ] Some way to render on a different "layer"
    - [ ] Calculate bounding box of node/hierarchy
  - [ ] Remaining material properties needed by PolyZone
    - [ ] Emission
    - [ ] Reflection
  - [ ] Directional light
  - [ ] Config for Clear color on scene, or camera?
  - [ ] Move AABB + others into `util/maths` or something
  - [ ] Build pipeline and CD

## Backlog
These items are roughly in priority order.

  - [ ] Collision handling for concave geometry e.g. levels
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
  - N/A

## Ideas
  - Built-in 3d primitives e.g. cube, sphere, etc.
  - Lights based on camera proximity (or is this a PolyZone feature?)
  - A second param for `addChild()` that lets you mutate the child, or a factory function?
    - Or a `parent` param for Node constructors for implicit local coordinates
    - Or `addChild()` returns the param for fluent-style adding
  - Memoize / cache values like `getVerticesWorldSpace`
    - Some kind of generic pattern for Dirty____?
    - Or potentially a specific worldMatrix-based cache

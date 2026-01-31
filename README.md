# LoFi
> _lofi game engine to relax/study to._

LoFi is a 3D game engine built using WebGL with only simple/retro features which makes it very simple to use.

## Installation

Work in progress. LoFi is not published to npm yet, but it will be soon.

## Backlog
These items are roughly in priority order.

  - [x] ~~Transform hierarchy~~
  - [x] ~~`Rotation` as a type that deals with quaternions OR euler angles?~~
  - [x] ~~Rotation vectors wrap somehow~~
  - [x] ~~Interface for colors is 0xFF, shader receives [0..1] (use `normalized` prop in gl calls)~~
  - [x] ~~Transparency in rendering~~
  - [x] ~~Collision handling~~
  - [ ] Picking / ray casting
  - [ ] 3D Animation including bones
  - [ ] Input system
  - [ ] Calculate bounding box of node/hierarchy
  - [ ] Sound and audio (PoC)
  - [ ] POC for gizmos
    - [ ] Some way to render on a different "layer"
  - [x] ~~Core maths: Vector, Quaternion~~
    - [x] ~~Replace as much gl-matrix logic with this as possible, ideally all of it~~
  - [ ] Remaining material properties needed by PolyZone
    - [ ] Emission
    - [ ] Reflection
  - [ ] Custom shaders
  - [ ] Config for Clear color on scene, or camera?
  - [ ] Directional light
  - [ ] Build pipeline and CD

### Not yet prioritised
  - Animated textures
  - Alpha channel in vertex colors
  - Configuration options
    - Anti-aliasing
    - Texture filtering
  - Light falloff
  - Fog / culling
  - Updates to material properties updates shaderprogram
  - Changing of scenes
  - Consider renaming "model" to "mesh"
  - How do we manipulate materials?
  - Should we use a #define to omit vertex colouring, texturing?
  - Skyboxes

## Ideas
  - Built-in 3d primitives e.g. cube, sphere, etc.
  - Lights based on camera proximity (or is this a PolyZone feature?)
  - A second param for `addChild()` that lets you mutate the child, or a factory function?
    - Or a `parent` param for Node constructors for implict local coordinates
    - Or `addChild()` returns the param for fluent-style adding
  - Autogenerate normals for meshes lacking them
  - Binary search for rendering order?

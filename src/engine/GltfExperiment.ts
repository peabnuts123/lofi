import { Accessor, WebIO, type GLTF, type TypedArray, Node, Document } from '@gltf-transform/core';
import type { IFileSystem } from '@polyzone/engine/filesystem';
import { canonicalisePath } from './util/path';
import type { IEngine } from './Engine';
import { createBuffer } from './util/createBuffer';

import VertexShaderSource from '@polyzone/engine/materials/shaders/newShader.vert?raw';
import FragmentShaderSource from '@polyzone/engine/materials/shaders/newShader.frag?raw';
import { CameraUboIndex } from './scene/nodes/CameraNode';
import { LightingUboIndex } from './scene/SceneLighting';
import { Color4 } from './util/Color4';
import { CannotInvertMatrixError, Matrix3 } from './util/Matrix3';
import { DrawableSceneNode, type DrawTask, type IScene } from './scene';
import { Matrix4 } from './util/Matrix4';
import { Transform } from './util/Transform';
import { Vector2, Vector3 } from './util/vector';
import { Quaternion } from './util/quaternion';
import type { Rotation } from './util/Rotation';
import { inverseLerp, lerp } from './util/math';
import { mapBufferChunks } from './util/array';
import { Texture } from './textures/Texture';
import type { Color3 } from './util/Color3';

const GlbMagic = [0x67, 0x6C, 0x54, 0x46];
const DEBUG_DRAW_BONES = false;

/*
  @TODO Things we should maybe do
    // - pass through vertex attribute byte length
    // - animation samples have weird scaling bug (?)
    // - MeshPrimitiveDefinition.indicesBuffer store type
    // - Material: Color, texture
    - Texture transparency / GlTF alpha
    - Test an animation with CubicSpline interpolation
    - Test an animation that animates morph target weights
    - Walk from scene entrypoint rather than read all nodes
    - "How many things?" when drawing mesh primitive from non-indexed buffer
    - Vertex color alpha
    - Generate normals if missing
    - ? Should we honour texture.sampler properties such as `wrapS`, `wrapT`

    - gltfExperiment transform seems to be ignored (?)

    - Okay, so what is the API for this stuff?
      - Rename animation.length to `lengthSeconds` ?
      - Rename `channels` to `tracks`?
      - "looping" flags and such
      - reset state when stop playing (? or is it working?)

    - Should we support `doubleSided`?
    - Do we need to reuse meshnode instead of instantiating mesh every time … ?
    - Figure out how to decouple Shader from Mesh aka, how to re-use a material on different meshes
    - Animation Retargeting :think:
 */

export class IdPool {
  private pool: Set<number>;

  public constructor() {
    this.pool = new Set<number>();
  }

  /**
   * Generate a new unique ID that has not been issued from the pool
   * before.
   */
  public createNew(): number {
    let newId: number;
    do {
      newId = Math.trunc(Math.random() * 0xF000_0000) + 0x1000_0000;
    } while (this.pool.has(newId));

    this.pool.add(newId);

    return newId;
  }
}
interface AttributeDefinition {
  /** Raw typed array of data. */
  buffer: TypedArray;
  /** Number of components per element of data. For example, the element size of a Vector2 is 2. */
  componentCount: number;
  /**
   * Number of bytes per component. For example, Float32 is 4 bytes.
   * The full size of an element is calculated as `componentCount * componentSize`.
   */
  componentSize: number;
  /** Type of each component e.g. `FLOAT`, `UNSIGNED_INT`, etc. */
  componentType: GLTF.AccessorComponentType;
  /**
   * Specifies whether integer data values should be normalized (true) to [0, 1] (for unsigned types)
   * or [-1, 1] (for signed types), or converted directly (false) when they are accessed.
   */
  normalized: boolean;
}
interface MaterialDefinition {
  name: string;
  alpha: { mode: 'OPAQUE' } | { mode: 'BLEND' } | { mode: 'MASK', cutoff: number };
  diffuseColor?: Color4;
  texture?: {
    buffer: Uint8Array<ArrayBuffer>;
    texCoord: number;
  },
}
interface MeshPrimitiveDefinition {
  positionData: AttributeDefinition;      // VEC3
  extents: {
    min: Vector3,
    max: Vector3,
  },
  normalData?: AttributeDefinition;       // VEC3
  texCoord0Data?: AttributeDefinition;    // VEC2
  color0Data?: AttributeDefinition;       // VEC3 or VEC4
  joints0Data?: AttributeDefinition;      // VEC4
  weights0Data?: AttributeDefinition;     // VEC4
  indices?: {
    /** Raw typed array of index data. */
    buffer: TypedArray;
    /** Type of each index e.g. `UNSIGNED_INT` or `UNSIGNED_SHORT`*/
    type: GLTF.AccessorComponentType;
  },
  /** GL rendering mode e.g. TRIANGLES, LINES, TRIANGLE_FAN, etc. */
  mode: GLTF.MeshPrimitiveMode;
  material?: MaterialDefinition;
}
interface MeshDefinition {
  primitives: MeshPrimitiveDefinition[];
}
interface SkinDefinition {
  inverseBindMatrices: Matrix4[];
  jointNodeIndices: number[];
}
interface NodeDefinition {
  name: string;
  transform: {
    position: Vector3,
    rotation: Quaternion,
    scale: Vector3,
  },
  // @NOTE Could also store `parent` if we want
  children: NodeDefinition[];
  mesh?: MeshDefinition;
  skin?: SkinDefinition;
}

type ArrayElementType<T> = T extends Array<infer ElementType> ? ElementType : never;

interface AnimationChannelDefinition {
  targetNode: NodeDefinition;
  targetNodeProperty: GLTF.AnimationChannelTargetPath;
  timestamps: Float32Array;
  interpolation: GLTF.AnimationSamplerInterpolation;
  values: AnimationChannelValues;
}
interface ScalarAnimationChannelValues {
  type: 'scalar';
  values: number[];
}
interface Vec2AnimationChannelValues {
  type: 'vec2';
  values: Vector2[];
}
interface Vec3AnimationChannelValues {
  type: 'vec3';
  values: Vector3[];
}
interface QuatAnimationChannelValues {
  type: 'quat';
  values: Quaternion[];
}

type AnimationChannelValues = ScalarAnimationChannelValues | Vec2AnimationChannelValues | Vec3AnimationChannelValues | QuatAnimationChannelValues;
type AnimationTypeValue = ArrayElementType<AnimationChannelValues['values']>;
type AnimationChannelValueSetterFn = (value: AnimationTypeValue) => void;


class AnimationChannel {
  private readonly valueSetter: AnimationChannelValueSetterFn;
  public readonly timestamps: Float32Array;
  private readonly values: AnimationChannelValues;
  private readonly interpolation: GLTF.AnimationSamplerInterpolation;

  private constructor(
    valueSetter: AnimationChannelValueSetterFn,
    timestamps: Float32Array,
    values: AnimationChannelValues,
    interpolation: GLTF.AnimationSamplerInterpolation,
  ) {
    this.valueSetter = valueSetter;
    this.timestamps = timestamps;
    this.values = values;
    this.interpolation = interpolation;
  }

  public assignAnimatedValue(previousTimestampIndex: number, nextTimestampIndex: undefined, animationTime: number): void;
  public assignAnimatedValue(previousTimestampIndex: undefined, nextTimestampIndex: number, animationTime: number): void;
  public assignAnimatedValue(previousTimestampIndex: number, nextTimestampIndex: number, animationTime: number): void;
  public assignAnimatedValue(previousTimestampIndex: number | undefined, nextTimestampIndex: number | undefined, animationTime: number): void {
    if (previousTimestampIndex === undefined && nextTimestampIndex === undefined) {
      // @NOTE Theoretically impossible, but makes type checker satisfied
      throw new Error(`Cannot assign animated value. No timestamp indices are defined`);
    } else if (previousTimestampIndex === undefined) {
      // Peg to initial value
      this.valueSetter(this.values.values[nextTimestampIndex!]); // @NOTE Damn TypeScript, I thought you were smarter than this.
    } else if (nextTimestampIndex === undefined) {
      // Peg to final value
      this.valueSetter(this.values.values[previousTimestampIndex]);
    } else {
      // Interpolate between two values

      if (this.interpolation === 'LINEAR') {
        /* Linear interpolation */
        const t = inverseLerp(this.timestamps[previousTimestampIndex], this.timestamps[nextTimestampIndex], animationTime);

        let value: AnimationTypeValue;
        switch (this.values.type) {
          case 'scalar': {
            const a = this.values.values[previousTimestampIndex];
            const b = this.values.values[nextTimestampIndex];
            value = lerp(a, b, t);
            break;
          }
          case 'vec2': {
            const a = this.values.values[previousTimestampIndex];
            const b = this.values.values[nextTimestampIndex];
            value = new Vector2(
              lerp(a.x, b.x, t),
              lerp(a.y, b.y, t),
            );
            break;
          }
          case 'vec3': {
            const a = this.values.values[previousTimestampIndex];
            const b = this.values.values[nextTimestampIndex];
            value = new Vector3(
              lerp(a.x, b.x, t),
              lerp(a.y, b.y, t),
              lerp(a.z, b.z, t),
            );
            break;
          }
          case 'quat': {
            const a = this.values.values[previousTimestampIndex];
            const b = this.values.values[nextTimestampIndex];
            value = Quaternion.slerp(a, b, t);
            break;
          }
          default:
            throw new Error(`Animation with LINEAR interpolation has unimplemented value type: ${(this.values as { type: string }).type}`);
        }

        this.valueSetter(value);
      } else if (this.interpolation === 'STEP') {
        /* Step interpolation */
        // Step is just constant with previous timestamp
        this.valueSetter(this.values.values[previousTimestampIndex]);
      } else if (this.interpolation === 'CUBICSPLINE') {
        /* Cubic spline interpolation */
        // @TODO
        throw new Error(`CUBICSPLINE interpolation not yet implemented`);
      } else {
        throw new Error(`Animation interpolation type '${this.interpolation}' not yet implemented`);
      }
    }
  }

  public static fromDefinition(allNodes: MeshNode[], definition: AnimationChannelDefinition): AnimationChannel {
    const targetNode = allNodes.find((node) => node.definition === definition.targetNode);
    if (targetNode === undefined) {
      throw new Error(`Could not find target node in set of all nodes`);
    }

    function valueSetter(value: AnimationTypeValue): void {
      switch (definition.targetNodeProperty) {
        case 'translation':
          targetNode!.position = value as Vector3;
          break;
        case 'rotation':
          targetNode!.rotation.set(value as Quaternion);
          break;
        case 'scale':
          targetNode!.scale = value as Vector3;
          break;
        case 'weights':
          // @TODO
          throw new Error(`Unimplemented animation value setter property 'weights'`);
        default:
          throw new Error(`Unimplemented animation value setter property '${definition.targetNodeProperty}'`);
      }
    }

    return new AnimationChannel(
      valueSetter,
      definition.timestamps,
      definition.values,
      definition.interpolation,
    );
  }
}

interface AnimationDefinition {
  name: string;
  length: number;
  channels: AnimationChannelDefinition[];
}

export class Animation {
  public readonly name: string;
  public readonly length: number;
  public readonly channels: AnimationChannel[];

  public constructor(name: string, length: number, channels: AnimationChannel[]) {
    this.name = name;
    this.length = length;
    this.channels = channels;
  }

  public static fromDefinition(allNodes: MeshNode[], definition: AnimationDefinition): Animation {
    return new Animation(
      definition.name,
      definition.length,
      definition.channels.map((channelDefinition) =>
        AnimationChannel.fromDefinition(allNodes, channelDefinition),
      ),
    );
  }
}

export interface ShaderProgramOptions {
  hasDiffuseColor: boolean;
  hasVertexColors: boolean;
  hasDiffuseTexture: boolean;
  blendingMode: ShaderBlendingMode; // @TODO Should we just pass the material reference?
  unlit: boolean;
  hasSkin: boolean;
}

interface DrawTask2 {
  renderPass: number; // @TODO how is this actually used?
  glProgram: ShaderProgram2;
  material: Material2;
  mesh: {
    id: number;
    vao: WebGLVertexArrayObject;
    draw: () => void,
  },
  uniforms: {
    worldMatrix: Matrix4;
    skinWeights?: Float32Array;
  }
}
interface TransparentDrawTask2 extends DrawTask2 {
  depth: number;
}

function sortDrawTasks(drawTasks: DrawTask2[]): void {
  drawTasks.sort((taskA, taskB) => {
    return taskA.renderPass - taskB.renderPass ||
      taskA.glProgram.id - taskB.glProgram.id ||
      taskA.material.id - taskB.material.id ||
      taskA.mesh.id - taskB.mesh.id;
  });
}

export class ShaderCache {
  private static readonly IdPool: IdPool = new IdPool();
  private static readonly cache: Record<string, ShaderProgram2> = {};
  /**
   * List of properties we know we are referencing in the generation of a cache key.
   */
  private static readonly KnownCacheProperties: (keyof ShaderProgramOptions)[] = [
    'blendingMode',
    'hasDiffuseColor',
    'hasDiffuseTexture',
    'hasSkin',
    'hasVertexColors',
    'unlit',
  ];

  private static createCacheKey(options: ShaderProgramOptions): string {
    /*
     * @NOTE
     * Simple fail-safe to make sure we never cache a shader without referencing a property.
     * We just maintain a list of properties that we "know" we are using in the generation
     * of the cache key, and validate that against all keys on the options object.
     * If somebody adds a new key to `ShaderProgramOptions` without updating this logic,
     * this will produce a warning.
     */
    const missingKeys: (keyof ShaderProgramOptions)[] = [];
    for (const optionsKey of Object.keys(options) as (keyof ShaderProgramOptions)[]) {
      if (!ShaderCache.KnownCacheProperties.includes(optionsKey)) {
        missingKeys.push(optionsKey);
      }
    }
    if (missingKeys.length > 0) {
      console.warn(`[${ShaderCache.name}] (${this.createCacheKey.name}) WARNING: Unused properties from 'options' object: `, missingKeys);
    }

    return [
      options.blendingMode.type,
      options.hasDiffuseColor,
      options.hasDiffuseTexture,
      options.hasSkin,
      options.hasVertexColors,
      options.unlit,
    ].join('|');
  }

  public static create(engine: IEngine, primitiveDefinition: MeshPrimitiveDefinition, material: Material2): ShaderProgram2 {
    const args: ShaderProgram2Args = {
      vertexShaderSource: VertexShaderSource,
      fragmentShaderSource: FragmentShaderSource,
    };
    const options: ShaderProgramOptions = {
      blendingMode: material.blendingMode,
      hasDiffuseColor: material?.diffuseColor !== undefined,
      hasDiffuseTexture: material?.diffuseTexture !== undefined,
      // @NOTE @ASSUMPTION if skin attributes are defined then NodeDefinition has a skeleton defined
      hasSkin: primitiveDefinition.joints0Data !== undefined && primitiveDefinition.weights0Data !== undefined,
      hasVertexColors: primitiveDefinition.color0Data !== undefined,
      unlit: material.unlit,
    };

    const cacheKey = ShaderCache.createCacheKey(options);

    // Lookup shader in cache
    const existingShader = ShaderCache.cache[cacheKey];
    if (existingShader !== undefined) {
      return existingShader;
    } else {
      // Create new shader and add to cache
      const newShaderId = ShaderCache.IdPool.createNew();
      const newShader = new ShaderProgram2(engine, newShaderId, args, options);
      ShaderCache.cache[cacheKey] = newShader;
      return newShader;
    }
  }
}

interface ShaderProgram2Args {
  vertexShaderSource: string;
  fragmentShaderSource: string;
}
export class ShaderProgram2 {
  public static MaxBones = 64;

  public readonly id: number;

  private readonly gl: WebGL2RenderingContext;
  public readonly program: WebGLProgram;

  public constructor(engine: IEngine, id: number, args: ShaderProgram2Args, options: ShaderProgramOptions) {
    const { gl } = engine;

    this.gl = gl;
    this.id = id;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    const program = this.program = gl.createProgram();

    if (!vertexShader || !fragmentShader || !program) {
      throw new Error(`Failed to allocate GL objects`);
    }

    function inject(name: string, injected: string, src: string): string {
      return src.replace(new RegExp(`#pragma\\s+inject\\s*\\(\\s*${name}\\s*\\)\\s*$`, "m"), injected);
    }
    const definesBlock = `#define _ShaderId ${id}\n` + ShaderProgram2.getDefinesFromShaderOptions(options)
      .map((define) => `#define ${define}`).join('\n') + '\n';
    const vertexShaderSource = inject('defines', definesBlock, args.vertexShaderSource);
    gl.shaderSource(vertexShader, vertexShaderSource);
    const fragmentShaderSource = inject('defines', definesBlock, args.fragmentShaderSource);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    // console.log(`Shader '${name}'\n<VERTEX_SHADER>\n${vertexShaderSource}\n</VERTEX_SHADER>\n<FRAGMENT_SHADER>\n${fragmentShaderSource}\n</FRAGMENT_SHADER>`);

    gl.compileShader(vertexShader);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      const errorMessage = gl.getShaderInfoLog(vertexShader);
      throw new Error(`Failed to compile vertex shader: ${errorMessage}`);
    }
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      const errorMessage = gl.getShaderInfoLog(fragmentShader);
      throw new Error(`Failed to compile fragment shader: ${errorMessage}`);
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const errorMessage = gl.getProgramInfoLog(program);
      throw new Error(`Failed to link GL program: ${errorMessage}`);
    }

    const cameraUboBlockIndex = gl.getUniformBlockIndex(this.program, "Camera");
    gl.uniformBlockBinding(this.program, cameraUboBlockIndex, CameraUboIndex);
    const lightingUboBlockIndex = gl.getUniformBlockIndex(this.program, "Lighting");
    gl.uniformBlockBinding(this.program, lightingUboBlockIndex, LightingUboIndex);

    // @TODO Handle missing
    // @NOTE Non-existent UBO seems to return WebGL2RenderingContext.INVALID_INDEX
  }

  public getAttribute(attributeName: string): number | undefined {
    const attribute = this.gl.getAttribLocation(this.program, attributeName);
    if (attribute < 0) {
      return undefined;
    } else {
      return attribute;
    }
  }

  public getUniform(uniformName: string): WebGLUniformLocation | undefined {
    const uniform = this.gl.getUniformLocation(this.program, uniformName);
    if (!uniform) {
      return undefined;
    }

    return uniform;
  }

  private static getDefinesFromShaderOptions(options: ShaderProgramOptions): string[] {
    const defines: string[] = [];

    if (options.hasDiffuseColor) {
      defines.push('DIFFUSE_COLOR');
    }

    if (options.hasVertexColors) {
      defines.push('VERTEX_COLORS');
    }

    if (options.hasSkin) {
      defines.push('SKIN', 'MAX_BONES ' + ShaderProgram2.MaxBones);
    }

    if (options.hasDiffuseTexture) {
      defines.push('DIFFUSE_TEXTURE');
    }

    switch (options.blendingMode.type) {
      case 'None':
        /* No blending, will set alpha = 1.0 in shader by default */
        break;
      case 'Average':
        /* Averaged blending. Transparent pixels set to alpha=0.5f for blending */
        defines.push('FIXED_TRANSPARENCY_ALPHA 0.5f');
        break;
      case 'Additive':
        /* Additive blending. Transparent pixels set to alpha=0.0f for blending */
        defines.push('FIXED_TRANSPARENCY_ALPHA 0.0f');
        break;
      case 'Subtractive':
        /* Subtractive blending. Transparent pixels set to alpha=0.0f for blending */
        defines.push('FIXED_TRANSPARENCY_ALPHA 0.0f');
        break;
      case 'AlphaBlend':
        /* Alpha blend. Do not manipulate shader output alpha */
        defines.push('ALPHA_BLENDING');
        break;
      case 'AlphaClip':
        /* Alpha clip. Pixels with alpha less than the cutoff are discarded, otherwise rendered as opaque */
        defines.push('ALPHA_CLIPPING');
        break;
      default:
        throw new Error(`Unimplemented blending mode: '${(options.blendingMode as { type: unknown }).type}'`);
    }

    if (options.unlit) {
      defines.push("UNLIT");
    }

    return defines;
  }
}

export type NoneBlendingMode = {
  type: 'None';
};
export type AverageBlendingMode = {
  type: 'Average';
};
export type AdditiveBlendingMode = {
  type: 'Additive';
};
export type SubtractiveBlendingMode = {
  type: 'Subtractive';
};
export type AlphaBlendBlendingMode = {
  type: 'AlphaBlend';
};
export type AlphaClipBlendingMode = {
  type: 'AlphaClip';
  cutoff: number;
};
export type ShaderBlendingMode =
  NoneBlendingMode |
  AverageBlendingMode |
  AdditiveBlendingMode |
  SubtractiveBlendingMode |
  AlphaBlendBlendingMode |
  AlphaClipBlendingMode;
export type BlendingModeType = ShaderBlendingMode['type'];
export const ShaderBlendingMode = {
  None: () => ({ type: 'None' }),
  Average: () => ({ type: 'Average' }),
  Additive: () => ({ type: 'Additive' }),
  Subtractive: () => ({ type: 'Subtractive' }),
  AlphaBlend: () => ({ type: 'AlphaBlend' }),
  AlphaClip: (cutoff: number) => ({ type: 'AlphaClip', cutoff }),
} satisfies { [type in BlendingModeType]: (...args: any[]) => Extract<ShaderBlendingMode, { type: type }> };

export class Material2 {
  private static readonly IdPool: IdPool = new IdPool();

  public readonly id: number;
  public readonly name: string;
  public diffuseColor: Color4 | undefined;
  public diffuseTexture: Texture | undefined;
  public emissionColor: Color3 | undefined;
  public unlit: boolean;
  public blendingMode: ShaderBlendingMode;

  public constructor(name: string, initialValues?: Partial<Material2>) {
    this.id = Material2.IdPool.createNew();
    this.name = name;
    this.diffuseColor = initialValues?.diffuseColor;
    this.diffuseTexture = initialValues?.diffuseTexture;
    this.emissionColor = initialValues?.emissionColor;
    this.unlit = initialValues?.unlit ?? false;
    this.blendingMode = initialValues?.blendingMode ?? ShaderBlendingMode.None();
  }

  public static async fromDefinition(engine: IEngine, definition: MaterialDefinition): Promise<Material2> {
    const material = new Material2(definition.name);
    if (definition.diffuseColor !== undefined) {
      material.diffuseColor = definition.diffuseColor;
    }
    if (definition.texture !== undefined) {
      material.diffuseTexture = await Texture.loadFromBuffer(engine, definition.texture.buffer);
    }

    switch (definition.alpha.mode) {
      case 'OPAQUE':
        material.blendingMode = ShaderBlendingMode.None();
        break;
      case 'BLEND':
        material.blendingMode = ShaderBlendingMode.AlphaBlend();
        break;
      case 'MASK':
        material.blendingMode = ShaderBlendingMode.AlphaClip(definition.alpha.cutoff);
        break;
      default:
        throw new Error(`Unimplemented alpha mode: ${(definition.alpha as { mode: unknown }).mode}`);
    }

    return material;
  }
}

interface SubMeshExtents {
  min: Vector3;
  max: Vector3;
  center: Vector3;
}

export class SubMeshNew {
  private static IdPool: IdPool = new IdPool();

  private readonly id: number;
  private readonly vao: WebGLVertexArrayObject;
  private readonly material: Material2;
  private readonly shader: ShaderProgram2;
  private readonly extents: SubMeshExtents;
  private readonly drawPrimitive: () => void;

  private readonly _cameraSpacePositionTmp: Vector3 = Vector3.zero();

  private constructor(
    vao: WebGLVertexArrayObject,
    material: Material2,
    shader: ShaderProgram2,
    extents: SubMeshExtents,
    drawPrimitive: () => void,
  ) {
    this.id = SubMeshNew.IdPool.createNew();
    this.vao = vao;
    this.material = material;
    this.shader = shader;
    this.extents = extents;
    this.drawPrimitive = drawPrimitive;
  }

  public draw2(
    drawQueues: DrawQueues,
    modelViewMatrix: Matrix4,
    worldMatrix: Matrix4,
    jointMatrices: Matrix4[] | undefined,
  ): void {
    // Joint matrices
    let jointMatricesBytes: Float32Array | undefined = undefined;
    if (jointMatrices) {
      jointMatricesBytes = new Float32Array(ShaderProgram2.MaxBones * 16); // @TODO Don't allocate every frame
      jointMatrices.forEach((jointMatrix, index) => {
        jointMatricesBytes!.set(jointMatrix.toArray(), index * 16);
      });
    }

    const drawTask: DrawTask2 = {
      renderPass: 0, // @TODO (?)
      glProgram: this.shader,
      material: this.material,
      mesh: {
        id: this.id,
        vao: this.vao,
        draw: this.drawPrimitive,
      },
      uniforms: {
        worldMatrix,
        skinWeights: jointMatricesBytes,
      },
    };

    const materialBlendingMode = this.material.blendingMode.type;
    const isMaterialTransparent = materialBlendingMode === 'Additive' ||
      materialBlendingMode === 'AlphaBlend' ||
      materialBlendingMode === 'Average' ||
      materialBlendingMode === 'Subtractive';

    if (isMaterialTransparent) {
      // Transform local-space extents to world camera space
      // for depth sorting
      this._cameraSpacePositionTmp
        .setValue(this.extents.center)
        .multiplySelf(modelViewMatrix);

      drawQueues.transparent.push({
        ...drawTask,
        depth: this._cameraSpacePositionTmp.z,
      });
    } else {
      drawQueues.opaque.push(drawTask);
    }
  }

  public static async fromDefinition(
    engine: IEngine,
    primitive: MeshPrimitiveDefinition,
  ): Promise<SubMeshNew> {
    const { gl } = engine;

    const material = primitive.material ?
      await Material2.fromDefinition(engine, primitive.material) :
      new Material2('default');
    const shader = ShaderCache.create(engine, primitive, material);

    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error('Failed to create VAO');
    }

    gl.bindVertexArray(vao);

    /* Vertex positions */
    // @TODO can probably make a function that calls all of this for a given Attribute + AttributeDefinition
    {
      const vertexPositionAttribute = shader.getAttribute('vertexPosition');
      if (vertexPositionAttribute === undefined) {
        throw new Error(`Could not find vertex attribute 'vertexPosition' in shader. Cannot render mesh primitive with no vertex position data.`);
      }
      gl.enableVertexAttribArray(vertexPositionAttribute);
      const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, primitive.positionData.buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(
        vertexPositionAttribute,
        primitive.positionData.componentCount,
        primitive.positionData.componentType,
        primitive.positionData.normalized,
        primitive.positionData.componentCount * primitive.positionData.componentSize,
        0,
      );
    }

    const meshExtents: SubMeshExtents = {
      min: primitive.extents.min,
      max: primitive.extents.max,
      center: primitive.extents.min.add(primitive.extents.max).divideSelf(2),
    };

    /* Vertex normals */
    // @TODO generate normals somewhere
    if (primitive.normalData) {
      const vertexNormalAttribute = shader.getAttribute('vertexNormal');
      if (vertexNormalAttribute === undefined) {
        throw new Error(`Could not find vertex attribute 'vertexNormal' in shader. Cannot render mesh primitive with no vertex normal data.`);
      }
      gl.enableVertexAttribArray(vertexNormalAttribute);
      const normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, primitive.normalData.buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
      gl.vertexAttribPointer(
        vertexNormalAttribute,
        primitive.normalData.componentCount,
        primitive.normalData.componentType,
        primitive.normalData.normalized,
        primitive.normalData.componentCount * primitive.normalData.componentSize,
        0,
      );
    } else {
      throw new Error(`Missing normals - we must generate them`);
    }

    /* Vertex colors */
    const vertexColorAttribute = shader.getAttribute('vertexColor');
    if (vertexColorAttribute && primitive.color0Data) {
      gl.enableVertexAttribArray(vertexColorAttribute);
      const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, primitive.color0Data.buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.vertexAttribPointer(
        vertexColorAttribute,
        primitive.color0Data.componentCount,
        primitive.color0Data.componentType,
        primitive.color0Data.normalized,
        primitive.color0Data.componentCount * primitive.color0Data.componentSize,
        0,
      );
    }
    const texCoordIndex = primitive.material?.texture?.texCoord;
    const textureCoordAttribute = shader.getAttribute('textureCoord');
    if (textureCoordAttribute && texCoordIndex !== undefined) {
      const textureCoordAttributeData = primitive[`texCoord${texCoordIndex}Data` as keyof MeshPrimitiveDefinition] as (AttributeDefinition | undefined);
      if (textureCoordAttributeData) {
        gl.enableVertexAttribArray(textureCoordAttribute);
        const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, textureCoordAttributeData.buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.vertexAttribPointer(
          textureCoordAttribute,
          textureCoordAttributeData.componentCount,
          textureCoordAttributeData.componentType,
          textureCoordAttributeData.normalized,
          textureCoordAttributeData.componentCount * textureCoordAttributeData.componentSize,
          0,
        );
      }
    }

    /* Joint indices */
    const vertexJointsAttribute = shader.getAttribute('vertexJoints');
    if (vertexJointsAttribute && primitive.joints0Data) {
      gl.enableVertexAttribArray(vertexJointsAttribute);
      const jointsBuffer = createBuffer(gl, gl.ARRAY_BUFFER, primitive.joints0Data.buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, jointsBuffer);
      gl.vertexAttribPointer(
        vertexJointsAttribute,
        primitive.joints0Data.componentCount,
        primitive.joints0Data.componentType,
        primitive.joints0Data.normalized,
        primitive.joints0Data.componentCount * primitive.joints0Data.componentSize,
        0,
      );
    }
    /* Joint weights */
    const vertexWeightsAttribute = shader.getAttribute('vertexWeights');
    if (vertexWeightsAttribute && primitive.weights0Data) {
      gl.enableVertexAttribArray(vertexWeightsAttribute);
      const weightsBuffer = createBuffer(gl, gl.ARRAY_BUFFER, primitive.weights0Data.buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, weightsBuffer);
      gl.vertexAttribPointer(
        vertexWeightsAttribute,
        primitive.weights0Data.componentCount,
        primitive.weights0Data.componentType,
        primitive.weights0Data.normalized,
        primitive.weights0Data.componentCount * primitive.weights0Data.componentSize,
        0,
      );
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    /* Indexed geometry */
    if (primitive.indices) {
      console.log(`Primitive has indexed geometry:`, primitive);
      const indicesBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, primitive.indices.buffer);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);
    }

    let drawPrimitive: () => void;
    if (primitive.indices) {
      // Indexed geometry
      const mode = primitive.mode;
      const elementCount = primitive.indices.buffer.length;
      const elementType = primitive.indices.type;
      drawPrimitive = () => {
        gl.drawElements(mode, elementCount, elementType, 0);
      };
    } else {
      // @TODO How many things?
      const count = primitive.positionData.buffer.length; // @TODO This is just a guess, untested
      drawPrimitive = () => {
        gl.drawArrays(primitive.mode, 0, count);
      };
    }

    gl.bindVertexArray(null);

    return new SubMeshNew(
      vao,
      material,
      shader,
      meshExtents,
      drawPrimitive,
    );
  }
}

export class MeshSkin {
  public readonly skeleton: MeshNode[];
  public readonly inverseBindMatrices: Matrix4[];

  public constructor(skeleton: MeshNode[], inverseBindMatrices: Matrix4[]) {
    this.skeleton = skeleton;
    this.inverseBindMatrices = inverseBindMatrices;
  }
}

interface MeshNodeArgs {
  name: string;
  meshPrimitives: SubMeshNew[];
  definition: NodeDefinition;
}
export class MeshNode {
  public readonly name: string;
  private transform: Transform<MeshNode>;
  private meshPrimitives: SubMeshNew[]; // @TODO should it live here? Can be re-used
  private skin?: MeshSkin;

  public readonly definition: NodeDefinition; // @TODO surely not

  private readonly _worldMatrixTmp: Matrix4 = new Matrix4();
  private _jointMatricesTmp: Matrix4[] | undefined;
  private _modelViewMatrixTmp: Matrix4 = new Matrix4();


  private constructor({ name, meshPrimitives, definition }: MeshNodeArgs) {
    this.name = name;
    this.meshPrimitives = meshPrimitives;
    this.transform = new Transform<MeshNode>(this);
    this.definition = definition;
  }

  public setSkin(skin: MeshSkin): void {
    this.skin = skin;
    this._jointMatricesTmp = skin.skeleton.map(() => new Matrix4());
  }

  public static async fromDefinition(engine: IEngine, definition: NodeDefinition): Promise<MeshNode> {
    const meshPrimitives: SubMeshNew[] = [];
    if (definition.mesh) {
      for (const meshPrimitiveDefinition of definition.mesh.primitives) {
        // @TODO Instances of MeshNode are distinct but share SubMeshes/Primitives
        const subMesh = await SubMeshNew.fromDefinition(
          engine,
          meshPrimitiveDefinition,
        );

        meshPrimitives.push(subMesh);
      }
    }
    return new MeshNode({
      name: definition.name,
      meshPrimitives: meshPrimitives,
      definition,
    });
  }

  public draw2(
    drawQueues: DrawQueues,
    viewMatrix: Matrix4,
    worldMatrix: Matrix4,
  ): void {
    if (this.meshPrimitives.length === 0) return; // @NOTE Don't bother doing math unless we need it

    this._worldMatrixTmp.setValue(worldMatrix).multiplySelf(this.worldMatrix);
    if (this.skin !== undefined) {
      this.skin.skeleton.forEach((bone, i) => {
        this._jointMatricesTmp![i].setValue(bone.worldMatrix).multiplySelf(this.skin!.inverseBindMatrices[i]);
      });
    }

    this._modelViewMatrixTmp
      .setValue(viewMatrix)
      .multiplySelf(this._worldMatrixTmp);

    for (const subMesh of this.meshPrimitives) {
      subMesh.draw2(drawQueues, this._modelViewMatrixTmp, this._worldMatrixTmp, this._jointMatricesTmp);
    }
  }

  public addChild(child: MeshNode): void {
    this.transform.addChild(child.transform);
  }

  public get position(): Vector3 { return this.transform.position; }
  public set position(value: Vector3) { this.transform.position = value; }
  public get rotation(): Rotation { return this.transform.rotation; }
  public get scale(): Vector3 { return this.transform.scale; }
  public set scale(value: Vector3) { this.transform.scale = value; }

  public get absolutePosition(): Vector3 { return this.transform.absolutePosition; }
  public set absolutePosition(value: Vector3) { this.transform.absolutePosition = value; }
  public get absoluteRotation(): Rotation { return this.transform.absoluteRotation; }
  public get absoluteScale(): Vector3 { return this.transform.absoluteScale; }
  public set absoluteScale(value: Vector3) { this.transform.absoluteScale = value; }

  public get worldMatrix(): Matrix4 { return this.transform.worldMatrix; }
}

export interface DrawQueues {
  opaque: DrawTask2[];
  transparent: TransparentDrawTask2[];
}
export class GltfExperiment extends DrawableSceneNode {
  private readonly nodes: MeshNode[];
  // private readonly allAnimationDefinitions: AnimationDefinition[];
  private readonly allAnimations: Animation[];

  private currentAnimationTime: number = 0;
  private currentAnimation: Animation | undefined;
  private debug_currentAnimationSpeed: number = 1;

  private _normalTmp: Matrix3 = new Matrix3();

  private constructor(
    scene: IScene,
    nodes: MeshNode[],
    allAnimations: Animation[],
  ) {
    super(scene, 'gltf-experiment');
    this.nodes = nodes;
    this.allAnimations = allAnimations;
  }

  public static async load(gltfPath: string, filesystem: IFileSystem, engine: IEngine, scene: IScene): Promise<GltfExperiment> {
    const fileBytes = await filesystem.readFile(gltfPath);

    let isGlb = true;
    for (let i = 0; i < 4; i++) {
      if (fileBytes.bytes[i] != GlbMagic[i]) {
        isGlb = false;
        break;
      }
    }

    const io = new WebIO({ credentials: 'include' });

    let document: Document;
    if (isGlb) {
      document = await io.readBinary(fileBytes.bytes);
      console.log(`Read GLB: `, document);
    } else {
      const gltfJson = JSON.parse(fileBytes.textContent) as GLTF.IGLTF;
      const resources: Record<string, Uint8Array<ArrayBuffer>> = {};

      async function preloadGltfDependency(uri: string): Promise<void> {
        let path: string;
        if (uri.startsWith('/')) {
          // URI is absolute, relative to FS root (I guess)
          path = canonicalisePath(uri);
        } else {
          // URI is relative, relative to `objPath`
          path = canonicalisePath(`${gltfPath}/../${uri}`);
        }
        const file = await filesystem.readFile(path);
        resources[uri] = file.bytes as Uint8Array<ArrayBuffer>;
      }

      const dependencyPromises: Promise<void>[] = [];
      if (gltfJson.images) {
        for (const image of gltfJson.images) {
          if (image.uri !== undefined && !image.uri.startsWith('data:')) {
            dependencyPromises.push(preloadGltfDependency(image.uri));
          }
        }
      }

      if (gltfJson.buffers) {
        for (const buffer of gltfJson.buffers) {
          if (buffer.uri !== undefined && !buffer.uri.startsWith('data:')) {
            dependencyPromises.push(preloadGltfDependency(buffer.uri));
          }
        }
      }

      await Promise.all(dependencyPromises);

      document = await io.readJSON({
        json: gltfJson,
        resources,
      });
      console.log(`Read glTF`, document);
    }

    function readVertexAttributes(accessor: Accessor): AttributeDefinition {
      return {
        buffer: accessor.getArray()!,
        componentCount: accessor.getElementSize(),
        componentSize: accessor.getComponentSize(),
        componentType: accessor.getComponentType(),
        normalized: accessor.getNormalized(),
      };
    }

    const root = document.getRoot();

    // @TODO we should walk the initial scene, rather than every node
    const allNodes = root.listNodes();
    const allNodeDefinitions: NodeDefinition[] = [];
    const reverseNodeLookup: Array<[src: Node, definition: NodeDefinition]> = [];
    for (const node of allNodes) {
      const nodeDefinition: NodeDefinition = {
        // @TODO Transform
        name: node.getName(),
        children: [],
        transform: {
          position: new Vector3(...node.getTranslation()),
          rotation: new Quaternion(...node.getRotation()),
          scale: new Vector3(...node.getScale()),
        },
      };
      console.log(`NODE TRANSFORM: `, nodeDefinition.transform);

      const mesh = node.getMesh();
      if (mesh) {
        console.log(`Node '${node.getName()}' has mesh`);
        const meshDefinition: MeshDefinition = nodeDefinition.mesh = {
          primitives: [],
        };
        for (const primitive of mesh.listPrimitives()) {
          const positionAccessor = primitive.getAttribute('POSITION');
          if (!positionAccessor) {
            console.warn(`Skipping mesh primitive with no POSITION attributes in node '${nodeDefinition.name}'`);
            continue;
          }

          const positionMinComponents = positionAccessor.getMin([]);
          const positionMaxComponents = positionAccessor.getMax([]);
          const primitiveDefinition: MeshPrimitiveDefinition = {
            mode: primitive.getMode(),
            positionData: readVertexAttributes(positionAccessor),
            extents: {
              min: new Vector3(positionMinComponents[0], positionMinComponents[1], positionMinComponents[2]),
              max: new Vector3(positionMaxComponents[0], positionMaxComponents[1], positionMaxComponents[2]),
            },
          };

          const normalAccessor = primitive.getAttribute('NORMAL');
          if (normalAccessor) {
            primitiveDefinition.normalData = readVertexAttributes(normalAccessor);
          }

          const textureCoordinate0Accessor = primitive.getAttribute('TEXCOORD_0');
          if (textureCoordinate0Accessor) {
            primitiveDefinition.texCoord0Data = readVertexAttributes(textureCoordinate0Accessor);
          }

          const color0Accessor = primitive.getAttribute('COLOR_0');
          if (color0Accessor) {
            primitiveDefinition.color0Data = readVertexAttributes(color0Accessor);
          }

          const joints0Accessor = primitive.getAttribute('JOINTS_0');
          if (joints0Accessor) {
            primitiveDefinition.joints0Data = readVertexAttributes(joints0Accessor);
          }

          const weights0Accessor = primitive.getAttribute('WEIGHTS_0');
          if (weights0Accessor) {
            primitiveDefinition.weights0Data = readVertexAttributes(weights0Accessor);
          }

          const indicesAccessor = primitive.getIndices();
          if (indicesAccessor) {
            primitiveDefinition.indices = {
              buffer: indicesAccessor.getArray()!,
              type: indicesAccessor.getComponentType(),
            };
          }

          const material = primitive.getMaterial();
          if (material) {
            const materialDefinition: MaterialDefinition = primitiveDefinition.material = {
              name: material.getName(),
              alpha: {
                mode: material.getAlphaMode(),
                cutoff: material.getAlphaCutoff(),
              },
            };
            const diffuseColor = material.getBaseColorFactor();
            if (diffuseColor) {
              materialDefinition.diffuseColor = new Color4(
                diffuseColor[0] * 0xFF,
                diffuseColor[1] * 0xFF,
                diffuseColor[2] * 0xFF,
                diffuseColor[3] * 0xFF,
              );
            }

            const texture = material.getBaseColorTexture()?.getImage();
            if (texture) {
              const textureInfo = material.getBaseColorTextureInfo()!;
              const textureCoord = textureInfo?.getTexCoord();
              materialDefinition.texture = {
                buffer: texture,
                texCoord: textureCoord,
              };
            }

            // @TODO Should we support it?
            // const isDoubleSided = material.getDoubleSided();
          }

          meshDefinition.primitives.push(primitiveDefinition);
        }
      } else if (DEBUG_DRAW_BONES) {
        /* @TODO @DEBUG Probably remove this. */
        const size = 0.10;
        nodeDefinition.mesh = {
          primitives: [
            {
              mode: WebGL2RenderingContext.TRIANGLES,
              positionData: {
                buffer: new Float32Array([
                  // Front face (z = size) - indices 0-3
                  -size, -size, size,
                  size, -size, size,
                  size, size, size,
                  -size, size, size,

                  // Right face (x = size) - indices 4-7
                  size, -size, size,
                  size, -size, -size,
                  size, size, -size,
                  size, size, size,

                  // Back face (z = -size) - indices 8-11
                  size, -size, -size,
                  -size, -size, -size,
                  -size, size, -size,
                  size, size, -size,

                  // Left face (x = -size) - indices 12-15
                  -size, -size, -size,
                  -size, -size, size,
                  -size, size, size,
                  -size, size, -size,

                  // Top face (y = size) - indices 16-19
                  -size, size, size,
                  size, size, size,
                  size, size, -size,
                  -size, size, -size,

                  // Bottom face (y = -size) - indices 20-23
                  -size, -size, -size,
                  size, -size, -size,
                  size, -size, size,
                  -size, -size, size,
                ]),
                normalized: false,
                componentCount: 3,
                componentSize: 4,
                componentType: WebGL2RenderingContext.FLOAT,
              },
              extents: {
                min: new Vector3(-size, -size, -size),
                max: new Vector3(size, size, size),
              },
              normalData: {
                buffer: new Float32Array([
                  // Front face (pointing towards +Z)
                  0.0, 0.0, 1.0,
                  0.0, 0.0, 1.0,
                  0.0, 0.0, 1.0,
                  0.0, 0.0, 1.0,

                  // Right face (pointing towards +X)
                  1.0, 0.0, 0.0,
                  1.0, 0.0, 0.0,
                  1.0, 0.0, 0.0,
                  1.0, 0.0, 0.0,

                  // Back face (pointing towards -Z)
                  0.0, 0.0, -1.0,
                  0.0, 0.0, -1.0,
                  0.0, 0.0, -1.0,
                  0.0, 0.0, -1.0,

                  // Left face (pointing towards -X)
                  -1.0, 0.0, 0.0,
                  -1.0, 0.0, 0.0,
                  -1.0, 0.0, 0.0,
                  -1.0, 0.0, 0.0,

                  // Top face (pointing towards +Y)
                  0.0, 1.0, 0.0,
                  0.0, 1.0, 0.0,
                  0.0, 1.0, 0.0,
                  0.0, 1.0, 0.0,

                  // Bottom face (pointing towards -Y)
                  0.0, -1.0, 0.0,
                  0.0, -1.0, 0.0,
                  0.0, -1.0, 0.0,
                  0.0, -1.0, 0.0,
                ]),
                normalized: false,
                componentCount: 3,
                componentSize: 4,
                componentType: WebGL2RenderingContext.FLOAT,
              },
              indices: {
                buffer: new Uint8Array([
                  0, 1, 2, 2, 3, 0,       // Front face
                  4, 5, 6, 6, 7, 4,       // Right face
                  8, 9, 10, 10, 11, 8,    // Back face
                  12, 13, 14, 14, 15, 12, // Left face
                  16, 17, 18, 18, 19, 16, // Top face
                  20, 21, 22, 22, 23, 20, // Bottom face
                ]),
                type: WebGL2RenderingContext.UNSIGNED_BYTE,
              },
            },
          ],
        };
      }

      const skin = node.getSkin();
      if (skin) {
        const skinDefinition: SkinDefinition = nodeDefinition.skin = {
          jointNodeIndices: [],
          inverseBindMatrices: [],
        };
        console.log(`Node '${nodeDefinition.name}' has skin`);
        // @TODO skeleton (root node) ?
        skinDefinition.jointNodeIndices = skin.listJoints().map((jointNode) => allNodes.indexOf(jointNode));

        const inverseBindMatricesAccessor = skin.getInverseBindMatrices();
        if (inverseBindMatricesAccessor) {
          skinDefinition.inverseBindMatrices = mapBufferChunks(
            inverseBindMatricesAccessor.getArray() as Float32Array<ArrayBuffer>,
            16,
            (values) => new Matrix4(values),
          );
        } else {
          skinDefinition.inverseBindMatrices = skinDefinition.jointNodeIndices.map(() => new Matrix4());
        }
      }

      console.log(`Node '${nodeDefinition.name}' definition: `, nodeDefinition);
      allNodeDefinitions.push(nodeDefinition);
      reverseNodeLookup.push([node, nodeDefinition]);
    }
    // Iterate again to build hierarchy
    for (const node of allNodes) {
      const nodeDefinition = lookupNodeDefinition(node);
      const parent = node.getParentNode();
      if (parent) {
        const parentDefinition = lookupNodeDefinition(parent);
        parentDefinition.children.push(nodeDefinition);
      }
    }

    function lookupNodeDefinition(node: Node): NodeDefinition {
      for (const [src, definition] of reverseNodeLookup) {
        if (src === node) {
          return definition;
        }
      }
      throw new Error(`No corresponding node definition for node '${node.getName()}'`);
    }

    const allAnimationDefinitions: AnimationDefinition[] = [];
    for (const animation of root.listAnimations()) {
      const animationDefinition: AnimationDefinition = {
        name: animation.getName(),
        channels: [],
        length: 0,
      };
      for (const channel of animation.listChannels()) {
        const targetNode = channel.getTargetNode();
        if (!targetNode) continue; // Ignore channels with no target, unsupported

        const sampler = channel.getSampler()!;

        // @TODO
        if (sampler.getInterpolation() === 'CUBICSPLINE') {
          throw new Error(`CUBICSPLINE interpolation is not yet implemented`);
        }

        const inputAccessor = sampler.getInput()!;
        if (inputAccessor.getComponentType() !== WebGL2RenderingContext.FLOAT) {
          throw new Error(`Invalid animation sampler input: Accessor type must be GL_FLOAT`);
        }

        const outputAccessor = sampler.getOutput()!;
        if (inputAccessor.getComponentType() !== WebGL2RenderingContext.FLOAT) {
          throw new Error(`Invalid animation sampler output: Accessor type must be GL_FLOAT`);
        }

        /*
          @TODO
          Samplers using CUBICSPLINE interpolation will also contain in/out tangents in the output, with the layout:

          in1, value1, out1, in2, value2, out2, in3, value3, out3, ...
         */

        // @TODO CUBICSPLINE!!!!! Can't read output like this for that scenario.
        let outputValues: AnimationChannelValues;
        switch (outputAccessor.getType()) {
          case 'SCALAR':
            outputValues = {
              type: 'scalar',
              values: mapBufferChunks(outputAccessor.getArray() as Float32Array<ArrayBuffer>, 1, ([c]) => c),
            };
            break;
          case 'VEC2':
            outputValues = {
              type: 'vec2',
              values: mapBufferChunks(outputAccessor.getArray() as Float32Array<ArrayBuffer>, 2, ([x, y]) => new Vector2(x, y)),
            };
            break;
          case 'VEC3':
            outputValues = {
              type: 'vec3',
              values: mapBufferChunks(outputAccessor.getArray() as Float32Array<ArrayBuffer>, 3, ([x, y, z]) => new Vector3(x, y, z)),
            };
            break;
          case 'VEC4':
            outputValues = {
              type: 'quat',
              values: mapBufferChunks(outputAccessor.getArray() as Float32Array<ArrayBuffer>, 4, ([x, y, z, w]) => new Quaternion(x, y, z, w)),
            };
            break;
          default:
            throw new Error(`Unsupported animation type: ${outputAccessor.getType()}, Animation target: ${lookupNodeDefinition(targetNode).name}['${channel.getTargetPath()}']`);
        }

        // Keep track of longest samplers
        const channelLength = inputAccessor.getMax([])[0]; // @TODO Why is this API like this? What's with the arrays?
        if (channelLength > animationDefinition.length) {
          animationDefinition.length = channelLength;
        }

        const channelDefinition: AnimationChannelDefinition = {
          targetNode: lookupNodeDefinition(targetNode),
          targetNodeProperty: channel.getTargetPath()!,
          timestamps: inputAccessor.getArray() as Float32Array,
          values: outputValues,
          interpolation: sampler.getInterpolation(),
        };

        animationDefinition.channels.push(channelDefinition);
      }

      console.log(`Animation '${animationDefinition.name}':`, animationDefinition);
      allAnimationDefinitions.push(animationDefinition);
    }

    // Create nodes from definitions
    const nodes = await Promise.all(
      allNodeDefinitions
        .map((nodeDefinition) =>
          MeshNode.fromDefinition(engine, nodeDefinition),
        ));

    // Build skins
    allNodeDefinitions.forEach((nodeDefinition, i) => {
      if (nodeDefinition.skin) {
        const skeleton = nodeDefinition.skin.jointNodeIndices.map((jointNodeIndex) => nodes[jointNodeIndex]);
        nodes[i].setSkin(new MeshSkin(skeleton, nodeDefinition.skin.inverseBindMatrices));
      }
    });

    const lookupNode = (nodeDefinition: NodeDefinition): MeshNode => {
      for (const node of nodes) {
        if (node.definition === nodeDefinition) {
          return node;
        }
      }
      throw new Error(`No corresponding node for node definition '${nodeDefinition.name}'`);
    };

    // Establish hierarchy
    for (const nodeDefinition of allNodeDefinitions) {
      const node = lookupNode(nodeDefinition);
      for (const childDefinition of nodeDefinition.children) {
        const child = lookupNode(childDefinition);
        node.addChild(child);
      }
    }

    // Set transforms
    for (const nodeDefinition of allNodeDefinitions) {
      const node = lookupNode(nodeDefinition);
      node.position = nodeDefinition.transform.position;
      node.rotation.set(nodeDefinition.transform.rotation);
      node.scale = nodeDefinition.transform.scale;
    }

    // Animations
    const allAnimations = [];
    for (const animationDefinition of allAnimationDefinitions) {
      const animation = Animation.fromDefinition(nodes, animationDefinition);
      allAnimations.push(animation);
    }

    console.log(`Experiment data (definitions): `, allNodeDefinitions, allAnimationDefinitions);
    console.log(`Experiment data: `, nodes, allAnimations);
    return new GltfExperiment(scene, nodes, allAnimations);
  }

  public playAnimation(animationName: string, speed: number = 1): void {
    const animation = this.allAnimations.find((animation) => animation.name === animationName);
    if (!animation) {
      throw new Error(`Cannot play animation. No animation exists with name '${animationName}'`);
    }
    this.currentAnimation = animation;
    this.currentAnimationTime = 0;
    this.debug_currentAnimationSpeed = speed;
  }

  public override onUpdate(dt: number): void {
    dt *= this.debug_currentAnimationSpeed; // @TODO @DEBUG
    if (this.currentAnimation) {
      for (const channel of this.currentAnimation.channels) {
        // @TODO we should probably move all of this into `Channel` anyways
        // @TODO we should probably move all of this into `Channel` anyways
        // @TODO we should probably move all of this into `Channel` anyways
        if (channel.timestamps.length === 1) {
          // @NOTE Special case, animation just has 1 keyframe /shrug
          channel.assignAnimatedValue(0, undefined, this.currentAnimationTime);
          continue;
        }

        // Find which 2 timestamps the current animation time lays between
        let previousTimestampIndex: number | undefined = undefined;
        let nextTimestampIndex: number | undefined = undefined;
        for (let i = 0; i < channel.timestamps.length; i++) {
          const timestamp = channel.timestamps[i];
          if (timestamp <= this.currentAnimationTime) {
            previousTimestampIndex = i;
          } else {
            nextTimestampIndex = i;
            break;
          }
        }

        // Pass off to animation channel to assign correct value
        // @NOTE For fucks sake TypeScript
        if (previousTimestampIndex !== undefined && nextTimestampIndex === undefined) {
          channel.assignAnimatedValue(previousTimestampIndex, nextTimestampIndex, this.currentAnimationTime);
        } else if (previousTimestampIndex === undefined && nextTimestampIndex !== undefined) {
          channel.assignAnimatedValue(previousTimestampIndex, nextTimestampIndex, this.currentAnimationTime);
        } else if (previousTimestampIndex !== undefined && nextTimestampIndex !== undefined) {
          channel.assignAnimatedValue(previousTimestampIndex, nextTimestampIndex, this.currentAnimationTime);
        } else {
          throw new Error(`Logic error when playing animation '${this.currentAnimation.name}', can't locate index of current animation time within animation timestamps. (currentAnimationTime='${this.currentAnimationTime}') (timestamps='${channel.timestamps.join(',')}')`);
        }
      }
      this.currentAnimationTime += dt;
      if (this.currentAnimationTime > this.currentAnimation.length) {
        this.currentAnimationTime %= this.currentAnimation.length;
      }
    }
  }

  public getDrawTasks(engine: IEngine): DrawTask[] {
    const viewMatrix = engine.activeScene?.activeCamera?.viewMatrix;
    if (viewMatrix === undefined) {
      // No scene or no camera = no draw tasks
      return [];
    }

    return [{
      draw: () => {
        const drawQueues: DrawQueues = {
          opaque: [],
          transparent: [],
        };

        for (const node of this.nodes) {
          node.draw2(drawQueues, viewMatrix, this.worldMatrix);
        }

        sortDrawTasks(drawQueues.opaque);
        drawQueues.transparent.sort((drawTaskA, drawTaskB) => drawTaskA.depth - drawTaskB.depth);

        this.drawQueue(engine, drawQueues.opaque);
        this.drawQueue(engine, drawQueues.transparent);
      },
      layer: 0,
    }];
  }

  private drawQueue(engine: IEngine, drawQueue: DrawTask2[]): void {
    const { gl } = engine;

    let currentGlProgram: ShaderProgram2 = undefined!;
    let currentMaterial: Material2 = undefined!;
    let currentMesh: DrawTask2['mesh'] = undefined!;

    for (const task of drawQueue) {

      /* GL Program */
      if (currentGlProgram !== task.glProgram) {
        currentGlProgram = task.glProgram;
        gl.useProgram(task.glProgram.program);
      }

      /* Material */
      if (currentMaterial !== task.material) {
        currentMaterial = task.material;
        const diffuseColorUniform = currentGlProgram.getUniform('diffuseColor');
        if (task.material.diffuseColor !== undefined && diffuseColorUniform) {
          gl.uniform4fv(diffuseColorUniform, new Float32Array([
            task.material.diffuseColor.r / 255,
            task.material.diffuseColor.g / 255,
            task.material.diffuseColor.b / 255,
            task.material.diffuseColor.a / 255,
            // 1, 1, 1, 1,
          ]));
        }

        // Blending
        switch (task.material.blendingMode.type) {
          case 'None':
            // No blending. No-op.
            break;
          case 'Average':
            // Average blending:
            //   Transparent pixel (alpha = 0.5):   0.5 * src + 0.5 * dest
            //   Opaque pixel (alpha = 1):          1 * src + 0 * dest
            gl.enable(gl.BLEND);
            gl.depthMask(false);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            break;
          case 'Additive':
            // Additive blending:
            //   Transparent pixel (alpha = 0):     1 * src + 1 * dest
            //   Opaque pixel (alpha = 1):          1 * src + 0 * dest
            gl.enable(gl.BLEND);
            gl.depthMask(false);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            break;
          case 'Subtractive':
            // Subtractive blending:
            //   Transparent pixel (alpha = 0):     1 * src - 1 * dest
            //   Opaque pixel (alpha = 1):          1 * src - 0 * dest
            gl.enable(gl.BLEND);
            gl.depthMask(false);
            gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            break;
          case 'AlphaBlend':
            // Alpha blending:
            //   Transparent pixel (alpha = X):     X * src + (1-X) * dest
            //   Opaque pixel (alpha = 1):          1 * src + 0 * dest
            gl.enable(gl.BLEND);
            gl.depthMask(false);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            break;
          case 'AlphaClip': {
            // Alpha clipping:
            //  No blending.
            //  Transparent pixel (alpha < cutoff):  0 * src + 1 * dest (discarded)
            //  Opaque pixel (alpha >= cutoff):      1 * src + 0 * dest
            const alphaCutoffUniform = currentGlProgram.getUniform('alphaCutoff');
            if (alphaCutoffUniform) {
              gl.uniform1f(alphaCutoffUniform, task.material.blendingMode.cutoff);
            }
            break;
          }
          default:
            throw new Error(`Unimplemented blending mode: ${(task.material.blendingMode as { type: unknown }).type}`);
        }

        // Texture
        const textureSamplerUniform = currentGlProgram.getUniform('sampler');
        if (textureSamplerUniform && task.material.diffuseTexture) {
          const textureIndex = 0; // @TODO ?
          gl.activeTexture(gl.TEXTURE0 + textureIndex);
          gl.bindTexture(gl.TEXTURE_2D, task.material.diffuseTexture.texture);
          gl.uniform1i(textureSamplerUniform, textureIndex);
        } else {
          gl.bindTexture(gl.TEXTURE_2D, null);
        }
      }

      /* Uniforms */
      // World matrix uniform
      const worldMatrixUniform = currentGlProgram.getUniform('worldMatrix');
      if (worldMatrixUniform) {
        gl.uniformMatrix4fv(worldMatrixUniform, false, task.uniforms.worldMatrix.toArray());
      }

      // Lighting uniform
      const normalMatrixUniform = currentGlProgram.getUniform('normalMatrix');
      if (normalMatrixUniform) {
        try {
          this._normalTmp.normalSelf(task.uniforms.worldMatrix);
        } catch (e) {
          // @NOTE Don't render if matrix cannot invert (e.g. scale=0)
          if (e instanceof CannotInvertMatrixError) return;
          else throw e;
        }
        gl.uniformMatrix3fv(normalMatrixUniform, false, this._normalTmp.toArray());
      }

      // Joint matrices uniform
      const jointMatrixUniform = currentGlProgram.getUniform('jointMatrix');
      if (task.uniforms.skinWeights && jointMatrixUniform) {
        gl.uniformMatrix4fv(jointMatrixUniform, false, task.uniforms.skinWeights);
      }

      /* Mesh */
      if (task.mesh !== currentMesh) {
        currentMesh = task.mesh;
        gl.bindVertexArray(task.mesh.vao);
      }

      currentMesh.draw();
    }

    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.depthMask(true);
  }
}


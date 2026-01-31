import { Accessor, WebIO, type GLTF, type TypedArray, Node, Document } from '@gltf-transform/core';
import type { IFileSystem } from '@polyzone/engine/filesystem';
import { canonicalisePath } from './util/path';
import type { IEngine } from './Engine';
import { createBuffer } from './util/createBuffer';

import VertexShaderSource from '@polyzone/engine/materials/shaders/newShader.vert?raw';
import FragmentShaderSource from '@polyzone/engine/materials/shaders/newShader.frag?raw';
import { getAttribute, getUniform, ShaderBlendingMode } from './materials/ShaderProgram';
import { CameraUboIndex } from './scene/nodes/CameraNode';
import { LightingUboIndex } from './scene/SceneLighting';
import type { Color4 } from './util/Color4';
import { CannotInvertMatrixError, Matrix3 } from './util/Matrix3';
import { DrawableSceneNode, type DrawTask, type IScene } from './scene';
import { Matrix4 } from './util/Matrix4';
import { Transform } from './util/Transform';
import { Vector2, Vector3 } from './util/vector';
import { Quaternion } from './util/quaternion';
import type { Rotation } from './util/Rotation';
import { inverseLerp, lerp } from './util/math';
import { mapBufferChunks } from './util/array';

const GlbMagic = [0x67, 0x6C, 0x54, 0x46];
const DEBUG_DRAW_BONES = false;

/*
  @TODO Things we should maybe do
    - pass through vertex attribute byte length
    // - animation samples have weird scaling bug (?)
    - gltfExperiment transform seems to be ignored (?)
    - Rename animation.length to `lengthSeconds`
    - Rename `channels` to `tracks`?
    - "looping" flags and such
    - reset state when stop playing
    - Material: Color, texture
    - "How many things?" when drawing mesh primitive from non-indexed buffer
    - AttributeDefinition missing properties
    - MeshPrimitiveDefinition.indicesBuffer store type
    - Walk from scene entrypoint rather than read all nodes
 */

interface AttributeDefinition {
  buffer: TypedArray;
  size: number;
  // @TODO byteSize
  // @TODO count ?
  type: GLTF.AccessorComponentType;
  normalized: boolean;
}
interface MeshPrimitiveDefinition {
  positionData: AttributeDefinition;      // VEC3
  normalData?: AttributeDefinition;       // VEC3
  texCoord0Data?: AttributeDefinition;    // VEC2
  color0Data?: AttributeDefinition;       // VEC3 or VEC4
  joints0Data?: AttributeDefinition;      // VEC4
  weights0Data?: AttributeDefinition;     // VEC4
  indicesBuffer?: TypedArray;             // SCALAR (unsigned int) // @TODO store type e.g. gl.UNSIGNED_SHORT
  // @TODO count? indexed or not?
  mode: GLTF.MeshPrimitiveMode;
  // @TODO material
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

interface LoadedState {
  engine: IEngine;
  allNodeDefinitions: NodeDefinition[];
  allAnimationDefinitions: AnimationDefinition[];
}

export interface ShaderProgramOptions {
  hasDiffuseColor: boolean;
  hasVertexColors: boolean;
  hasDiffuseTexture: boolean;
  blendingMode: ShaderBlendingMode; // @TODO Should we just pass the material reference?
  blackIsTransparent: boolean; // @NOTE specifically regarding the sampled texture. Should maybe rename.
  unlit: boolean;
  numJointBones: number; // @TODO This whole thing is jank
}
export class ShaderProgramNew {
  public readonly name: string;
  public readonly program: WebGLProgram;
  // @TODO configurable attributes through extends?
  public readonly vertexPositionAttribute: number;
  public readonly vertexNormalAttribute: number;
  public readonly vertexColorAttribute: number | undefined;
  public readonly vertexJointsAttribute: number | undefined;
  public readonly vertexWeightsAttribute: number | undefined;


  public readonly normalMatrixUniform: WebGLUniformLocation;
  public readonly worldMatrixUniform: WebGLUniformLocation | undefined;
  public readonly diffuseColorUniform: WebGLUniformLocation | undefined;
  public readonly jointMatrixUniform: WebGLUniformLocation | undefined;

  public constructor(engine: IEngine, name: string, options: ShaderProgramOptions) {
    const { gl } = engine;

    this.name = name;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    const program = this.program = gl.createProgram();

    if (!vertexShader || !fragmentShader || !program) {
      throw new Error(`Failed to allocate GL objects`);
    }

    function inject(name: string, injected: string, src: string): string {
      return src.replace(new RegExp(`#pragma\\s+inject\\s*\\(\\s*${name}\\s*\\)\\s*$`, "m"), injected);
    }
    const definesBlock = `#define _ShaderName ${name}\n` + ShaderProgramNew.getDefinesFromShaderOptions(options)
      .map((define) => `#define ${define}`).join('\n') + '\n';
    const vertexShaderSource = inject('defines', definesBlock, VertexShaderSource);
    gl.shaderSource(vertexShader, vertexShaderSource);
    const fragmentShaderSource = inject('defines', definesBlock, FragmentShaderSource);
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

    this.vertexPositionAttribute = getAttribute(gl, program, 'vertexPosition', true);
    this.vertexNormalAttribute = getAttribute(gl, program, 'vertexNormal', true);
    this.vertexColorAttribute = getAttribute(gl, program, 'vertexColor', false);
    this.vertexJointsAttribute = getAttribute(gl, program, 'vertexJoints', false);
    this.vertexWeightsAttribute = getAttribute(gl, program, 'vertexWeights', false);
    // this.vertexTextureCoordinateAttribute = getAttribute(gl, program, 'textureCoord', true);

    this.worldMatrixUniform = getUniform(gl, program, 'worldMatrix', false);
    this.normalMatrixUniform = getUniform(gl, program, 'normalMatrix', true);
    this.diffuseColorUniform = getUniform(gl, program, 'diffuseColor', false);
    this.jointMatrixUniform = getUniform(gl, program, 'jointMatrix', false);
    // this.textureSamplerUniform = getUniform(gl, program, 'sampler', false);

    const cameraUboBlockIndex = gl.getUniformBlockIndex(this.program, "Camera");
    gl.uniformBlockBinding(this.program, cameraUboBlockIndex, CameraUboIndex);
    const lightingUboBlockIndex = gl.getUniformBlockIndex(this.program, "Lighting");
    gl.uniformBlockBinding(this.program, lightingUboBlockIndex, LightingUboIndex);
  }

  private static getDefinesFromShaderOptions(options: ShaderProgramOptions): string[] {
    const defines: string[] = [];

    if (options.hasDiffuseColor) {
      defines.push('DIFFUSE_COLOR');
    }

    if (options.hasVertexColors) {
      defines.push('VERTEX_COLORS');
    }

    if (options.numJointBones) {
      defines.push('SKIN', 'NUM_BONES ' + options.numJointBones);
    }

    if (options.hasDiffuseTexture) {
      defines.push('DIFFUSE_TEXTURE');
    }

    switch (options.blendingMode) {
      case ShaderBlendingMode.None:
        /* No blending, will set alpha = 1.0 in shader by default */
        break;
      case ShaderBlendingMode.Average:
        /* Averaged blending. Transparent pixels set to alpha=0.5f for blending */
        defines.push('FIXED_TRANSPARENCY_ALPHA 0.5f');
        break;
      case ShaderBlendingMode.Additive:
        /* Additive blending. Transparent pixels set to alpha=0.0f for blending */
        defines.push('FIXED_TRANSPARENCY_ALPHA 0.0f');
        break;
      case ShaderBlendingMode.Subtractive:
        /* Subtractive blending. Transparent pixels set to alpha=0.0f for blending */
        defines.push('FIXED_TRANSPARENCY_ALPHA 0.0f');
        break;
      case ShaderBlendingMode.SourceAlpha:
        /* Source alpha - do not manipulate shader output alpha */
        defines.push('USE_SOURCE_ALPHA_FOR_TRANSPARENCY');
        break;
      default:
        throw new Error(`Unimplemented blending mode: '${options.blendingMode}'`);
    }

    if (options.blackIsTransparent) {
      defines.push("BLACK_IS_TRANSPARENT");
    }

    if (options.unlit) {
      defines.push("UNLIT");
    }

    return defines;
  }
}

export interface MaterialConstructorArgs {
  diffuseColor?: Color4;
  numJointBones?: number;
  // diffuseTexture?: Texture;
}
export interface MaterialConstructorOptions {
  hasVertexColors?: boolean;
  blendingMode?: ShaderBlendingMode;
  blackIsTransparent?: boolean;
  unlit?: boolean;
}

export class MaterialNew {
  public readonly name: string;
  public readonly shader: ShaderProgramNew;

  public diffuseColor: Color4 | undefined;
  public blendingMode: ShaderBlendingMode;

  public constructor(engine: IEngine, name: string, args: MaterialConstructorArgs, options: MaterialConstructorOptions) {
    this.name = name;
    this.diffuseColor = args.diffuseColor;

    this.blendingMode = options.blendingMode ?? ShaderBlendingMode.None;

    this.shader = new ShaderProgramNew(engine, name, {
      hasDiffuseColor: !!args.diffuseColor,
      hasVertexColors: !!options.hasVertexColors,
      // hasDiffuseTexture: !!args.diffuseTexture,
      numJointBones: args.numJointBones ?? 0,
      hasDiffuseTexture: false,
      blendingMode: this.blendingMode,
      blackIsTransparent: options.blackIsTransparent ?? false,
      unlit: options.unlit ?? false,
    });
  }
}

export class SubMeshNew {
  private readonly vao: WebGLVertexArrayObject;
  private readonly material: MaterialNew;
  private readonly primitiveDefinition: MeshPrimitiveDefinition;

  private _normalTmp: Matrix3 = new Matrix3();

  public constructor(engine: IEngine, primitive: MeshPrimitiveDefinition, material: MaterialNew) {
    const { gl } = engine;

    this.material = material;
    this.primitiveDefinition = primitive;

    this.vao = gl.createVertexArray();
    if (!this.vao) {
      throw new Error('Failed to create VAO');
    }

    gl.bindVertexArray(this.vao);

    gl.enableVertexAttribArray(material.shader.vertexPositionAttribute);
    gl.enableVertexAttribArray(material.shader.vertexNormalAttribute);
    if (material.shader.vertexColorAttribute) {
      gl.enableVertexAttribArray(material.shader.vertexColorAttribute);
    }
    if (material.shader.vertexJointsAttribute) {
      gl.enableVertexAttribArray(material.shader.vertexJointsAttribute);
    }
    if (material.shader.vertexWeightsAttribute) {
      gl.enableVertexAttribArray(material.shader.vertexWeightsAttribute);
    }

    /* Vertex positions */
    // @TODO can probably do all in one go for AttributeDefinition
    {
      const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, primitive.positionData.buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(
        material.shader.vertexPositionAttribute,
        primitive.positionData.size,
        primitive.positionData.type,
        primitive.positionData.normalized,
        3 * Float32Array.BYTES_PER_ELEMENT, // @TODO
        0,
      );
    }

    /* Vertex normals */
    // @TODO generate normals somewhere
    if (primitive.normalData) {
      const normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, primitive.normalData.buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
      gl.vertexAttribPointer(
        material.shader.vertexNormalAttribute,
        primitive.normalData.size,
        primitive.normalData.type,
        primitive.normalData.normalized,
        3 * Float32Array.BYTES_PER_ELEMENT, // @TODO
        0,
      );
    } else {
      throw new Error(`Missing normals - we must generate them`);
    }

    /* Vertex colors */
    if (material.shader.vertexColorAttribute && primitive.color0Data) {
      const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, primitive.color0Data.buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.vertexAttribPointer(
        material.shader.vertexColorAttribute,
        primitive.color0Data.size,
        primitive.color0Data.type,
        primitive.color0Data.normalized,
        4 * Uint8Array.BYTES_PER_ELEMENT, // @TODO
        0,
      );
    }

    /* Joint indices */
    if (material.shader.vertexJointsAttribute && primitive.joints0Data) {
      const jointsBuffer = createBuffer(gl, gl.ARRAY_BUFFER, primitive.joints0Data.buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, jointsBuffer);
      gl.vertexAttribPointer(
        material.shader.vertexJointsAttribute,
        primitive.joints0Data.size,
        primitive.joints0Data.type,
        primitive.joints0Data.normalized,
        4 * Uint8Array.BYTES_PER_ELEMENT, // @TODO
        0,
      );
    }
    /* Joint weights */
    if (material.shader.vertexWeightsAttribute && primitive.weights0Data) {
      const weightsBuffer = createBuffer(gl, gl.ARRAY_BUFFER, primitive.weights0Data.buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, weightsBuffer);
      gl.vertexAttribPointer(
        material.shader.vertexWeightsAttribute,
        primitive.weights0Data.size,
        primitive.weights0Data.type,
        primitive.weights0Data.normalized,
        4 * Float32Array.BYTES_PER_ELEMENT, // @TODO
        0,
      );
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    /* Indexed geometry */
    if (primitive.indicesBuffer) {
      console.log(`Primitive has indexed geometry:`, primitive);
      const indicesBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, primitive.indicesBuffer);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);
    }

    gl.bindVertexArray(null);
  }

  public draw(
    engine: IEngine,
    worldMatrix: Matrix4,
    jointMatrices: Matrix4[] | undefined,
  ): void {
    const { gl } = engine;

    gl.useProgram(this.material.shader.program);
    // World matrix
    if (this.material.shader.worldMatrixUniform) {
      gl.uniformMatrix4fv(this.material.shader.worldMatrixUniform, false, worldMatrix.toArray());
    }

    // Joint matrices
    if (jointMatrices && this.material.shader.jointMatrixUniform) {
      const jointMatricesBytes = new Float32Array(jointMatrices.length * 16); // @TODO Don't allocate every frame
      jointMatrices.forEach((jointMatrix, index) => {
        jointMatricesBytes.set(jointMatrix.toArray(), index * 16);
      });
      gl.uniformMatrix4fv(this.material.shader.jointMatrixUniform, false, jointMatricesBytes);
    }

    // Material
    if (this.material.shader.diffuseColorUniform) {
      gl.uniform4fv(this.material.shader.diffuseColorUniform, new Float32Array([
        // @TODO material
        // this.material.diffuseColor.r / 255,
        // this.material.diffuseColor.g / 255,
        // this.material.diffuseColor.b / 255,
        // this.material.diffuseColor.a / 255,
        1, 1, 1, 1,
      ]));
    }

    // Blending
    switch (this.material.blendingMode) {
      case ShaderBlendingMode.None:
        // No blending. No-op.
        break;
      case ShaderBlendingMode.Average:
        // Average blending:
        //   Transparent pixel (alpha = 0.5):   0.5 * src + 0.5 * dest
        //   Opaque pixel (alpha = 1):          1 * src + 0 * dest
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        break;
      case ShaderBlendingMode.Additive:
        // Additive blending:
        //   Transparent pixel (alpha = 0):     1 * src + 1 * dest
        //   Opaque pixel (alpha = 1):          1 * src + 0 * dest
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        break;
      case ShaderBlendingMode.Subtractive:
        // Subtractive blending:
        //   Transparent pixel (alpha = 0):     1 * src - 1 * dest
        //   Opaque pixel (alpha = 1):          1 * src - 0 * dest
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        break;
      case ShaderBlendingMode.SourceAlpha:
        // "Source alpha" blending:
        //   Transparent pixel (alpha = X):     X * src + (1-X) * dest
        //   Opaque pixel (alpha = 1):          1 * src + 0 * dest
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        break;
    }

    // Texture
    // if (this.material.diffuseTexture) {
    //   const textureIndex = 0;
    //   gl.activeTexture(gl.TEXTURE0 + textureIndex);
    //   gl.bindTexture(gl.TEXTURE_2D, this.material.diffuseTexture.texture);
    //   gl.uniform1i(this.material.shader.textureSamplerUniform!, textureIndex);
    // } else {
    // gl.bindTexture(gl.TEXTURE_2D, null);
    // }

    // Lighting
    try {
      this._normalTmp.normalSelf(worldMatrix);
    } catch (e) {
      // @NOTE Don't render if matrix cannot invert (e.g. scale=0)
      if (e instanceof CannotInvertMatrixError) return;
      else throw e;
    }
    gl.uniformMatrix3fv(this.material.shader.normalMatrixUniform, false, this._normalTmp.toArray());

    // Draw
    gl.bindVertexArray(this.vao);
    if (this.primitiveDefinition.indicesBuffer) {
      // Indexed geometry
      gl.drawElements(this.primitiveDefinition.mode, this.primitiveDefinition.indicesBuffer.length, gl.UNSIGNED_SHORT, 0);
    } else {
      // @TODO How many things?
      gl.drawArrays(this.primitiveDefinition.mode, 0, this.primitiveDefinition.positionData.buffer.length);
    }
    gl.bindVertexArray(null);

    gl.disable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.depthMask(true);
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

  public static fromDefinition(engine: IEngine, definition: NodeDefinition): MeshNode {
    const meshPrimitives: SubMeshNew[] = [];
    if (definition.mesh) {
      for (const meshPrimitiveDefinition of definition.mesh.primitives) {
        // @TODO Instances of MeshNode are distinct but share SubMeshes/Primitives
        const material = new MaterialNew(engine, 'gltf_experiment', {
          numJointBones: definition.skin ? definition.skin.jointNodeIndices.length : 0,
        }, {

        });
        const subMesh = new SubMeshNew(engine, meshPrimitiveDefinition, material);
        meshPrimitives.push(subMesh);
      }
    }
    return new MeshNode({
      name: definition.name,
      meshPrimitives: meshPrimitives,
      definition,
    });
  }

  public draw(
    engine: IEngine,
    _viewModelMatrix: Matrix4,
    worldMatrix: Matrix4,
  ): void {
    if (this.meshPrimitives.length === 0) return; // @NOTE Don't bother doing math unless we need it

    this._worldMatrixTmp.setValue(worldMatrix).multiplySelf(this.worldMatrix);

    if (this.skin !== undefined) {
      this.skin.skeleton.forEach((bone, i) => {
        this._jointMatricesTmp![i].setValue(bone.worldMatrix).multiplySelf(this.skin!.inverseBindMatrices[i]);
      });
    }

    for (const subMesh of this.meshPrimitives) {
      subMesh.draw(engine, this._worldMatrixTmp, this._jointMatricesTmp);
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

export class GltfExperiment extends DrawableSceneNode {
  private readonly nodes: MeshNode[];
  private _viewModelMatrixTmp: Matrix4 = new Matrix4();
  // private readonly allAnimationDefinitions: AnimationDefinition[];
  private readonly allAnimations: Animation[];

  private currentAnimationTime: number = 0;
  private currentAnimation: Animation | undefined;
  private debug_currentAnimationSpeed: number = 1;

  private constructor(scene: IScene, { allNodeDefinitions, allAnimationDefinitions, engine }: LoadedState) {
    super(scene, 'gltf-experiment');

    // Create nodes from definitions
    this.nodes = allNodeDefinitions.map((nodeDefinition) => MeshNode.fromDefinition(engine, nodeDefinition));

    // Build skins
    allNodeDefinitions.forEach((nodeDefinition, i) => {
      if (nodeDefinition.skin) {
        const skeleton = nodeDefinition.skin.jointNodeIndices.map((jointNodeIndex) => this.nodes[jointNodeIndex]);
        this.nodes[i].setSkin(new MeshSkin(skeleton, nodeDefinition.skin.inverseBindMatrices));
      }
    });

    const lookupNode = (nodeDefinition: NodeDefinition): MeshNode => {
      for (const node of this.nodes) {
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
      // node.tr
      node.position = nodeDefinition.transform.position;
      node.rotation.set(nodeDefinition.transform.rotation);
      node.scale = nodeDefinition.transform.scale;
    }

    // Animations
    this.allAnimations = [];
    for (const animationDefinition of allAnimationDefinitions) {
      const animation = Animation.fromDefinition(this.nodes, animationDefinition);
      this.allAnimations.push(animation);
    }

    console.log(`Experiment data: `, this.nodes, this.allAnimations);
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
        size: accessor.getElementSize(),
        type: accessor.getComponentType(),
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
          // @TODO material
          const positionAccessor = primitive.getAttribute('POSITION');
          if (!positionAccessor) {
            console.warn(`Skipping mesh primitive with no POSITION attributes in node '${nodeDefinition.name}'`);
            continue;
          }
          const primitiveDefinition: MeshPrimitiveDefinition = {
            /*
              // @DEBUG
              0 POINTS
              1 LINES
              2 LINE_LOOP
              3 LINE_STRIP
              4 TRIANGLES
              5 TRIANGLE_STRIP
              6 TRIANGLE_FAN
             */
            mode: primitive.getMode(),
            positionData: readVertexAttributes(positionAccessor),
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
            primitiveDefinition.indicesBuffer = indicesAccessor.getArray()!;
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
                size: 3,
                type: WebGL2RenderingContext.FLOAT,
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
                size: 3,
                type: WebGL2RenderingContext.FLOAT,
              },
              indicesBuffer: new Uint16Array([
                0, 1, 2, 2, 3, 0,       // Front face
                4, 5, 6, 6, 7, 4,       // Right face
                8, 9, 10, 10, 11, 8,    // Back face
                12, 13, 14, 14, 15, 12, // Left face
                16, 17, 18, 18, 19, 16, // Top face
                20, 21, 22, 22, 23, 20, // Bottom face
              ]),
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
        // @TODO skeleton (root node)
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

    return new GltfExperiment(scene, { engine, allNodeDefinitions, allAnimationDefinitions });
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
    this._viewModelMatrixTmp
      .setValue(viewMatrix)
      .multiplySelf(this.worldMatrix);

    return [{
      draw: () => {
        for (const node of this.nodes) {
          node.draw(engine, this._viewModelMatrixTmp, this.worldMatrix);
        }
      },
      layer: 0,
    }];
  }
}


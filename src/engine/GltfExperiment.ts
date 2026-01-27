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
import { Matrix3 } from './util/Matrix3';
import { DrawableSceneNode, type DrawTask, type IScene } from './scene';
import { Matrix4 } from './util/Matrix4';
import { Transform } from './util/Transform';
import { Vector3 } from './util/vector';
import { Quaternion } from './util/quaternion';
import type { Rotation } from './util/Rotation';

const GlbMagic = [0x67, 0x6C, 0x54, 0x46];

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
  inverseBindMatrices?: AttributeDefinition;  // MAT4, no translation row
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

interface AnimationChannelDefinition {
  targetNode: NodeDefinition;
  targetNodeProperty: GLTF.AnimationChannelTargetPath;
  timestamps: AttributeDefinition; /* @TODO no `AttributeDefinition` some kind of typed array */        // SCALAR (float)
  values: AttributeDefinition;     /* @TODO no `AttributeDefinition` some kind of typed array */        // SCALAR/VEC2/VEC3/etc
  interpolation: GLTF.AnimationSamplerInterpolation;
}
interface AnimationDefinition {
  name: string;
  channels: AnimationChannelDefinition[];
}

interface LoadedState {
  engine: IEngine;
  allNodeDefinitions: NodeDefinition[];
}

export interface ShaderProgramOptions {
  hasDiffuseColor: boolean;
  hasVertexColors: boolean;
  hasDiffuseTexture: boolean;
  blendingMode: ShaderBlendingMode; // @TODO Should we just pass the material reference?
  blackIsTransparent: boolean; // @NOTE specifically regarding the sampled texture. Should maybe rename.
  unlit: boolean;
}
export class ShaderProgramNew {
  public readonly name: string;
  public readonly program: WebGLProgram;
  // @TODO configurable attributes through extends?
  public readonly vertexPositionAttribute: number;
  public readonly vertexNormalAttribute: number;
  public readonly vertexColorAttribute: number | undefined;

  public readonly normalMatrixUniform: WebGLUniformLocation;
  public readonly worldMatrixUniform: WebGLUniformLocation;
  public readonly diffuseColorUniform: WebGLUniformLocation | undefined;

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
    // const definesBlock = `#define _ShaderName ${name}` + '\n';
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
    // this.vertexTextureCoordinateAttribute = getAttribute(gl, program, 'textureCoord', true);

    this.worldMatrixUniform = getUniform(gl, program, 'worldMatrix', true);
    this.normalMatrixUniform = getUniform(gl, program, 'normalMatrix', true);
    this.diffuseColorUniform = getUniform(gl, program, 'diffuseColor', false);
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

    /* Optional attributes  */
    // const hasNormals = primitive.normalData !== undefined;
    // const normalBuffer = primitive.normalData ? createBuffer(gl, gl.ARRAY_BUFFER, primitive.normalData.buffer) : null;
    // const isIndexedGeometry = primitive.indicesBuffer !== undefined;
    // const indicesBuffer = isIndexedGeometry ? createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, primitive.indicesBuffer!) : null;

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
  ): void {
    const { gl } = engine;

    gl.useProgram(this.material.shader.program);
    // World matrix
    gl.uniformMatrix4fv(this.material.shader.worldMatrixUniform, false, worldMatrix.toArray());

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
    this._normalTmp.normalSelf(worldMatrix);
    gl.uniformMatrix3fv(this.material.shader.normalMatrixUniform, false, this._normalTmp.toArray());

    // Draw
    gl.bindVertexArray(this.vao);
    // gl.drawElements(gl.TRIANGLES, this.geometry.triangles.length * 3, gl.UNSIGNED_SHORT, 0);
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

interface MeshNodeArgs {
  name: string;
  meshPrimitives: SubMeshNew[],
}
export class MeshNode {
  // private children: MeshNode[];
  private meshPrimitives: SubMeshNew[];
  // private _parent: MeshNode | undefined;
  public readonly name: string;

  private transform: Transform<MeshNode>;

  private readonly _worldMatrixTmp: Matrix4 = new Matrix4();

  private constructor({ name, meshPrimitives }: MeshNodeArgs) {
    this.name = name;
    this.meshPrimitives = meshPrimitives;
    this.transform = new Transform<MeshNode>(this);
  }

  public static fromDefinition(engine: IEngine, definition: NodeDefinition): MeshNode {
    const meshPrimitives: SubMeshNew[] = [];
    if (definition.mesh) {
      for (const meshPrimitiveDefinition of definition.mesh.primitives) {
        const material = new MaterialNew(engine, 'default', {

        }, {

        });
        const subMesh = new SubMeshNew(engine, meshPrimitiveDefinition, material);
        meshPrimitives.push(subMesh);
      }
    }
    return new MeshNode({
      name: definition.name,
      meshPrimitives: meshPrimitives,
    });
  }

  public draw(
    engine: IEngine,
    _viewModelMatrix: Matrix4,
    worldMatrix: Matrix4,
  ): void {
    if (this.meshPrimitives.length > 0) { // @NOTE Don't multiply matrix unless we need it
      this._worldMatrixTmp.setValue(worldMatrix).multiplySelf(this.worldMatrix);
      for (const subMesh of this.meshPrimitives) {
        subMesh.draw(engine, this._worldMatrixTmp);
      }
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

  private constructor(scene: IScene, { allNodeDefinitions, engine }: LoadedState) {
    super(scene, 'gltf-experiment');

    this.nodes = [];
    const reverseNodeLookup: Array<[src: NodeDefinition, node: MeshNode]> = [];
    function lookupNode(nodeDefinition: NodeDefinition): MeshNode {
      for (const [src, node] of reverseNodeLookup) {
        if (src === nodeDefinition) {
          return node;
        }
      }
      throw new Error(`No corresponding node for node definition '${nodeDefinition.name}'`);
    }

    // Create nodes from definitions
    for (const nodeDefinition of allNodeDefinitions) {
      const node = MeshNode.fromDefinition(engine, nodeDefinition);
      this.nodes.push(node);
      reverseNodeLookup.push([nodeDefinition, node]);
    }

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

    console.log(`Experiment data: `, this.nodes);
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
      }

      const skin = node.getSkin();
      if (skin) {
        const skinDefinition: SkinDefinition = nodeDefinition.skin = {
          jointNodeIndices: [],
        };
        console.log(`Node '${nodeDefinition.name}' has skin`);
        // @TODO skeleton (root node)
        /*
          vertex attribute has JOINTS_0[n] which is VEC4 of u8 or u16
          skin has list of bone nodes
          bone nodes have matrix
         */
        const inverseBindMatricesAccessor = skin.getInverseBindMatrices();
        if (inverseBindMatricesAccessor) {
          skinDefinition.inverseBindMatrices = readVertexAttributes(inverseBindMatricesAccessor);
        }
        skinDefinition.jointNodeIndices = skin.listJoints().map((jointNode) => allNodes.indexOf(jointNode));
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
      };
      for (const channel of animation.listChannels()) {
        const targetNode = channel.getTargetNode();
        if (!targetNode) continue; // Ignore channels with no target, unsupported

        const sampler = channel.getSampler()!;

        const channelDefinition: AnimationChannelDefinition = {
          targetNode: lookupNodeDefinition(targetNode),
          targetNodeProperty: channel.getTargetPath()!,
          timestamps: readVertexAttributes(sampler.getInput()!),
          values: readVertexAttributes(sampler.getOutput()!),
          interpolation: sampler.getInterpolation(),
        };

        animationDefinition.channels.push(channelDefinition);
      }

      console.log(`Animation '${animationDefinition.name}':`, animationDefinition);
      allAnimationDefinitions.push(animationDefinition);
    }

    return new GltfExperiment(scene, { engine, allNodeDefinitions });
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


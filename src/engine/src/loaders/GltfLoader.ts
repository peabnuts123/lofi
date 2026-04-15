
import { Accessor, WebIO, type GLTF, Node, Document, Material } from '@gltf-transform/core';

import { Matrix4 } from '@lofi/core/math/Matrix4';
import { Vector2, Vector3 } from '@lofi/core/math/vector';
import { Quaternion } from '@lofi/core/math/Quaternion';
import { Color4 } from '@lofi/core/math/Color4';
import { canonicalisePath } from '@lofi/core/util/path';
import type { IFileSystem } from '@lofi/engine/filesystem';
import { mapBufferChunks } from '@lofi/engine/util/array';

import type {
  AnimationChannelDefinition,
  AnimationChannelValues,
  AnimationDefinition,
  AttributeDefinition,
  MaterialDefinition,
  MeshDefinition,
  MeshPrimitiveDefinition,
  ModelDefinition,
  NodeDefinition,
  SkinDefinition,
} from './definitions';

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
    - ? Is it still valuable to process gltf nodes hierarchically

    - gltfExperiment transform seems to be ignored (?)

    - Okay, so what is the API for this stuff?
      - Rename animation.length to `lengthSeconds` ?
      - Rename `channels` to `tracks`?
      - "looping" flags and such
      - reset state when stop playing (? or is it working?)

    - Should we support `doubleSided`?
    - Is skin `skeleton` of any use?
    - Do we need to reuse meshnode instead of instantiating mesh every time … ?
    - Figure out how to decouple Shader from Mesh aka, how to re-use a material on different meshes
    - Animation Retargeting :think:
 */


export abstract class GltfLoader {
  public static async loadModel(gltfPath: string, filesystem: IFileSystem): Promise<ModelDefinition> {
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
    } else {
      const gltfJson = JSON.parse(fileBytes.textContent) as GLTF.IGLTF;
      const resources: Record<string, Uint8Array> = {};

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
        resources[uri] = file.bytes;
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
        resources: resources as Record<string, Uint8Array<ArrayBuffer>>,
      });
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

    /**
     * List of tasks that need to be executed AFTER we've finished processing everything.
     * Usually used to establish links to other nodes and such that might not have been
     * parsed yet while processing.
     */
    const tidyUpTasks: (() => void)[] = [];
    const nodeDefinitionLookup = new Map<Node, NodeDefinition>();
    const materialToDefinitionLookup = new Map<Material, MaterialDefinition>();
    const materialsToLoad = new Set<Material>();

    const root = document.getRoot();
    const defaultScene = root.getDefaultScene();
    let rootNodeDefinitions: NodeDefinition[] = [];
    if (defaultScene) {
      rootNodeDefinitions = defaultScene.listChildren().map((node) => createNodeDefinition(node));
    }

    // Load all unique materials encountered
    for (const material of materialsToLoad) {
      const materialDefinition: MaterialDefinition = {
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
        materialDefinition.diffuseTexture = {
          buffer: texture,
          texCoord: textureCoord,
        };
      }

      // @TODO Should we support it?
      // const isDoubleSided = material.getDoubleSided();

      materialToDefinitionLookup.set(material, materialDefinition);
    }

    function createNodeDefinition(node: Node): NodeDefinition {
      const nodeDefinition: NodeDefinition = {
        name: node.getName(),
        children: [],
        transform: {
          position: new Vector3(...node.getTranslation()),
          rotation: new Quaternion(...node.getRotation()),
          scale: new Vector3(...node.getScale()),
        },
      };

      nodeDefinitionLookup.set(node, nodeDefinition);

      const mesh = node.getMesh();
      if (mesh) {
        const meshDefinition: MeshDefinition = nodeDefinition.mesh = {
          primitives: [],
        };

        for (const primitive of mesh.listPrimitives()) {
          const positionAccessor = primitive.getAttribute('POSITION');
          if (!positionAccessor) {
            console.warn(`Skipping mesh primitive with no POSITION attribute in node '${nodeDefinition.name}'`);
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
            primitiveDefinition.indices = readVertexAttributes(indicesAccessor);
          }

          const material = primitive.getMaterial();
          if (material) {
            // Add material to set of unique materials to load
            materialsToLoad.add(material);

            // Pull from set of loaded materials after processing is finished
            tidyUpTasks.push(() => {
              primitiveDefinition.material = materialToDefinitionLookup.get(material);
            });
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
              material: {
                name: 'debug',
                alpha: { mode: 'OPAQUE' },
                diffuseColor: Color4.red(),
              },
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
                componentType: WebGL2RenderingContext.UNSIGNED_BYTE,
                componentCount: 1,
                componentSize: 1,
                normalized: false,
              },
            },
          ],
        };
      }

      const skin = node.getSkin();
      if (skin) {
        const skinDefinition: SkinDefinition = nodeDefinition.skin = {
          jointNodes: [],
          inverseBindMatrices: [],
        };

        // @TODO skeleton (root node) ?

        tidyUpTasks.push(() => {
          skinDefinition.jointNodes = skin.listJoints()
            .map((jointNode) => {
              const jointNodeDefinition = nodeDefinitionLookup.get(jointNode);
              if (!jointNodeDefinition) {
                throw new Error(`Skin references unknown node: '${jointNode.getName()}`);
              }
              return jointNodeDefinition;
            });
        });

        const inverseBindMatricesAccessor = skin.getInverseBindMatrices();
        if (inverseBindMatricesAccessor) {
          skinDefinition.inverseBindMatrices = mapBufferChunks(
            inverseBindMatricesAccessor.getArray() as Float32Array<ArrayBuffer>,
            16,
            (values) => new Matrix4(values),
          );
        } else {
          skinDefinition.inverseBindMatrices = skin.listJoints().map(() => new Matrix4());
        }
      }

      // Children
      nodeDefinition.children = node.listChildren().map((childNode) => createNodeDefinition(childNode));

      return nodeDefinition;
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
        if (!targetNode) {
          // Ignore channels with no target, unsupported
          console.warn(`GLTF animation '${animationDefinition.name}' has channel with no node target. This channel will be ignored.`);
          continue;
        }
        const targetNodeName = targetNode.getName();
        if (!targetNodeName?.trim()) {
          // Ignore target nodes with empty / blank names as this will not be robust
          console.warn(`GLTF animation '${animationDefinition.name}' has channel that targets node with empty/blank name. This channel will be ignored.`);
          continue;
        }

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
            throw new Error(`Unsupported animation type: ${outputAccessor.getType()}, Animation target: ${targetNodeName}['${channel.getTargetPath()}']`);
        }

        // Keep track of longest samplers
        const channelLength = inputAccessor.getMax([])[0]; // @TODO Why is this API like this? What's with the arrays?
        if (channelLength > animationDefinition.length) {
          animationDefinition.length = channelLength;
        }

        const channelDefinition: AnimationChannelDefinition = {
          targetNodeName: targetNode.getName(),
          targetNodeProperty: channel.getTargetPath()!,
          timestamps: inputAccessor.getArray() as Float32Array,
          values: outputValues,
          interpolation: sampler.getInterpolation(),
        };

        animationDefinition.channels.push(channelDefinition);
      }

      allAnimationDefinitions.push(animationDefinition);
    }

    // Execute all tidy-up tasks
    tidyUpTasks.forEach((task) => task());

    // @NOTE GLTF coordinate system is +Y-up. Convert to +Z-up by rotating along X.
    // See: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units
    rootNodeDefinitions.forEach((nodeDefinition) => {
      nodeDefinition.transform.rotation.multiplySelf(Quaternion.fromAxisAngle(Vector3.right(), 90));
    });

    return {
      rootNodes: rootNodeDefinitions,
      animations: allAnimationDefinitions,
    };
  }
}

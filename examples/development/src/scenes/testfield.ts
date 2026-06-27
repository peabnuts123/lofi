import { Vector2, Vector3, Color3, DegreesToRadians, Matrix4, toFixed, sin, cos, randInt } from '@lofi/core/math';
import { Color4 } from '@lofi/core/math/Color4';
import { RateCounter } from '@lofi/core/util/RateCounter';
import { AudioSourceNode, BoxColliderNode, CameraNode, ColliderNode, ConvexMeshColliderNode, DirectionalLightNode, ModelNode, ObjectNode, PointLightNode } from '@lofi/engine/scene/nodes';
import { Model, type Triangle } from '@lofi/engine/models';
import { Engine, type DrawTask, type IEngine } from '@lofi/engine/Engine';
import { DrawableSceneNode, Scene, SceneNode, type IScene } from '@lofi/engine/scene';
import { WebFileSystem } from '@lofi/engine/filesystem/WebFileSystem';
import { rayAABBIntersection, rayTriangleIntersection } from '@lofi/engine/collision/ray';
import { AxisAlignedBoundingBox } from '@lofi/engine/collision';
import { Material, ShaderBlendingMode } from '@lofi/engine/materials';
import { Cubemap, Texture } from '@lofi/engine/textures';
import { AudioClip } from '@lofi/engine/audio';
import { GltfLoader } from '@lofi/engine/loaders/GltfLoader';
import type { ModelDefinition, ModelPartDefinition } from '@lofi/engine/loaders/definitions';
import { DrawDebug } from '@lofi/engine/util/DrawDebug';

import { DebugGeometry } from '@game/util/DebugGeometry';

const MaxRuntimeSeconds = 60;
const GridW = 20;
const GridH = 20;
const GridSpacing = 0.5;

const Flags = {
  /* @NOTE This is duplicated so I can just comment lines out to disable them */
  ...{
    AudioDemoEnabled: false,
    LightingEnabled: false,
    GroundEnabled: false,
    BurgerEnabled: false,
    TestObjectsEnabled: false,
    BlendingTestsEnabled: false,
    IntersectingCollidersEnabled: false,
    MovingCollidersEnabled: false,
    AnimationTestEnabled: false,
    RayCasting: false,
    LowLevelApiDemoEnabled: false,
  },
  // AudioDemoEnabled: true,
  LightingEnabled: true,
  GroundEnabled: true,
  BurgerEnabled: true,
  // TestObjectsEnabled: true,
  BlendingTestsEnabled: true,
  // IntersectingCollidersEnabled: true,
  // MovingCollidersEnabled: true,
  AnimationTestEnabled: true,
  // RayCasting: true,
  LowLevelApiDemoEnabled: true,
};

const CollidingMaterial = new Material({
  blendingMode: ShaderBlendingMode.Additive(),
  diffuseColor: Color4.red().withA(0),
  unlit: true,
});

export abstract class Game {
  public static async run(canvas: HTMLCanvasElement): Promise<void> {
    const fileSystem = new WebFileSystem();

    const debugGeometry = new DebugGeometry(fileSystem);

    const models: ModelDefinition[] = [
      /* 00 - Ground */
      {
        rootParts: [debugGeometry.simplePart({
          name: 'ground',
          primitive: debugGeometry.cubePrimitive(),
          material: await debugGeometry.material({
            name: 'ground',
            diffuseTexturePath: '/textures/stones.png',
          }),
        })],
        animations: [],
      },
      /* 01 - Real model */
      await GltfLoader.loadModel('/models/burger.glb', fileSystem),
      /* 02 - Blending sample */
      {
        rootParts: [debugGeometry.simplePart({
          name: 'blending',
          primitive: debugGeometry.cubePrimitive(),
          material: await debugGeometry.material({
            name: 'blending',
            diffuseTexturePath: '/textures/stones.png',
          }),
        })],
        animations: [],
      },
      /* 03 - Dumpster model */
      await GltfLoader.loadModel('/models/dumpster.glb', fileSystem),
      /* 04 - Animated source */
      await GltfLoader.loadModel('/models/Rig_Medium_General.glb', fileSystem),
      /* 05 - Animation target */
      await GltfLoader.loadModel('/models/rig_mage.glb', fileSystem),
    ];

    const runLoopHooks: Array<(dt: number, time: number) => void> = [];

    // Get debug canvas
    const debugCanvas = document.getElementById('debug-canvas') as HTMLCanvasElement;
    const engine = new Engine(canvas, fileSystem);
    const scene = new Scene(engine);
    scene.lighting.ambientColor = new Color3(30, 30, 30);
    const debug_visualiser = new DrawDebugVisualiser(scene, 'ray:debug');

    // Load models
    const boxModel = await Model.fromDefinition(engine, models[0]);
    const burgerModel = await Model.fromDefinition(engine, models[1]);

    const cameraOrigin = new ObjectNode(scene, 'camera_origin');
    const camera = new CameraNode(scene, 'camera', 70, canvas.width / canvas.height, cameraOrigin);
    camera.position = new Vector3(-3.5, -3.5, 2);
    camera.pointAt(Vector3.zero());
    runLoopHooks.push((dt, time) => {
      const CameraRotationSpeedDegreesPerSecond = 15;
      cameraOrigin.rotation.z += dt * CameraRotationSpeedDegreesPerSecond;
      camera.position.z = Math.sin(time * CameraRotationSpeedDegreesPerSecond * 2 * DegreesToRadians) * 1 + 3;
      camera.pointAt(new Vector3(0, 0, 0));
    });

    /* Audio */
    if (Flags.AudioDemoEnabled) {
      const testAudio = await AudioClip.load(engine, 'audio/Titlescreen_1.mp3', { loop: true });
      const audioBox = new ModelNode(scene, 'test', boxModel);
      audioBox.setMaterialOverride('ground', new Material({
        diffuseColor: Color4.red(),
      }));
      audioBox.scale.multiplySelf(0.2);
      const audioSource = new AudioSourceNode(scene, 'test', audioBox);

      audioBox.absolutePosition = camera.absolutePosition;
      audioSource.playClip(testAudio);

      runLoopHooks.push((dt) => {
        audioBox.position.y += dt;
      });
    }

    /* Ray casting */
    if (Flags.RayCasting) {
      const rayOrigin = new ObjectNode(scene, 'ray:origin');
      rayOrigin.position.z = 0.5;

      const rayTarget = new ModelNode(scene, 'ray:target', boxModel, rayOrigin);
      rayTarget.scale.multiplySelf(0.2);
      rayTarget.position.x = -2;
      rayTarget.position.z = 2;
      rayTarget.setMaterialOverride('ground', new Material({
        diffuseColor: Color4.yellow(),
        unlit: true,
      }), 'replace');

      const rayDirection = rayTarget.absolutePosition.subtract(rayOrigin.absolutePosition);

      const frameCounter = new RateCounter('ray:fps', undefined, { mute: true });
      const rayCastDurationCounter = new RateCounter('ray:duration', frameCounter);

      runLoopHooks.push((dt) => {
        rayOrigin.rotation.z += 15 * dt;

        rayDirection
          .setValue(rayTarget.absolutePosition)
          .subtractSelf(rayOrigin.absolutePosition)
          .normalizeSelf();

        const raycastStart = performance.now();
        let raycastResult = rayCastScene(rayOrigin.absolutePosition, rayDirection, scene);
        const raycastEnd = performance.now();
        const raycastHitPosition = raycastResult?.[1] ?? rayTarget.absolutePosition;
        debug_visualiser.add(
          DrawDebug.drawPolyLine(engine, [rayOrigin.absolutePosition, raycastHitPosition], { overlay: true }),
          DrawDebug.drawPolyLine(engine, [raycastHitPosition, rayTarget.absolutePosition], { overlay: true, color: Color3.red(), }),
        );

        frameCounter.count();
        rayCastDurationCounter.count(raycastEnd - raycastStart)
      });

      setTimeout(() => {
        frameCounter.stop();
        rayCastDurationCounter.stop();
      }, MaxRuntimeSeconds * 1000)
    }


    /* @DEBUG Mesh picking */
    {
      canvas.addEventListener('click', (e) => {
        const clickNormalised = new Vector2(
          e.offsetX / canvas.clientWidth,
          e.offsetY / canvas.clientHeight,
        );

        const startTime = performance.now();
        const raycastResult = rayCastFromCamera(camera, scene, clickNormalised.x, clickNormalised.y);
        const result = raycastResult?.[0];
        const endTime = performance.now();
        console.log(`Single ray cast: ${toFixed(endTime - startTime, 1)}`);

        if (result !== undefined) {
          console.log(`Picked: `, result.name);
        } else {
          console.log(`NO RESULT`);
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && debugCanvas) {
          e.preventDefault();
          debug_rayCastEntireScreen(debugCanvas, camera, scene);
        }
      });
    }

    /* Lighting */
    if (Flags.LightingEnabled) {
      const LightDistance = 5;
      const lightOrigin = new ObjectNode(scene, 'light_origin');
      const light0 = new PointLightNode(scene, 'light0', Color3.red(), lightOrigin);
      light0.position = new Vector3(
        LightDistance * Math.sin(2 * Math.PI * 0.2 / 3),
        LightDistance * Math.cos(2 * Math.PI * 1 / 3),
        LightDistance,
      );
      const light1 = new PointLightNode(scene, 'light1', Color3.green(), lightOrigin);
      light1.position = new Vector3(
        LightDistance * Math.sin(2 * Math.PI * 2 / 3),
        LightDistance * Math.cos(2 * Math.PI * 2 / 3),
        LightDistance,
      );

      const sunLight = new DirectionalLightNode(scene, 'sun', new Color3(0, 0x50, 0xFF));
      sunLight.absoluteRotation.x = 30;

      const LightRotationSpeedDegreesPerSecond = 25;
      runLoopHooks.push((dt) => {
        lightOrigin.rotation.z += dt * LightRotationSpeedDegreesPerSecond;
      });
    }

    const cubemap = await Cubemap.loadBoxNet(engine, '/textures/cubemaps/box-net.png');

    /* Ground */
    if (Flags.GroundEnabled) {
      const ground = new ModelNode(scene, 'ground', boxModel);
      ground.position.z = -0.5;
      ground.scale.x = 4;
      ground.scale.y = 4;

      const groundMaterial = new Material({
        reflectionCubemap: cubemap,
      });
      ground.setMaterialOverride('ground', groundMaterial);
    }

    /* Burger */
    if (Flags.BurgerEnabled) {
      const burger = new ModelNode(scene, 'burger', burgerModel);
      burger.renderLayer = 1;
      burger.scale.multiplySelf(2);
      const miniBurger = new ModelNode(scene, 'mini-burger', burgerModel, burger);
      miniBurger.renderLayer = 1;
      miniBurger.position = new Vector3(0, 0.35, 0);
      miniBurger.scale.multiplySelf(0.5);

      const originalBurgerRotation = burger.rotation.q.clone();
      const originalBurgerScale = burger.scale.clone();
      const originalBurgerPosition = burger.position.clone();

      runLoopHooks.push((_dt, time) => {
        cycleBehaviours(time, () => {
          burger.position = originalBurgerPosition;
          burger.rotation.set(originalBurgerRotation);
          burger.scale = originalBurgerScale;
        }, [
          () => burger.rotation.z = time * 360 / 8,
          () => burger.position = originalBurgerPosition.add(new Vector3(Math.sin(time) * 2, Math.cos(time) * 2, burger.position.y)),
          () => burger.scale = originalBurgerScale.multiply(Math.sin(time * 2 * Math.PI / 4) + 1.5),
          () => {
            burger.rotation.z = time * 360 / 8;
            burger.position = originalBurgerPosition.add(new Vector3(Math.sin(time) * 2, Math.cos(time) * 2, burger.position.y));
            burger.scale = originalBurgerScale.multiply(Math.sin(time * 2 * Math.PI / 4) + 1.5);
          },
        ]);
      });
    }

    /* Test Objects */
    if (Flags.TestObjectsEnabled) {
      const testObjects: ModelNode[][] = [];
      for (let i = 0; i < GridW; i++) {
        testObjects[i] = [];
        for (let j = 0; j < GridH; j++) {
          const burger = new ModelNode(scene, 'burger', burgerModel);
          testObjects[i].push(burger);

          if (i % 3 === 0 && j % 4 === 0) {
            burger.setMaterialOverride('brownLight', new Material({
              diffuseColor: Color4.red(),
            }));
          } else if (i % 3 === 0) {
            burger.setMaterialOverride('brownLight', new Material({
              diffuseColor: Color4.blue(),
            }));
          } else if (j % 4 === 0) {
            burger.setMaterialOverride('brownLight', new Material({
              diffuseColor: Color4.green(),
            }));
          }

          burger.position = new Vector3((i - GridW / 2) * GridSpacing + 0.5, (j - GridH / 2) * GridSpacing + 0.5, -0.5);
          burger.scale.multiplySelf(1.7);

          const miniBurger = new ModelNode(scene, 'mini-burger', burgerModel, burger);
          miniBurger.position = new Vector3(0.2, 0.2, 0);
          miniBurger.scale.multiplySelf(0.5);
        }
      }
      runLoopHooks.push((_dt, time) => {
        let n = 0;
        for (let i = 0; i < testObjects.length; i++) {
          for (let j = 0; j < testObjects[i].length; j++) {
            const testObject = testObjects[i][j];
            const uniqueParam = (time + (n / 10));
            testObject.rotation.z = (uniqueParam * 360 / 8);
            testObject.position = new Vector3(
              (i - testObjects.length / 2) * GridSpacing + 0.5 + Math.sin(uniqueParam) * 0.3,
              (j - testObjects[i].length / 2) * GridSpacing + 0.5 + Math.cos(uniqueParam) * 0.3,
              0,
            );
            testObject.scale = Vector3.one().multiplySelf(Math.sin(uniqueParam) / 3 + 1);
            n++;
          }
        }
      });
    }
    /* Blending test stuff */
    if (Flags.BlendingTestsEnabled) {
      const blendingModel = await Model.fromDefinition(engine, models[2]);
      const blendingAverage = new ModelNode(scene, 'blending_average', blendingModel);
      blendingAverage.position.x = 1.5;
      blendingAverage.position.y = 1.5;
      blendingAverage.position.z = 0.5;
      blendingAverage.setMaterialOverride('blending', new Material({
        blendingMode: ShaderBlendingMode.Average(),
        diffuseColor: Color4.white().withA(0),
      }));
      const blendingAdditive = new ModelNode(scene, 'blending_additive', blendingModel);
      blendingAdditive.position.x = -1.5;
      blendingAdditive.position.y = 1.5;
      blendingAdditive.position.z = 0.5;
      blendingAdditive.setMaterialOverride('blending', new Material({
        blendingMode: ShaderBlendingMode.Additive(),
        diffuseColor: Color4.green().withA(0),
        unlit: true,
      }));
      const blendingSubtractive = new ModelNode(scene, 'blending_subtractive', blendingModel);
      blendingSubtractive.position.x = 1.5;
      blendingSubtractive.position.y = -1.5;
      blendingSubtractive.position.z = 0.5;
      blendingSubtractive.setMaterialOverride('blending', new Material({
        blendingMode: ShaderBlendingMode.Subtractive(),
        diffuseColor: Color4.white().withA(0),
        unlit: true,
      }));
      const blendingAlphaBlend = new ModelNode(scene, 'blending_alphaBlend', blendingModel);
      blendingAlphaBlend.position.x = -1.5;
      blendingAlphaBlend.position.y = -1.5;
      blendingAlphaBlend.position.z = 0.5;
      blendingAlphaBlend.setMaterialOverride('blending', new Material({
        blendingMode: ShaderBlendingMode.AlphaClip(),
        diffuseTexture: await Texture.load(engine, '/textures/bars.png'),
      }));
    }

    /* Intersecting Colliders */
    if (Flags.IntersectingCollidersEnabled) {
      const colliderModel = await Model.fromDefinition(engine, models[0]);
      const staticColliderParent = new ModelNode(scene, "static_collider_parent", colliderModel);
      staticColliderParent.position.z = 2.5;
      const staticCollider = new BoxColliderNode(scene, "static_collider", 0, {
        x: 1, y: 1, z: 1,
      }, staticColliderParent);
      const rotatingColliderParent = new ModelNode(scene, "rotating_collider_parent", colliderModel);
      rotatingColliderParent.position.x = 1.2;
      rotatingColliderParent.position.z = 2.5;
      const rotatingCollider = new BoxColliderNode(scene, "rotating_collider", 0, {
        x: 1, y: 1, z: 1,
      }, rotatingColliderParent);

      runLoopHooks.push((_dt, time) => {
        if (rotatingColliderParent) {
          rotatingColliderParent.rotation.x = time * 360 / 7;
          rotatingColliderParent.rotation.y = time * 360 / 6;
          rotatingColliderParent.rotation.z = time * 360 / 8;

          if (rotatingCollider && staticCollider) {
            const collisionResult = rotatingCollider.intersects(staticCollider);
            if (collisionResult) {
              rotatingColliderParent.setMaterialOverride('ground', CollidingMaterial);
            } else {
              rotatingColliderParent.removeMaterialOverride('ground');
            }
          }
        }
      });
    }

    /* Moving colliders */
    if (Flags.MovingCollidersEnabled) {
      const size = 1;
      function box(pos: Vector3, rot?: Vector3, scale?: Vector3): [SceneNode, ColliderNode] {
        const model = new ModelNode(scene, "box", boxModel);
        model.position = pos;
        if (rot) {
          model.rotation.euler.setValue(rot);
        }
        if (scale) {
          model.scale = scale;
        }

        const collider = new BoxColliderNode(scene, "collider", 0, Vector3.one().multiplySelf(size), model);
        return [model, collider];
      }
      const speed = 0.35;
      const dumpsterModel = await Model.fromDefinition(engine, models[3]);
      const convexColliderNode = new ModelNode(scene, "convex", dumpsterModel);
      convexColliderNode.scale.multiplySelf(2);
      const convexCollider = new ConvexMeshColliderNode(scene, "collider", 0, dumpsterModel, convexColliderNode);
      const [movingBoxNode, movingBoxCollider] = box(new Vector3(-1.5, 0, 1.3,));

      runLoopHooks.push(() => {
        // Cruel test, make two dynamic colliders both move into each other
        convexCollider.move(convexColliderNode, new Vector3(-speed / 60, 0, 0));
        movingBoxCollider.move(movingBoxNode, new Vector3(speed / 60, 0, 0));
      });
    }

    /* Animation */
    if (Flags.AnimationTestEnabled) {
      const animatedModel = await Model.fromDefinition(engine, models[4]);
      const nonAnimatedModel = await Model.fromDefinition(engine,
        addVertexColors(models[5]),
      );

      // @TODO Probably should be its own feature (not dependent on Animation flag)
      if (Flags.LowLevelApiDemoEnabled) {
        // @TODO bake this API into the types
        const primitiveGeometries = nonAnimatedModel.allParts
          .flatMap((part) => part.primitiveCaches)
          .map((primitive) => primitive.geometry);
        const originalHatVertexPositions = primitiveGeometries.map((primitive) => primitive.vertexPositions.map(x => x.clone()));
        const tmp_vector = Vector3.zero();
        const LowLevelMutationFlags = {
          ...{
            vertexPositions: false,
            triangleIndices: false,
            vertexNormals: false,
            jointIndices: false,
            jointWeights: false,
            vertexColors: false,
            vertexTexCoords: false,
          },
          vertexPositions: true,
          // triangleIndices: true,
          vertexNormals: true,
          // jointIndices: true,
          // jointWeights: true,
          // vertexColors: true,
          // vertexTexCoords: true,
        }
        for (let i = 0; i < primitiveGeometries.length; i++) {
          runLoopHooks.push((_dt, time) => {
            const primitive = primitiveGeometries[i];
            primitive.mutate((geometry) => {
              /* Positions */
              if (LowLevelMutationFlags.vertexPositions) {
                for (let vertexIndex = 0; vertexIndex < geometry.vertexPositions.length; vertexIndex++) {
                  const hatVertex = geometry.vertexPositions[vertexIndex];
                  const p = hatVertex.x + hatVertex.y + hatVertex.z;
                  const originalPosition = originalHatVertexPositions[i][vertexIndex];
                  tmp_vector.setValue(
                    sin(time * 6 + (p * 3), 10, 0.7, 1.0),
                    sin(0.2 + time * 6 + (p * 3), 10, 0.95, 1.0),
                    cos(time * 6 + (p * 3), 10, 0.7, 1.0),
                  );
                  hatVertex
                    .setValue(originalPosition)
                    .multiplySelf(tmp_vector);
                }
              }

              /* Triangle indices */
              if (LowLevelMutationFlags.triangleIndices) {
                const randomTriangleIndices = geometry.triangleIndices[randInt(0, geometry.triangleIndices.length)];
                const vertexIndex = randInt(0, 3);
                // const newValue = randInt(0, geometry.vertexPositions.length);
                const newValue = 0
                if (vertexIndex === 0) randomTriangleIndices.aIndex = newValue;
                else if (vertexIndex === 1) randomTriangleIndices.bIndex = newValue
                else if (vertexIndex === 2) randomTriangleIndices.cIndex = newValue
              }

              /* Vertex normals */
              if (LowLevelMutationFlags.vertexNormals) {
                geometry.recomputeVertexNormals();
              }

              /* Joint indices */
              if (LowLevelMutationFlags.jointIndices) {
                if (geometry.jointIndices) {
                  const randomJointIndices = geometry.jointIndices[randInt(0, geometry.jointIndices.length)];
                  const newValue = randInt(0, 5);
                  randomJointIndices[0] = newValue;
                }
              }

              /* Joint Weights */
              if (LowLevelMutationFlags.jointWeights) {
                if (geometry.jointWeights) {
                  const randomJointWeights = geometry.jointWeights[randInt(0, geometry.jointWeights.length)];
                  randomJointWeights[0] = 0;
                }
              }

              /* Vertex colors */
              if (LowLevelMutationFlags.vertexColors && geometry.vertexColors) {
                for (let vertexIndex = 0; vertexIndex < geometry.vertexColors.length; vertexIndex++) {
                  const color = geometry.vertexColors[vertexIndex];
                  const p = vertexIndex;
                  color.r = sin(time + p, 2 + (p % 5), 0x50, 0xFF);
                  color.g = sin(time + p + 3, 2 + (p % 5), 0x50, 0xFF);
                  color.b = cos(time + p + 5, 2 + (p % 5), 0x50, 0xFF);
                }
              }

              /* Texture coordinates */
              if (LowLevelMutationFlags.vertexTexCoords && geometry.vertexTextureCoordinates) {
                for (let vertexIndex = 0; vertexIndex < geometry.vertexTextureCoordinates.length; vertexIndex++) {
                  const texCoord = geometry.vertexTextureCoordinates[vertexIndex];
                  texCoord.x += 0.1 * _dt;
                  texCoord.y += 0.08 * _dt;
                }
              }
            });
          });
        }
      }

      const figure2 = new ModelNode(scene, 'figure-2', nonAnimatedModel);
      figure2.position.x = 1;
      const AnimationList: string[] = [
        'Death_A',
        'Death_B',
        'Hit_A',
        'Hit_B',
        'Idle_A',
        'Idle_B',
        'Interact',
        'PickUp',
        'Spawn_Air',
        'Spawn_Ground',
        'T-Pose',
        'Throw',
        'Use_Item',
      ];
      for (let i = 0; i < 5; i++) {
        const figure = new ModelNode(scene, `figure (${i})`, nonAnimatedModel);
        figure.animationSource = animatedModel;
        if (i === 0) {
          figure.position.x = -1 * i - 1;
        } else {
          figure.position.x = i;
          figure.position.y = i;
        }
        if (AnimationList.length > 0) {
          const debug_speed = 1;
          figure.playAnimation(AnimationList[AnimationList.length - 1], debug_speed);
          let animationIndex = 0;
          const stahp = setInterval(() => {
            const animationName = AnimationList[animationIndex];
            figure.playAnimation(animationName, debug_speed);
            animationIndex = (animationIndex + 1) % AnimationList.length;
          }, 1500 + i * 100);
          setTimeout(() => clearInterval(stahp), MaxRuntimeSeconds * 1000);
        }
      }
    }

    // @DEBUG Visualise wireframes
    // scene.forEachNodeInHierarchy((sceneNode) => {
    //   if (sceneNode instanceof ModelNode) {
    //     runLoopHooks.push(() => {
    //       const aabb = sceneNode.geometry.aabb;
    //       const approximateAabb = sceneNode.geometry.approximateAabb;
    //       debug_visualiser.add(
    //         ...[
    //           aabb && DrawDebug.drawWireframe(engine, aabb, { color: Color3.green(), }),
    //           approximateAabb && DrawDebug.drawWireframe(engine, approximateAabb, { color: Color3.fuchsia(), overlay: true }),
    //         ].filter(Boolean) as []
    //       )
    //     });
    //   }
    // })

    /* Helpers */
    const CyclePeriod = 4;
    function cycleBehaviours(time: number, reset: () => void, behaviours: Array<() => void>): void {
      reset();
      const behaviourIndex = ~~(time / CyclePeriod) % (behaviours.length);
      if (behaviourIndex < behaviours.length) {
        behaviours[behaviourIndex]();
      }
    }

    /* Run loop */
    engine.run((dt, time, stop): void => {
      // Invoke hooks
      runLoopHooks.forEach((hook) => hook(dt, time));

      if (time > MaxRuntimeSeconds) {
        stop();
      }
    });
  }
}

const tmp_RayCastFromCameraDirection = Vector3.zero();
const tmp_RayCastFromCameraInverseViewProjectionMatrix = new Matrix4();
function rayCastFromCamera(camera: CameraNode, scene: IScene, screenX: number, screenY: number): [target: ModelNode, hitPosition: Vector3] | undefined {
  if (screenX > 1 || screenX < 0 || screenY > 1 || screenY < 0) {
    throw new Error(`Invalid args to ${rayCastFromCamera.name}: screen coordinates must be normalized values from 0-1`)
  }

  const rayDirection = tmp_RayCastFromCameraDirection.setValue(
    screenX * 2 - 1,
    1 - screenY * 2, // @NOTE Invert Y because on screens top=0
    1, // @NOTE Near plane in NDC
  ).multiplySelf(
    tmp_RayCastFromCameraInverseViewProjectionMatrix
      .setValue(camera.viewProjectionMatrix)
      .invertSelf(),
  )
    .subtractSelf(camera.absolutePosition)
    .normalizeSelf();

  return rayCastScene(camera.absolutePosition, rayDirection, scene);
}

const tmp_PerformRayCastTriangleAABB = AxisAlignedBoundingBox.zero();
const tmp_PerformRayCastRayDirection = Vector3.zero();
function rayCastScene(rayOrigin: Vector3, rayDirection: Vector3, scene: IScene): [target: ModelNode, hitPosition: Vector3] | undefined {
  let shortestRayDistance: number = Number.MAX_SAFE_INTEGER;
  let shortestRayResult: ModelNode | undefined = undefined;

  // @TODO Should this be returning a distance and not returning a result
  // if the distance is longer than `rayDirection`?
  const rayDirectionNormalized = tmp_PerformRayCastRayDirection
    .setValue(rayDirection)
    .normalizeSelf();

  const debug_phaseMaster = 3 as (1 | 2 | 3);

  /*
    ========
    PHASE 1: AABB
    ========
   */
  const possibleModels: ModelNode[] = [];
  scene.forEachNodeInHierarchy((node) => {
    if (node instanceof ModelNode) {
      const aabb = node.geometry.approximateAabb;
      if (aabb) {
        const result = rayAABBIntersection(rayOrigin, rayDirectionNormalized, aabb);
        if (result !== undefined) {
          possibleModels.push(node);
        }

        if (debug_phaseMaster === 1) {
          if (result && result < shortestRayDistance) {
            shortestRayDistance = result;
            shortestRayResult = node;
          }
        }
      }
    }
  });

  if (debug_phaseMaster === 1) {
    if (shortestRayResult) {
      return [shortestRayResult, rayDirectionNormalized.multiply(shortestRayDistance).addSelf(rayOrigin)];
    } else {
      return undefined;
    }
  }

  /*
    ========
    PHASE 2: Triangle AABB
    ========
   */
  const possibleTriangles: Array<[triangle: Triangle, node: ModelNode]> = [];
  for (const possibleModel of possibleModels) {
    for (const triangle of possibleModel.geometry.allTriangles) {
      // Construct AABB for triangle
      tmp_PerformRayCastTriangleAABB.xMin = Math.min(triangle[0].x, triangle[1].x, triangle[2].x);
      tmp_PerformRayCastTriangleAABB.xMax = Math.max(triangle[0].x, triangle[1].x, triangle[2].x);
      tmp_PerformRayCastTriangleAABB.yMin = Math.min(triangle[0].y, triangle[1].y, triangle[2].y);
      tmp_PerformRayCastTriangleAABB.yMax = Math.max(triangle[0].y, triangle[1].y, triangle[2].y);
      tmp_PerformRayCastTriangleAABB.zMin = Math.min(triangle[0].z, triangle[1].z, triangle[2].z);
      tmp_PerformRayCastTriangleAABB.zMax = Math.max(triangle[0].z, triangle[1].z, triangle[2].z);

      const result = rayAABBIntersection(rayOrigin, rayDirectionNormalized, tmp_PerformRayCastTriangleAABB);
      if (result !== undefined) {
        possibleTriangles.push([
          triangle,
          possibleModel,
        ]);
      }

      if (debug_phaseMaster === 2) {
        if (result && result < shortestRayDistance) {
          shortestRayDistance = result;
          shortestRayResult = possibleModel;
        }
      }
    }
  }

  if (debug_phaseMaster === 2) {
    if (shortestRayResult) {
      return [shortestRayResult, rayDirectionNormalized.multiply(shortestRayDistance).addSelf(rayOrigin)];
    } else {
      return undefined;
    }
  }

  /*
    ========
    PHASE 3: Triangle
    ========
   */
  for (const [triangle, node] of possibleTriangles) {
    const result = rayTriangleIntersection(rayOrigin, rayDirectionNormalized, triangle);
    if (result && result < shortestRayDistance) {
      shortestRayDistance = result;
      shortestRayResult = node;
    }
  }

  if (shortestRayResult) {
    return [shortestRayResult, rayDirectionNormalized.multiply(shortestRayDistance).addSelf(rayOrigin)];
  } else {
    return undefined;
  }
}


function debug_rayCastEntireScreen(canvas: HTMLCanvasElement, camera: CameraNode, scene: IScene) {
  console.log('Ray casting scene to canvas...');

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Create image data for faster pixel manipulation
  const imageData = ctx.createImageData(canvas.width, canvas.height);

  const nodeNameToColor = (name: string): [number, number, number] => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    const r = (hash & 0xFF0000) >> 16;
    const g = (hash & 0x00FF00) >> 8;
    const b = hash & 0x0000FF;
    return [r, g, b];
  };

  const renderStart = performance.now();
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const normalizedX = x / (canvas.width - 1);
      const normalizedY = y / (canvas.height - 1);

      const raycastResult = rayCastFromCamera(camera, scene, normalizedX, normalizedY);
      const hitNode = raycastResult?.[0];

      const pixelIndex = (y * canvas.width + x) * 4;

      if (hitNode) {
        const [r, g, b] = nodeNameToColor(hitNode.name);
        imageData.data[pixelIndex] = r;
        imageData.data[pixelIndex + 1] = g;
        imageData.data[pixelIndex + 2] = b;
        imageData.data[pixelIndex + 3] = 255; // Alpha
      } else {
        // No hit - leave black (already cleared)
        imageData.data[pixelIndex + 3] = 255; // Alpha
      }
    }
  }

  const renderStop = performance.now();
  console.log(`Ray cast render: ${renderStop - renderStart}ms (${(renderStop - renderStart) / (canvas.width * canvas.height)}ms per pixel)`);

  ctx.putImageData(imageData, 0, 0);
  console.log('Ray cast complete!');
}

// @TODO We gotta move this into the engine lol
export class DrawDebugVisualiser extends DrawableSceneNode {
  private readonly frameDrawTasks: DrawTask[] = [];

  public add(...drawTasks: DrawTask[]): void {
    this.frameDrawTasks.push(...drawTasks);
  }

  public override draw(_engine: IEngine, drawQueue: DrawTask[]): void {
    drawQueue.push(...this.frameDrawTasks);
    this.frameDrawTasks.length = 0;
  }
}

function addVertexColors(modelDefinition: ModelDefinition): ModelDefinition {
  const forEachModelPart = (modelPartDefinitions: ModelPartDefinition[], callbackFn: (partDefinition: ModelPartDefinition) => void): void => {
    modelPartDefinitions.forEach((partDefinition) => {
      callbackFn(partDefinition);
      forEachModelPart(partDefinition.children, callbackFn);
    });
  }

  forEachModelPart(modelDefinition.rootParts, (partDefinition) => {
    if (partDefinition.mesh !== undefined) {
      for (const primitiveDefinition of partDefinition.mesh.primitives) {
        if (primitiveDefinition.color0Data === undefined) {
          const numVertices = primitiveDefinition.positionData.buffer.length / primitiveDefinition.positionData.componentCount;
          primitiveDefinition.color0Data = {
            componentCount: 4,
            componentSize: 4,
            componentType: WebGL2RenderingContext['FLOAT'],
            normalized: false,
            buffer: new Float32Array(numVertices * 4)
          };
          for (let i = 0; i < primitiveDefinition.color0Data.buffer.length; i++) {
            primitiveDefinition.color0Data.buffer[i] = 1;
          }
        }
      }
    }
  });

  return modelDefinition;
}
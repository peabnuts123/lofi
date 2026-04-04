import { AudioSourceNode, BoxColliderNode, CameraNode, ColliderNode, ConvexMeshColliderNode, ModelNode, ObjectNode, PointLightNode } from '@polyzone/engine/scene/nodes';
import { Model, type Triangle } from '@polyzone/engine/models';
import { Vector2, Vector3 } from '@polyzone/engine/util/vector';
import { Engine } from '@polyzone/engine/Engine';
import { Scene, SceneNode } from '@polyzone/engine/scene';
import { WebFileSystem } from '@polyzone/engine/filesystem/WebFileSystem';
import { Color3 } from '@polyzone/engine/util/Color3';
import { Quaternion } from '@polyzone/engine/util/quaternion';
import { DegreesToRadians } from '@polyzone/engine/util/math';
import { Color4 } from '@polyzone/engine/util/Color4';
import { rayAABBIntersection, rayTriangleIntersection } from '@polyzone/engine/collision/ray';
import { AxisAlignedBoundingBox } from '@polyzone/engine/collision';
import { Material, ShaderBlendingMode } from '@polyzone/engine/materials';
import { Texture } from '@polyzone/engine/textures';
import { AudioClip } from '@polyzone/engine/audio';
import { GltfLoader } from '@polyzone/engine/loaders/GltfLoader';

import { DebugGeometry } from '@game/util/DebugGeometry';

const MaxRuntimeSeconds = 30;
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
};

const CollidingMaterial = new Material('colliding', {
  blendingMode: ShaderBlendingMode.Additive(),
  diffuseColor: Color4.red().withA(0),
  unlit: true,
});

export abstract class Game {
  public static async run(canvas: HTMLCanvasElement): Promise<void> {
    const fileSystem = new WebFileSystem();

    const debugGeometry = new DebugGeometry(fileSystem);

    const models = [
      /* 00 - Ground */
      {
        rootNodes: [debugGeometry.simpleNode({
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
        rootNodes: [debugGeometry.simpleNode({
          name: 'blending',
          primitive: debugGeometry.cubePrimitive(),
          material: await debugGeometry.material({
            name: 'blending',
            diffuseTexturePath: '/textures/stones.png',
            diffuseColor: Color4.white().withA(0),
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

    const runLoopHooks: Array<(dt: number) => void> = [];

    // Get debug canvas
    const debugCanvas = document.getElementById('debug-canvas') as HTMLCanvasElement;
    const engine = new Engine(canvas, fileSystem);
    const scene = new Scene(engine);
    scene.lighting.ambientColor = new Color3(30, 30, 30);

    // Load models
    const boxModel = await Model.fromDefinition(engine, models[0]);
    const burgerModel = await Model.fromDefinition(engine, models[1]);

    const cameraOrigin = new ObjectNode(scene, 'camera_origin');
    const camera = new CameraNode(scene, 'camera', 70, canvas.width / canvas.height);
    camera.position = new Vector3(-3.5, 2, 3.5);
    camera.pointAt(Vector3.zero());
    cameraOrigin.addChild(camera);
    runLoopHooks.push((dt) => {
      const CameraRotationSpeedDegreesPerSecond = 15;
      cameraOrigin.rotation.multiply(Quaternion.fromAxisAngle(Vector3.up(), dt * CameraRotationSpeedDegreesPerSecond));
      camera.position.y = Math.sin(time * CameraRotationSpeedDegreesPerSecond * 2 * DegreesToRadians) * 1 + 3;
      camera.pointAt(new Vector3(0, 0, 0));
    });

    /* Audio */
    if (Flags.AudioDemoEnabled) {
      const testAudio = await AudioClip.load(engine, 'audio/Titlescreen_1.mp3', { loop: true });
      const audioBox = new ModelNode(scene, 'test', boxModel);
      audioBox.setMaterialOverride('ground', new Material('red', {
        diffuseColor: Color4.red(),
      }));
      audioBox.scale.multiplySelf(0.2);
      const audioSource = new AudioSourceNode(scene, 'test');
      audioBox.addChild(audioSource);

      audioBox.absolutePosition = camera.absolutePosition;
      audioSource.playClip(testAudio);
      {
        const debug_audioLoop = setInterval(() => {
          audioBox.position.z -= 1 / 30;
        }, 30);
        setTimeout(() => clearInterval(debug_audioLoop), MaxRuntimeSeconds * 1000);
      }
    }


    /* @DEBUG Mesh picking */
    {
      canvas.addEventListener('click', (e) => {
        const clickNormalised = new Vector2(
          e.offsetX / canvas.clientWidth,
          e.offsetY / canvas.clientHeight,
        );

        const result = performRayCast(camera, scene, clickNormalised.x, clickNormalised.y);

        if (result !== undefined) {
          console.log(`Picked: `, result.name);
        } else {
          console.log(`NO RESULT`);
        }
      });
      // @NOTE Debug ray trace visualization - press spacebar
      document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && debugCanvas) {
          e.preventDefault();
          console.log('Ray tracing scene to debug canvas...');

          const debugCtx = debugCanvas.getContext('2d');
          if (!debugCtx) return;

          const debugWidth = debugCanvas.width;
          const debugHeight = debugCanvas.height;

          // Clear debug canvas
          debugCtx.fillStyle = 'black';
          debugCtx.fillRect(0, 0, debugWidth, debugHeight);

          // Create image data for faster pixel manipulation
          const imageData = debugCtx.createImageData(debugWidth, debugHeight);

          // Simple hash function to convert string to color
          const hashColor = (str: string): [number, number, number] => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
              hash = ((hash << 5) - hash) + str.charCodeAt(i);
              hash = hash & hash; // Convert to 32bit integer
            }
            const r = (hash & 0xFF0000) >> 16;
            const g = (hash & 0x00FF00) >> 8;
            const b = hash & 0x0000FF;
            return [r, g, b];
          };

          // Ray trace each pixel
          const renderStart = performance.now();
          for (let y = 0; y < debugHeight; y++) {
            for (let x = 0; x < debugWidth; x++) {
              const normalizedX = x / debugWidth;
              const normalizedY = y / debugHeight;

              const hitNode = performRayCast(camera, scene, normalizedX, normalizedY);

              const pixelIndex = (y * debugWidth + x) * 4;

              if (hitNode) {
                const [r, g, b] = hashColor(hitNode.name);
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
          console.log(`Ray trace render: ${renderStop - renderStart}ms (${(renderStop - renderStart) / (debugHeight * debugWidth)}ms per pixel)`);

          debugCtx.putImageData(imageData, 0, 0);
          console.log('Ray trace complete!');
        }
      });
    }

    /* Lighting */
    if (Flags.LightingEnabled) {
      const LightDistance = 5;
      const lightOrigin = new ObjectNode(scene, 'light_origin');
      const light0 = new PointLightNode(scene, 'light0', Color3.red());
      light0.position = new Vector3(
        LightDistance * Math.sin(2 * Math.PI * 0.2 / 3),
        LightDistance,
        LightDistance * Math.cos(2 * Math.PI * 1 / 3),
      );
      lightOrigin.addChild(light0);
      const light1 = new PointLightNode(scene, 'light1', Color3.green());
      light1.position = new Vector3(
        LightDistance * Math.sin(2 * Math.PI * 2 / 3),
        LightDistance,
        LightDistance * Math.cos(2 * Math.PI * 2 / 3),
      );
      lightOrigin.addChild(light1);
      const light2 = new PointLightNode(scene, 'light2', Color3.blue());
      light2.position = new Vector3(
        LightDistance * Math.sin(2 * Math.PI * 3 / 3),
        LightDistance,
        LightDistance * Math.cos(2 * Math.PI * 3 / 3),
      );
      lightOrigin.addChild(light2);

      runLoopHooks.push((dt) => {
        const LightRotationSpeedDegreesPerSecond = 25;
        lightOrigin.rotation.multiply(Quaternion.fromAxisAngle(Vector3.up(), dt * LightRotationSpeedDegreesPerSecond));
      });
    }

    /* Ground */
    if (Flags.GroundEnabled) {
      const ground = new ModelNode(scene, 'ground', boxModel);
      ground.position.y = -0.5;
      ground.scale.x = 4;
      ground.scale.z = 4;
    }

    /* Burger */
    if (Flags.BurgerEnabled) {
      const burger = new ModelNode(scene, 'burger', burgerModel);
      burger.scale.multiplySelf(2);
      const miniBurger = new ModelNode(scene, 'mini-burger', burgerModel);
      miniBurger.position = new Vector3(0, 0, 0.35);
      miniBurger.scale.multiplySelf(0.5);
      burger.addChild(miniBurger);

      const originalBurgerRotation = burger.rotation.q.clone();
      const originalBurgerScale = burger.scale.clone();
      const originalBurgerPosition = burger.position.clone();

      runLoopHooks.push(() => {
        cycleBehaviours(() => {
          burger.position = originalBurgerPosition;
          burger.rotation.set(originalBurgerRotation);
          burger.scale = originalBurgerScale;
        }, [
          () => burger.rotation.y = time * 360 / 8,
          () => burger.position = originalBurgerPosition.add(new Vector3(Math.sin(time) * 2, burger.position.y, Math.cos(time) * 2)),
          () => burger.scale = originalBurgerScale.multiply(Math.sin(time * 2 * Math.PI / 4) + 1.5),
          () => {
            burger.rotation.y = time * 360 / 8;
            burger.position = originalBurgerPosition.add(new Vector3(Math.sin(time) * 2, burger.position.y, Math.cos(time) * 2));
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

          burger.position = new Vector3((i - GridW / 2) * GridSpacing + 0.5, -0.5, (j - GridH / 2) * GridSpacing + 0.5);
          burger.scale.multiplySelf(1.7);

          const miniBurger = new ModelNode(scene, 'mini-burger', burgerModel);
          burger.addChild(miniBurger);
          miniBurger.position = new Vector3(0.2, 0, 0.2);
          miniBurger.scale.multiplySelf(0.5);
        }
      }
      runLoopHooks.push(() => {
        let n = 0;
        for (let i = 0; i < testObjects.length; i++) {
          for (let j = 0; j < testObjects[i].length; j++) {
            const testObject = testObjects[i][j];
            const uniqueParam = (time + (n / 10));
            // testObject.rotation.y = (uniqueParam * 360 / 8) % 360;
            testObject.rotation.set(Quaternion.fromAxisAngle(Vector3.up(), (uniqueParam * 360 / 8) % 360));
            testObject.position = new Vector3(
              (i - testObjects.length / 2) * GridSpacing + 0.5 + Math.sin(uniqueParam) * 0.3,
              0,
              (j - testObjects[i].length / 2) * GridSpacing + 0.5 + Math.cos(uniqueParam) * 0.3,
            );
            testObject.scale = Vector3.one().multiplySelf(Math.sin(uniqueParam) / 3 + 1);
            n++;
          }
        }
      });
    }
    /* Blending test stuff */
    if (Flags.BlendingTestsEnabled) {
      const blendingTexture = await Texture.load(engine, '/textures/stones.png');
      const blendingModel = await Model.fromDefinition(engine, models[2]);
      const blendingAverage = new ModelNode(scene, 'blending_average', blendingModel);
      blendingAverage.position.x = 1.5;
      blendingAverage.position.y = 0.5;
      blendingAverage.position.z = 1.5;
      blendingAverage.setMaterialOverride('blending', new Material('blending-average', {
        blendingMode: ShaderBlendingMode.Average(),
        diffuseColor: Color4.white().withA(0),
        diffuseTexture: blendingTexture,
      }));
      const blendingAdditive = new ModelNode(scene, 'blending_additive', blendingModel);
      blendingAdditive.position.x = -1.5;
      blendingAdditive.position.y = 0.5;
      blendingAdditive.position.z = 1.5;
      blendingAdditive.setMaterialOverride('blending', new Material('blending-additive', {
        blendingMode: ShaderBlendingMode.Additive(),
        diffuseColor: Color4.green().withA(0),
        diffuseTexture: blendingTexture,
        unlit: true,
      }));
      const blendingSubtractive = new ModelNode(scene, 'blending_subtractive', blendingModel);
      blendingSubtractive.position.x = 1.5;
      blendingSubtractive.position.y = 0.5;
      blendingSubtractive.position.z = -1.5;
      blendingSubtractive.setMaterialOverride('blending', new Material('blending-subtractive', {
        blendingMode: ShaderBlendingMode.Subtractive(),
        diffuseColor: Color4.white().withA(0),
        diffuseTexture: blendingTexture,
        unlit: true,
      }));
      const blendingAlphaBlend = new ModelNode(scene, 'blending_alphaBlend', blendingModel);
      blendingAlphaBlend.position.x = -1.5;
      blendingAlphaBlend.position.y = 0.5;
      blendingAlphaBlend.position.z = -1.5;
      blendingAlphaBlend.setMaterialOverride('blending', new Material('blending-alphaBlend', {
        blendingMode: ShaderBlendingMode.AlphaClip(),
        diffuseTexture: await Texture.load(engine, '/textures/bars.png'),
      }));
    }

    /* Intersecting Colliders */
    if (Flags.IntersectingCollidersEnabled) {
      const colliderModel = await Model.fromDefinition(engine, models[0]);
      const staticColliderParent = new ModelNode(scene, "static_collider_parent", colliderModel);
      const staticCollider = new BoxColliderNode(scene, "static_collider", 0, {
        x: 1, y: 1, z: 1,
      });
      staticColliderParent.addChild(staticCollider);
      staticColliderParent.position.y = 2.5;
      const rotatingColliderParent = new ModelNode(scene, "rotating_collider_parent", colliderModel);
      const rotatingCollider = rotatingColliderParent.addChild(new BoxColliderNode(scene, "rotating_collider", 0, {
        x: 1, y: 1, z: 1,
      }));
      rotatingColliderParent.position.x = 1.2;
      rotatingColliderParent.position.y = 2.5;

      runLoopHooks.push(() => {
        if (rotatingColliderParent) {
          rotatingColliderParent.rotation.x = time * 360 / 7;
          rotatingColliderParent.rotation.y = time * 360 / 8;
          rotatingColliderParent.rotation.z = time * 360 / 6;

          if (rotatingCollider && staticCollider) {
            const collisionResult = rotatingCollider.intersects(staticCollider);
            if (collisionResult) {
              rotatingColliderParent.setMaterialOverride('ground', CollidingMaterial);
            } else {
              rotatingColliderParent.setMaterialOverride('ground', undefined);
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
        const collider = model.addChild(new BoxColliderNode(scene, "collider", 0, {
          x: size, y: size, z: size,
        }));
        model.position = pos;
        if (rot) {
          model.rotation.euler.setValue(rot);
        }
        if (scale) {
          model.scale = scale;
        }
        return [model, collider];
      }
      const speed = 0.35;
      const dumpsterModel = await Model.fromDefinition(engine, models[3]);
      const convexColliderNode = new ModelNode(scene, "convex", dumpsterModel);
      const convexCollider = convexColliderNode.addChild(
        new ConvexMeshColliderNode(scene, "collider", 0, dumpsterModel),
      );
      convexColliderNode.scale.multiplySelf(2);
      const [movingBoxNode, movingBoxCollider] = box(new Vector3(-1.5, 1.3, 0));

      runLoopHooks.push(() => {
        // Cruel test, make two dynamic colliders both move into each other
        convexCollider.move(convexColliderNode, new Vector3(-speed / 60, 0, 0));
        movingBoxCollider.move(movingBoxNode, new Vector3(speed / 60, 0, 0));
      });
    }

    /* Animation */
    if (Flags.AnimationTestEnabled) {
      const animatedModel = await Model.fromDefinition(engine, models[4]);
      const nonAnimatedModel = await Model.fromDefinition(engine, models[5]);
      const figure1 = new ModelNode(scene, 'figure-1', nonAnimatedModel);
      figure1.animationSource = animatedModel;
      figure1.position.x = -1;
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
      if (AnimationList.length > 0) {
        figure1.playAnimation(AnimationList[AnimationList.length - 1]);
        let animationIndex = 0;
        const stahp = setInterval(() => {
          const animationName = AnimationList[animationIndex];
          console.log(`Playing: '${animationName}'`);
          figure1.playAnimation(animationName);
          animationIndex = (animationIndex + 1) % AnimationList.length;
        }, 1500);
        setTimeout(() => clearInterval(stahp), MaxRuntimeSeconds * 1000);
      }
    }

    /* Helpers */
    let time = 0;
    const CyclePeriod = 4;
    function cycleBehaviours(reset: () => void, behaviours: Array<() => void>): void {
      reset();
      const behaviourIndex = ~~(time / CyclePeriod) % (behaviours.length + 1);
      if (behaviourIndex < behaviours.length) {
        behaviours[behaviourIndex]();
      }
    }

    /* Run loop */
    engine.run((dt, stop): void => {
      // Invoke hooks
      runLoopHooks.forEach((hook) => hook(dt));

      time += dt;
      if (time > MaxRuntimeSeconds) {
        stop();
      }
    });
  }
}


function performRayCast(camera: CameraNode, scene: Scene, normalizedX: number, normalizedY: number): ModelNode | undefined {
  const rayTarget = new Vector3(
    normalizedX * 2 - 1,
    1 - normalizedY * 2, // @NOTE Invert y
    1, // @NOTE Near plane in NDC
  ).multiplySelf(
    camera.viewProjectionMatrix.invert(),
  );

  const rayDirection = rayTarget
    .subtractSelf(camera.absolutePosition)
    .normalizeSelf();

  let shortestRayDistance: number = Number.MAX_SAFE_INTEGER;
  let shortestRayResult: ModelNode | undefined = undefined;

  const debug_phaseMaster = 3 as (1 | 2 | 3);

  /*
    ========
    PHASE 1: AABB
    ========
   */
  const possibleModels: ModelNode[] = [];
  scene.forEachNodeInHierarchy((node) => {
    if (node instanceof ModelNode) {
      const aabb = node.getAABB();
      const result = rayAABBIntersection(camera.absolutePosition, rayDirection, aabb);
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
  });

  if (debug_phaseMaster === 1) {
    return shortestRayResult;
  }

  /*
    ========
    PHASE 2: Triangle AABB
    ========
   */
  const aabbTmp = AxisAlignedBoundingBox.unit();
  const possibleTriangles: { triangle: Triangle, node: ModelNode }[] = [];
  for (const possibleModel of possibleModels) {
    const modelVertices = possibleModel.getVerticesWorldSpace();
    for (const triangleIndices of possibleModel.model.allTriangleIndices) {
      const triangle: Triangle = [
        modelVertices[triangleIndices[0]],
        modelVertices[triangleIndices[1]],
        modelVertices[triangleIndices[2]],
      ];
      // Construct AABB for triangle
      aabbTmp.xMin = Math.min(triangle[0].x, triangle[1].x, triangle[2].x);
      aabbTmp.xMax = Math.max(triangle[0].x, triangle[1].x, triangle[2].x);
      aabbTmp.yMin = Math.min(triangle[0].y, triangle[1].y, triangle[2].y);
      aabbTmp.yMax = Math.max(triangle[0].y, triangle[1].y, triangle[2].y);
      aabbTmp.zMin = Math.min(triangle[0].z, triangle[1].z, triangle[2].z);
      aabbTmp.zMax = Math.max(triangle[0].z, triangle[1].z, triangle[2].z);

      const result = rayAABBIntersection(camera.absolutePosition, rayDirection, aabbTmp);
      if (result !== undefined) {
        possibleTriangles.push({
          triangle,
          node: possibleModel,
        });
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
    return shortestRayResult;
  }

  /*
    ========
    PHASE 3: Triangle
    ========
   */
  for (const { triangle, node } of possibleTriangles) {
    const result = rayTriangleIntersection(camera.absolutePosition, rayDirection, triangle);
    if (result && result < shortestRayDistance) {
      shortestRayDistance = result;
      shortestRayResult = node;
    }
  }

  return shortestRayResult; // Triangle
}

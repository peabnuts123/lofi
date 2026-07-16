import { Vector2, Vector3, Color3 } from '@lofi/core/math';
import { CameraNode, ModelNode, ObjectNode, PointLightNode } from '@lofi/engine/scene/nodes';
import { Model } from '@lofi/engine/models';
import { Engine } from '@lofi/engine/Engine';
import { Scene } from '@lofi/engine/scene';
import { WebFileSystem } from '@lofi/engine/filesystem/WebFileSystem';
import { GltfLoader } from '@lofi/engine/loaders/GltfLoader';
import { GamepadAxis, GamepadButton, KeyCode, MouseWheelDirection } from '@lofi/engine/input';

import { DebugGeometry } from '@game/util/DebugGeometry';

const MaxRuntimeSeconds = 180;
const fileSystem = new WebFileSystem();
const debugGeometry = new DebugGeometry(fileSystem);

const Flags = {
  ...{
    LightingEnabled: false,
    GroundEnabled: false,
  },
  LightingEnabled: true,
  GroundEnabled: true,
};

export abstract class Game {
  public static async run(canvas: HTMLCanvasElement): Promise<void> {
    /* Engine */
    const engine = new Engine(canvas, fileSystem);
    const { inputSystem: input } = engine;
    const scene = new Scene(engine);
    scene.lighting.ambientColor = new Color3(110, 100, 90);

    const runLoopHooks: Array<(dt: number) => void> = [];

    /* Input */
    input.configure({
      buttons: [
        {
          name: 'player:jump',
          bindings: [
            KeyCode.Space,
            GamepadButton.South,
          ],
        },
        {
          name: 'player:sprint',
          bindings: [
            KeyCode.ShiftLeft,
            GamepadButton.R2,
          ],
        },
        {
          name: 'camera:zoom-in',
          bindings: [
            MouseWheelDirection.Up,
          ],
        },
        {
          name: 'camera:zoom-out',
          bindings: [
            MouseWheelDirection.Down,
          ],
        },
      ],
      axes: [
        {
          name: 'player:x',
          bindings: [
            { min: KeyCode.KeyA, max: KeyCode.KeyD },
            GamepadAxis.JoyLeftX,
          ],
        },
        {
          name: 'player:y',
          bindings: [
            { min: KeyCode.KeyS, max: KeyCode.KeyW },
            GamepadAxis.JoyLeftY,
          ],
        },
        {
          name: 'camera:x',
          bindings: [
            { min: KeyCode.ArrowLeft, max: KeyCode.ArrowRight },
            GamepadAxis.JoyRightX,
          ],
        },
        {
          name: 'camera:y',
          bindings: [
            { min: KeyCode.ArrowDown, max: KeyCode.ArrowUp },
            GamepadAxis.JoyRightY,
          ],
        },
        {
          name: 'camera:zoom',
          bindings: [
            { min: GamepadButton.R1, max: GamepadButton.L1 },
          ],
        },
      ],
    });

    /* Model definitions */
    const cubeModel = await Model.fromDefinition(engine, {
      rootParts: [debugGeometry.simplePart({ name: 'cube' })],
      animations: [],
    });
    const rigDefinition = await GltfLoader.loadModel('/models/Rig_Medium_MovementBasic.glb', fileSystem);
    const playerModelDefinition = await GltfLoader.loadModel('/models/rig_mage.glb', fileSystem);
    console.log(playerModelDefinition.rootParts);
    playerModelDefinition.rootParts.forEach((modelPart) => modelPart.transform.scale.scaleSelf(0.75));

    /* Models */
    const playerModel = await Model.fromDefinition(engine, playerModelDefinition);
    const rig = await Model.fromDefinition(engine, rigDefinition);

    /* Lighting */
    if (Flags.LightingEnabled) {
      const light = new PointLightNode(scene, 'light', { color: Color3.white() });
      light.position = new Vector3(1, 1, 2);
    }

    /* Camera */
    const cameraParent = new ObjectNode(scene, 'camera_parent');
    const cameraPivot = new ObjectNode(scene, 'camera_pivot', cameraParent);
    cameraPivot.position.z = 0.7;
    cameraPivot.rotation.euler = new Vector3(35, 0, 0);
    const camera = new CameraNode(scene, 'camera', 60, canvas.width / canvas.height, cameraPivot);

    let cameraDistance = 3;
    const repositionCamera = (): void => {
      camera.position.y = cameraDistance;
      camera.pointAt(cameraPivot.absolutePosition);
    };
    repositionCamera();

    const CameraRotateSpeed = 150;
    const CameraCursorFactor = 0.3;
    const CameraZoomSpeed = 2;

    input.lockPointer();

    runLoopHooks.push((dt) => {
      cameraParent.position = player.position;

      let cameraHSpeed = 0;
      let cameraVSpeed = 0;

      const cameraAxisXInput = input.getAxisValue('camera:x');
      const cameraAxisYInput = input.getAxisValue('camera:y');

      // @NOTE prefer joystick, fallback to cursor movement
      if (cameraAxisXInput !== 0 || cameraAxisYInput !== 0) {
        /* Joystick */
        cameraHSpeed = cameraAxisXInput * CameraRotateSpeed * dt;
        cameraVSpeed = cameraAxisYInput * CameraRotateSpeed * dt;
      } else {
        /* Pointer */
        cameraHSpeed = input.getPointer().xDelta * CameraCursorFactor;
        cameraVSpeed = -input.getPointer().yDelta * CameraCursorFactor;
      }

      cameraPivot.rotation.euler.z -= cameraHSpeed;
      cameraPivot.rotation.euler.x -= cameraVSpeed;

      cameraDistance += input.getAxisValue('camera:zoom') * CameraZoomSpeed * dt;
      if (input.wasButtonPressed('camera:zoom-in')) {
        cameraDistance -= CameraZoomSpeed * 0.2;
      }
      if (input.wasButtonPressed('camera:zoom-out')) {
        cameraDistance += CameraZoomSpeed * 0.2;
      }
      repositionCamera();
    });

    /* Scene */
    // Ground
    if (Flags.GroundEnabled) {
      const ground = new ModelNode(scene, 'ground', cubeModel);
      ground.scale = new Vector3(5, 5, 0.5);
      ground.position.z = -0.25;
    }

    // Player
    const player = new ModelNode(scene, 'player', playerModel);
    player.animationSource = rig;

    const playerSpeedH = Vector2.zero();
    let playerSpeedV = 0;
    const playerSpeed = Vector3.zero();
    const PlayerMaxSpeed = 3;
    const PlayerSprintFactor = 1.5;
    const Gravity = 0.4;
    const JumpSpeed = 0.075;

    runLoopHooks.unshift((dt) => { // @TODO lol `unshift` to reorder logic
      /* Input */
      playerSpeedH.setValue(0, 0);
      playerSpeedV -= Gravity * dt;

      playerSpeedH.x = input.getAxisValue('player:x');
      playerSpeedH.y = input.getAxisValue('player:y');

      if (input.wasButtonPressed('player:jump')) {
        playerSpeedV = JumpSpeed;
      }
      const isSprinting = input.isButtonDown('player:sprint');
      const movementSpeedFactor = isSprinting ? PlayerSprintFactor : 1;
      playerSpeedH.normalizeSelf().scaleSelf(PlayerMaxSpeed * dt * movementSpeedFactor);

      playerSpeed.setValue(playerSpeedH.x, playerSpeedH.y, 0);
      camera.absoluteRotation.q.rotateVectorInPlace(playerSpeed).setZ(playerSpeedV);

      /* Movement */
      player.absolutePosition.addSelf(playerSpeed);
      if (player.absolutePosition.z < 0) {
        player.absolutePosition.z = 0;
        playerSpeedV = 0;
      }

      /* Facing */
      if (playerSpeedH.lengthSquared() > 0) {
        player.playAnimation('Running_A', movementSpeedFactor);
        player.rotation.q.fromLookDirectionSelf(playerSpeed.withZ(0).scaleSelf(-1));
      } else {
        player.playAnimation('T-Pose');
      }
    });

    /* Run */
    engine.run((dt, time, stop) => {
      runLoopHooks.forEach((hook) => hook(dt));

      if (time > MaxRuntimeSeconds) {
        stop();
      }
    });
  }
}

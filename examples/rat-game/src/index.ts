import './style.css';

import { Vector3, Color3 } from '@lofi/core/math';
import { Engine } from '@lofi/engine/Engine';
import { Scene } from '@lofi/engine/scene';
import { WebFileSystem } from '@lofi/engine/filesystem/WebFileSystem';
import { DebugModule } from '@lofi/engine/util/DebugModule';

import { GamepadAxis, GamepadButton, InputSystem, KeyCode, MouseWheelDirection } from '@lofi/engine/input';
import { Room } from './Room';
import { Camera } from './Camera';
import { Player } from './Player';

DebugModule.register();

const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;

/* Engine */
const fileSystem = new WebFileSystem();
const engine = new Engine(canvas, fileSystem);
const scene = new Scene(engine);
scene.lighting.ambientColor = new Color3(30, 60, 30);


/* Input */
configureInput(engine.inputSystem);

/* Game */
const RoomSize = new Vector3(15, 15, 5);
const camera = new Camera(scene, canvas.width / canvas.height, RoomSize);
const player = await Player.create(scene, camera);
await Room.create(scene, RoomSize, player);

/* Run */
engine.run();

function configureInput(input: InputSystem): void {
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
}


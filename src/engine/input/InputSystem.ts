import type { Enum } from "@polyzone/engine/util/types";
import {
  GamepadAxis, type GamepadAxisValue,
  GamepadButton, type GamepadButtonValue,
  KeyCode, type KeyCodeValue,
  MouseButton, type MouseButtonValue,
  MouseWheelDirection, type MouseWheelDirectionValue,
} from './enum';
import type { NativeGamepadAxisIndex, NativeGamepadButtonIndex, NativeGamepadIndex, NumberNegativeOneToOne, NumberZeroToOne, PlayerNumber } from "./types";
import { NativeStandardGamepadAxisMapping, NativeStandardGamepadButtonMapping } from "./mapping";

export interface IInputSystem {
  configure(configuration: InputConfiguration): void;
  addInput(inputConfig: AddInputArgs): void;
  removeInput(type: 'button' | 'axis', name: string): void;
  addInputBinding(inputBinding: AddInputBindingArgs): void;
  removeInputBinding(inputBinding: RemoveInputBindingArgs): void;

  wasButtonPressed(buttonName: string, playerNumber?: PlayerNumber): boolean;
  wasButtonReleased(buttonName: string, playerNumber?: PlayerNumber): boolean;
  isButtonDown(buttonName: string, playerNumber?: PlayerNumber): boolean;
  getButtonValue(buttonName: string, playerNumber?: PlayerNumber): NumberZeroToOne;
  getAxisValue(axisName: string, playerNumber?: PlayerNumber): NumberNegativeOneToOne;

  lockPointer(): void;
  releasePointer(): void;
  getPointer(): InputSystem['state']['pointer'];

  listenForDevices(listenFn: (deviceId: InputDeviceId) => void): void;
  stopListeningForDevices(): void;
  assignInputDeviceToPlayer(playerNumber: PlayerNumber, deviceId: InputDeviceId): void;
}

/* Input bindings */
type RawButtonInput = Enum<typeof KeyCode> | Enum<typeof MouseButton> | Enum<typeof MouseWheelDirection> | Enum<typeof GamepadButton>;
export type ButtonInput = RawButtonInput | { axis: RawAxisInput, direction: 'positive' | 'negative' };
type RawAxisInput = Enum<typeof GamepadAxis>;
export type AxisInput = RawAxisInput | { min: RawButtonInput, max: RawButtonInput };

/* Input devices */
export type InputDeviceId = typeof KeyboardAndMouseDeviceId | GamepadDeviceId;
export type InputDeviceType = InputDeviceId['type'];
export type GamepadDeviceId = { type: 'Gamepad', gamepadIndex: NativeGamepadIndex };
export const KeyboardAndMouseDeviceId = { type: 'KeyboardAndMouse' as const };
export function gamepadIndexToDeviceId(index: NativeGamepadIndex): GamepadDeviceId {
  return {
    type: 'Gamepad',
    gamepadIndex: index,
  };
}

/* InputSystem state */
type InputState<TInput extends string | number, TRange extends number = NumberZeroToOne> = {
  current: Partial<Record<TInput, TRange>>;
  previous: Partial<Record<TInput, TRange>>;
}
type KeyboardInputState = InputState<KeyCodeValue>;
type MouseInputState = InputState<MouseButtonValue>;
type MouseWheelInputState = InputState<MouseWheelDirectionValue>;
type GamepadButtonInputState = InputState<GamepadButtonValue>;
type GamepadAxisInputState = InputState<GamepadAxisValue, NumberNegativeOneToOne>;

/* Function parameters */
export interface ButtonInputConfiguration {
  name: string;
  bindings: ButtonInput[];
}
export interface AxisInputConfiguration {
  name: string;
  bindings: AxisInput[];
}
export interface InputConfiguration {
  buttons?: ButtonInputConfiguration[];
  axes?: AxisInputConfiguration[];
}
export type AddInputArgs = ({ type: 'button' } & ButtonInputConfiguration) | ({ type: 'axis' } & AxisInputConfiguration);
export type AddInputBindingArgs = AddInputArgs;
export type RemoveInputBindingArgs = AddInputArgs;
export type ListenForDevicesCallback = (deviceId: InputDeviceId) => void;


export class InputSystem implements IInputSystem {
  private debug_allKnownKeyCodes: Set<string>;

  /**
   * Threshold over which an analog input is considered "pressed".
   */
  public analogButtonPressedThreshold = 0.2;
  /**
   * Threshold under which the value of an analog axis is ignored.
   */
  public analogAxisDeadZone = 0.1;

  /**
   * @NOTE Canvas requirements for touch input:
   *  - `tabindex="0"` (HTML) - Make game focusable
   *  - `touch-action: none` (CSS) - Prevent scrolling on mobile when dragging on the game
   *  - `user-select: none` (CSS) - Prevent selecting the canvas on mobile (e.g. long press)
   */
  private canvas: HTMLCanvasElement;
  /**
   * Mapping of input sources to semantic input actions.
   */
  private configuration: InputConfiguration;
  /**
   * Set of all currently-connected gamepad indices.
   */
  private connectedGamepadIndices: Set<NativeGamepadIndex>;
  /**
   * Mapping of players to their associated input devices.
   */
  private playerInputDeviceMapping: Map<PlayerNumber, Set<InputDeviceId>>;
  /**
   * List of callbacks fired any time a button is pressed.
   */
  private listenForDevicesCallbacks: Set<ListenForDevicesCallback>;

  /** State of all inputs for this frame and the previous frame. */
  private state = {
    isCanvasFocused: false,
    isPointerLocked: false,
    pointer: {
      x: undefined as number | undefined,
      y: undefined as number | undefined,
      xDelta: 0,
      yDelta: 0,
    },
    keyboard: {
      current: {},
      previous: {},
    } satisfies KeyboardInputState as KeyboardInputState,
    mouse: {
      current: {},
      previous: {},
    } satisfies MouseInputState as MouseInputState,
    mouseWheel: {
      current: {},
      previous: {},
    } satisfies MouseWheelInputState as MouseWheelInputState,
    gamepadButton: {
      /* @NOTE Gamepad state is first keyed by gamepad index */
    } as Record<NativeGamepadIndex, GamepadButtonInputState>,
    gamepadAxis: {
      /* @NOTE Gamepad state is first keyed by gamepad index */
    } as Record<NativeGamepadIndex, GamepadAxisInputState>,
  };

  public constructor(canvas: HTMLCanvasElement) {
    this.debug_allKnownKeyCodes = new Set();

    this.canvas = canvas;
    this.configuration = DefaultInputConfiguration;
    this.connectedGamepadIndices = new Set();
    this.playerInputDeviceMapping = new Map();

    this.listenForDevicesCallbacks = new Set();
    // @NOTE Assign keyboard and mouse by default
    this.assignInputDeviceToPlayer(0, KeyboardAndMouseDeviceId);

    canvas.addEventListener('keydown', (e) => this.onKeyDown(e));
    canvas.addEventListener('keyup', (e) => this.onKeyUp(e));
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e, true));
    canvas.addEventListener('mousewheel', (e) => this.onWheel(e as WheelEvent, false));
    window.addEventListener('gamepadconnected', (e) => this.onGamepadConnected(e));
    window.addEventListener('gamepaddisconnected', (e) => this.onGamepadDisconnected(e));

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    canvas.addEventListener('focus', () => {
      this.state.isCanvasFocused = true;
    });
    canvas.addEventListener('blur', () => {
      this.state.isCanvasFocused = false;
      this.state.keyboard.current = {};
      this.state.mouse.current = {};
      this.state.mouseWheel.current = {};
    });

    // @TODO @DEBUG REMOVE
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (window as any)['debug__logAllKnownCodes'] = () => {
      console.log(
        `Newly discovered keys\n`,
        [...this.debug_allKnownKeyCodes]
          .filter((code) => Object.keys(KeyCode).concat(Object.keys(ProblematicKeyCodes)).includes(code) === false)
          .map((code) => `${code}: '${code}',`)
          .join('\n'),
      );
    };
  }

  public configure(configuration: InputConfiguration): void {
    this.configuration = configuration;
  }

  public addInput(inputConfig: AddInputArgs): void {
    if (inputConfig.type === 'button') {
      /* Button */
      const existingButton = this.getButtonConfig(inputConfig.name);
      if (existingButton !== undefined) {
        throw new Error(`Cannot add new button input with name '${inputConfig.name}' - a button input already exists with this name`);
      }
      this.configuration.buttons?.push(inputConfig);
    } else if (inputConfig.type === 'axis') {
      /* Axis */
      const existingAxis = this.getAxisConfig(inputConfig.name);
      if (existingAxis !== undefined) {
        throw new Error(`Cannot add new axis input with name '${inputConfig.name}' - an axis input already exists with this name`);
      }
      this.configuration.axes?.push(inputConfig);
    } else {
      /* Unknown */
      throw new Error(`Unimplemented input type: '${(inputConfig as { type: string }).type}'`);
    }
  }

  public removeInput(type: 'button' | 'axis', name: string): void {
    if (type === 'button') {
      const inputConfigIndex = this.configuration.buttons?.findIndex((button) => button.name === name);
      if (inputConfigIndex && inputConfigIndex >= 0) {
        this.configuration.buttons?.splice(inputConfigIndex, 1);
      }
    } else if (type === 'axis') {
      const inputConfigIndex = this.configuration.axes?.findIndex((axis) => axis.name === name);
      if (inputConfigIndex && inputConfigIndex >= 0) {
        this.configuration.axes?.splice(inputConfigIndex, 1);
      }
    } else {
      throw new Error(`Unimplemented type: '${type as string}'`);
    }
  }

  public addInputBinding(inputBinding: AddInputBindingArgs): void {
    if (inputBinding.type === 'button') {
      /* Button */
      const inputConfig = this.getButtonConfig(inputBinding.name);
      if (inputConfig === undefined) {
        throw new Error(`Cannot add binding to button input with name '${inputBinding.name}' - no button input exists with this name`);
      }
      // Add each binding
      for (const binding of inputBinding.bindings) {
        // But only if the binding doesn't already exist
        if (!inputConfig.bindings.includes(binding)) {
          inputConfig.bindings.push(binding);
        }
      }
    } else if (inputBinding.type === 'axis') {
      /* Axis */
      const inputConfig = this.getAxisConfig(inputBinding.name);
      if (inputConfig === undefined) {
        throw new Error(`Cannot add binding to axis input with name '${inputBinding.name}' - no axis input exists with this name`);
      }
      // Add each binding
      for (const binding of inputBinding.bindings) {
        // But only if the binding doesn't already exist
        if (!inputConfig.bindings.includes(binding)) {
          inputConfig.bindings.push(binding);
        }
      }
    } else {
      /* Unknown */
      throw new Error(`Unimplemented input type: '${(inputBinding as { type: string }).type}'`);
    }
  }

  public removeInputBinding(inputBinding: RemoveInputBindingArgs): void {
    if (inputBinding.type === 'button') {
      /* Button */
      const inputConfig = this.getButtonConfig(inputBinding.name);
      if (inputConfig === undefined) {
        throw new Error(`Cannot remove binding from button input with name '${inputBinding.name}' - no button input exists with this name`);
      }
      // Remove each binding
      for (const binding of inputBinding.bindings) {
        // Fail silently if binding doesn't exist (idempotent)
        const bindingIndex = inputConfig.bindings.indexOf(binding);
        if (bindingIndex >= 0) {
          inputConfig.bindings.splice(bindingIndex, 1);
        }
      }
    } else if (inputBinding.type === 'axis') {
      /* Axis */
      const inputConfig = this.getAxisConfig(inputBinding.name);
      if (inputConfig === undefined) {
        throw new Error(`Cannot remove binding from axis input with name '${inputBinding.name}' - no axis input exists with this name`);
      }
      // Remove each binding
      for (const binding of inputBinding.bindings) {
        // Fail silently if binding doesn't exist (idempotent)
        const bindingIndex = inputConfig.bindings.indexOf(binding);
        if (bindingIndex >= 0) {
          inputConfig.bindings.splice(bindingIndex, 1);
        }
      }
    } else {
      /* Unknown */
      throw new Error(`Unimplemented input type: '${(inputBinding as { type: string }).type}'`);
    }
  }

  public wasButtonPressed(buttonName: string, playerNumber: PlayerNumber = 0): boolean {
    const buttonConfig = this.getButtonConfig(buttonName);
    if (buttonConfig === undefined) {
      return false;
    }

    const deviceIds = this.playerInputDeviceMapping.get(playerNumber);
    if (deviceIds === undefined || deviceIds.size === 0) {
      console.error(`[${InputSystem.name}] (${this.wasButtonPressed.name}) Player '${playerNumber}' has no input devices assigned`);
      return false;
    }

    let atLeastOneBindingWasPressed = false;
    for (const deviceId of deviceIds) {
      for (const binding of buttonConfig.bindings) {
        const inputState = this.getButtonInputState(deviceId, binding);

        // Binding is not tied to this device (e.g. 'South' gamepad button is not tied to 'KeyboardAndMouse' device)
        if (inputState === undefined) {
          continue;
        }

        if (inputState.previous > this.analogButtonPressedThreshold) {
          // Button was not pressed since at least one binding was already pressed last frame
          return false;
        } else {
          // We know this binding was not pressed last frame,
          // so we record if it is pressed this frame
          atLeastOneBindingWasPressed = inputState.current > this.analogButtonPressedThreshold || atLeastOneBindingWasPressed;
        }
      }
    }

    return atLeastOneBindingWasPressed;
  }

  public wasButtonReleased(buttonName: string, playerNumber: PlayerNumber = 0): boolean {
    const buttonConfig = this.getButtonConfig(buttonName);
    if (buttonConfig === undefined) {
      return false;
    }

    const deviceIds = this.playerInputDeviceMapping.get(playerNumber);
    if (deviceIds === undefined || deviceIds.size === 0) {
      console.error(`[${InputSystem.name}] (${this.wasButtonReleased.name}) Player '${playerNumber}' has no input devices assigned`);
      return false;
    }

    let atLeastOneBindingWasHeldLastFrame = false;
    for (const deviceId of deviceIds) {
      for (const binding of buttonConfig.bindings) {
        const inputState = this.getButtonInputState(deviceId, binding);

        // Binding is not tied to this device (e.g. 'South' gamepad button is not tied to 'KeyboardAndMouse' device)
        if (inputState === undefined) {
          continue;
        }

        if (inputState.current > this.analogButtonPressedThreshold) {
          // Button was not released since at least one binding is current being pressed this frame
          return false;
        } else {
          atLeastOneBindingWasHeldLastFrame = inputState.previous > this.analogButtonPressedThreshold || atLeastOneBindingWasHeldLastFrame;
        }
      }
    }

    return atLeastOneBindingWasHeldLastFrame;
  }

  public isButtonDown(buttonName: string, playerNumber: PlayerNumber = 0): boolean {
    const buttonValue = this.getButtonValue(buttonName, playerNumber);
    return buttonValue > this.analogButtonPressedThreshold;
  }

  public getButtonValue(buttonName: string, playerNumber: PlayerNumber = 0): NumberZeroToOne {
    const buttonConfig = this.getButtonConfig(buttonName);
    if (buttonConfig === undefined) {
      return 0;
    }

    const deviceIds = this.playerInputDeviceMapping.get(playerNumber);
    if (deviceIds === undefined || deviceIds.size === 0) {
      console.error(`[${InputSystem.name}] (${this.getButtonValue.name}) Player '${playerNumber}' has no input devices assigned`);
      return 0;
    }

    // Largest value we've seen from all inputs
    let maxValue: NumberZeroToOne = 0;

    for (const deviceId of deviceIds) {
      for (const binding of buttonConfig.bindings) {
        const inputState = this.getButtonInputState(deviceId, binding);

        // Binding is not tied to this device (e.g. 'South' gamepad button is not tied to 'KeyboardAndMouse' device)
        if (inputState === undefined) {
          continue;
        }

        if (inputState.current > maxValue) {
          maxValue = inputState.current;
        }
      }
    }

    return maxValue;
  }

  public getAxisValue(axisName: string, playerNumber: PlayerNumber = 0): NumberNegativeOneToOne {
    const axisConfig = this.getAxisConfig(axisName);
    if (axisConfig === undefined) {
      return 0;
    }

    const deviceIds = this.playerInputDeviceMapping.get(playerNumber);
    if (deviceIds === undefined || deviceIds.size === 0) {
      console.error(`[${InputSystem.name}] (${this.getAxisValue.name}) Player '${playerNumber}' has no input devices assigned`);
      return 0;
    }

    // Largest (magnitude) value we've seen from all inputs
    let maxValue: NumberNegativeOneToOne = 0;

    for (const deviceId of deviceIds) {
      for (const binding of axisConfig.bindings) {
        const inputState = this.getAxisInputState(deviceId, binding);

        // Binding is not tied to this device (e.g. 'JoyLeftX' gamepad axis is not tied to 'KeyboardAndMouse' device)
        if (inputState === undefined) {
          continue;
        }

        if (Math.abs(inputState.current) > Math.abs(maxValue)) {
          maxValue = inputState.current;
        }
      }
    }

    // Do not return a value if the largest magnitude number is less than the axis dead zone
    if (maxValue > this.analogAxisDeadZone || maxValue < -this.analogAxisDeadZone) {
      return maxValue;
    } else {
      return 0;
    }
  }

  public lockPointer(): void {
    // @NOTE mobile browsers don't have this API, so we must first check it exists.
    if ('requestPointerLock' in this.canvas) {
      this.state.isPointerLocked = true;

      // @NOTE This might fail. It will be retried on the next pointer event.
      void this.canvas.requestPointerLock().catch((e) => {
        console.warn(`Failed to request pointer lock. It will be retried on next player pointer interaction.`, e);
      });
    }
  }

  public releasePointer(): void {
    // @NOTE mobile browsers don't have this API, so we must first check it exists.
    if ('exitPointerLock' in document) {
      this.state.isPointerLocked = false;

      // @NOTE This might fail. It will be retried on the next pointer event.
      document.exitPointerLock();
    }
  }

  public getPointer(): InputSystem['state']['pointer'] {
    return this.state.pointer;
  }

  public listenForDevices(listenFn: (deviceId: InputDeviceId) => void): void {
    this.listenForDevicesCallbacks.add(listenFn);
  }

  public stopListeningForDevices(): void {
    this.listenForDevicesCallbacks.clear();
  }

  public assignInputDeviceToPlayer(playerNumber: PlayerNumber, deviceId: InputDeviceId): void {
    // Remove `deviceId` from every player
    for (const playerDevices of this.playerInputDeviceMapping.values()) {
      playerDevices.delete(deviceId);
    }

    // Ensure input mapping exists for player
    if (!this.playerInputDeviceMapping.has(playerNumber)) {
      this.playerInputDeviceMapping.set(playerNumber, new Set());
    }

    // Assign device to player
    const playerDevices = this.playerInputDeviceMapping.get(playerNumber)!;
    playerDevices.add(deviceId);
  }

  public onUpdate(): void {
    this.debug_updateCurrentInput();

    // Update input states (copy current -> previous)
    /* Keyboard */
    this.updateInputState(this.state.keyboard);
    /* Mouse */
    this.updateInputState(this.state.mouse);
    /* Mouse wheel */
    // @NOTE Always clear out mouse wheel state every frame as inputs are instantaneous only
    for (const key in this.state.mouseWheel.current) {
      delete this.state.mouseWheel.current[key as MouseWheelDirectionValue];
    }

    /* Cursor */
    // @NOTE Always clear out pointer delta every frame, since we only get
    // pointermove events when the pointer actually moves.
    this.state.pointer.xDelta = 0;
    this.state.pointer.yDelta = 0;


    /* Gamepad */
    for (const gamepadIndex of this.connectedGamepadIndices) {
      const gamepadButtonState = this.state.gamepadButton[gamepadIndex];
      const gamepadAxisState = this.state.gamepadAxis[gamepadIndex];

      this.updateInputState(gamepadButtonState);
      this.updateInputState(gamepadAxisState);

      // Gamepad input state is not handled by callbacks, it needs to be polled.
      // So we have to read it AFTER we've updated the previous frame's state.
      const gamepad = window.navigator.getGamepads()[gamepadIndex];
      if (gamepad !== null) {
        /* Buttons */
        for (let i: NativeGamepadButtonIndex = 0; i < gamepad.buttons.length; i++) {
          const button = gamepad.buttons[i];
          // @NOTE @ASSUMPTION Gamepads are all "standard" mapping
          // @TODO Support custom mapping non-standard controllers
          const gamepadBinding = NativeStandardGamepadButtonMapping[i];
          // Ignore extra / unmapped inputs
          if (gamepadBinding !== undefined) {
            gamepadButtonState.current[gamepadBinding.value] = button.value;

            // Check for button press
            if (
              gamepadButtonState.current[gamepadBinding.value]! > this.analogButtonPressedThreshold &&
              gamepadButtonState.previous[gamepadBinding.value]! < this.analogButtonPressedThreshold
            ) {
              this.notifyDeviceListeners(gamepadIndexToDeviceId(gamepadIndex));
            }
          }
        }
        /* Axes */
        for (let i: NativeGamepadAxisIndex = 0; i < gamepad.axes.length; i++) {
          const axis = gamepad.axes[i];
          // @NOTE @ASSUMPTION Gamepads are all "standard" mapping
          // @TODO Support custom mapping non-standard controllers
          const gamepadBinding = NativeStandardGamepadAxisMapping[i];
          // Ignore extra / unmapped inputs
          if (gamepadBinding !== undefined) {
            if (gamepadBinding.value === GamepadAxis.JoyLeftY.value || gamepadBinding.value === GamepadAxis.JoyRightY.value) {
              // @NOTE Insane decision from the authors of W3C Gamepad standard
              // to define vertical axis of gamepad joysticks as "negative up"
              // See: https://www.w3.org/TR/gamepad/#remapping
              // @TODO We can't do this if the layout isn't "standard"
              gamepadAxisState.current[gamepadBinding.value] = -axis;
            } else {
              gamepadAxisState.current[gamepadBinding.value] = axis;
            }
          }
        }
      } else {
        // I don't think this is "possible". Theoretically `getGamepads()` returns `null` for index 0 and `Gamepad`
        // data for every other index. So a connected gamepad would have to have index 0, which I don't think is valid.
        console.error(`[${InputSystem.name}] (${this.onUpdate.name}) Connected gamepad has index '${gamepadIndex}' with null gamepad data`);
      }
    }
  }

  private updateInputState<TInput extends string | number>(state: InputState<TInput>): void {
    // Iterate current inputs
    for (const key in state.current) {
      state.previous[key as TInput] = state.current[key as TInput] ?? 0;
    }
    // ALSO iterate previous inputs to update deletes / clears
    for (const key in state.previous) {
      state.previous[key as TInput] = state.current[key as TInput] ?? 0;
    }
  }

  /**
   * Get the value of an input binding (e.g. Spacebar) from a specific input device (e.g. KeyboardAndMouse).
   * If the binding doesn't make sense in the context of the device (e.g. a gamepad binding
   * from a keyboard input device) then `undefined` is returned.
   * @param deviceId Device to query.
   * @param binding Specific input binding to query within the device.
   * @returns Current + Previous input values, or `undefined` if the input binding does not belong to the device.
   */
  private getButtonInputState(deviceId: InputDeviceId, binding: ButtonInput): { current: NumberZeroToOne, previous: NumberZeroToOne } | undefined {
    /*
      @NOTE This is very exhaustive with lots of explicit no-ops so that
      we can be sure we are handling every scenario, including ones we
      intentionally want to ignore.
      This is so that if there's any new scenarios we haven't considered,
      they'll get caught and throw errors.
    */
    switch (deviceId.type) {
      case 'KeyboardAndMouse':
        if ('type' in binding) {
          switch (binding.type) {
            case 'Keyboard':
              return {
                current: this.state.keyboard.current[binding.value] ?? 0,
                previous: this.state.keyboard.previous[binding.value] ?? 0,
              };
            case 'Mouse':
              return {
                current: this.state.mouse.current[binding.value] ?? 0,
                previous: this.state.mouse.previous[binding.value] ?? 0,
              };
            case 'MouseWheel':
              return {
                current: this.state.mouseWheel.current[binding.value] ?? 0,
                previous: this.state.mouseWheel.previous[binding.value] ?? 0,
              };
            case 'GamepadButton':
              // @NOTE No-op
              return undefined;
            default:
              throw new Error(`Unimplemented binding type: ${(binding as { type: string }).type}`);
          }
        } else if ('axis' in binding) {
          switch (binding.axis.type) {
            case 'GamepadAxis':
              // @NOTE No-op
              return undefined;
            default:
              throw new Error(`Unimplemented axis binding type: '${binding.axis.type}'`);
          }
        } else {
          throw new Error(`Unimplemented binding type: ${JSON.stringify(binding)}`);
        }
      case 'Gamepad':
        if ('type' in binding) {
          switch (binding.type) {
            case 'Keyboard':
              // @NOTE No-op
              return undefined;
            case 'Mouse':
              // @NOTE No-op
              return undefined;
            case 'MouseWheel':
              // @NOTE No-op
              return undefined;
            case 'GamepadButton':
              return {
                current: this.state.gamepadButton[deviceId.gamepadIndex].current[binding.value] ?? 0,
                previous: this.state.gamepadButton[deviceId.gamepadIndex].previous[binding.value] ?? 0,
              };
            default:
              throw new Error(`Unimplemented binding type: ${(binding as { type: string }).type}`);
          }
        } else if ('axis' in binding) {
          // @NOTE Axis being used as a button
          switch (binding.axis.type) {
            case 'GamepadAxis': {
              let current = this.state.gamepadAxis[deviceId.gamepadIndex].current[binding.axis.value] ?? 0;
              let previous = this.state.gamepadAxis[deviceId.gamepadIndex].previous[binding.axis.value] ?? 0;

              // Cut axis in half, based on direction
              switch (binding.direction) {
                case 'positive':
                  current = Math.max(current, 0);
                  previous = Math.max(previous, 0);
                  break;
                case 'negative':
                  current = Math.max(-current, 0);
                  previous = Math.max(-previous, 0);
                  break;
              }

              return { current, previous };
            }
            default:
              throw new Error(`Unimplemented axis binding type: '${binding.axis.type}'`);
          }
        } else {
          throw new Error(`Unimplemented binding type: ${JSON.stringify(binding)}`);
        }
      default:
        throw new Error(`Unimplemented device type '${(deviceId as { type: string }).type}'`);
    }
  }
  private getAxisInputState(deviceId: InputDeviceId, binding: AxisInput): { current: NumberNegativeOneToOne, previous: NumberNegativeOneToOne } | undefined {
    /*
      @NOTE This is very exhaustive with lots of explicit no-ops so that
      we can be sure we are handling every scenario, including ones we
      intentionally want to ignore.
      This is so that if there's any new scenarios we haven't considered,
      they'll get caught and throw errors.
    */
    switch (deviceId.type) {
      case 'KeyboardAndMouse':
        if ('type' in binding) {
          switch (binding.type) {
            case 'GamepadAxis':
              // @NOTE No-op
              return undefined;
            default:
              throw new Error(`Unimplemented binding type: ${(binding as { type: string }).type}`);
          }
        } else if ('min' in binding && 'max' in binding) {
          // @NOTE Buttons being used as an axis
          const min = this.getButtonInputState(deviceId, binding.min);
          const max = this.getButtonInputState(deviceId, binding.max);

          // Device / input binding combination can still be invalid / not relevant
          // For example: calling getAxisInputState() for an axis binding like: { min: GamepadButton.DpadLeft, max: GamepadButton.DpadRight })
          // when the player is only assigned the keyboard device.
          if (min === undefined || max === undefined) {
            return undefined;
          }

          // Binding is relevant, add min + max as 1D "vectors", essentially.
          // If min is pressed, return -1.
          // If max is pressed, return 1.
          // If both min and max are pressed, return 0.
          return {
            current: (-1 * min.current) + max.current,
            previous: (-1 * min.previous) + max.previous,
          };
        } else {
          throw new Error(`Unimplemented binding type: ${JSON.stringify(binding)}`);
        }
      case 'Gamepad':
        if ('type' in binding) {
          switch (binding.type) {
            case 'GamepadAxis':
              return {
                current: this.state.gamepadAxis[deviceId.gamepadIndex].current[binding.value] ?? 0,
                previous: this.state.gamepadAxis[deviceId.gamepadIndex].previous[binding.value] ?? 0,
              };
            default:
              throw new Error(`Unimplemented binding type: ${(binding as { type: string }).type}`);
          }
        } else if ('min' in binding && 'max' in binding) {
          // @NOTE Buttons being used as an axis
          const min = this.getButtonInputState(deviceId, binding.min);
          const max = this.getButtonInputState(deviceId, binding.max);

          // Device / input binding combination can still be invalid / not relevant
          // For example: calling getAxisInputState() for an axis binding like: { min: GamepadButton.DpadLeft, max: GamepadButton.DpadRight })
          // when the player is only assigned the keyboard device.
          if (min === undefined || max === undefined) {
            return undefined;
          }

          // Binding is relevant, add min + max as 1D "vectors", essentially.
          // If min is pressed, return -1.
          // If max is pressed, return 1.
          // If both min and max are pressed, return 0.
          return {
            current: (-1 * min.current) + max.current,
            previous: (-1 * min.previous) + max.previous,
          };
        } else {
          throw new Error(`Unimplemented binding type: ${JSON.stringify(binding)}`);
        }
      default:
        throw new Error(`Unimplemented device type '${(deviceId as { type: string }).type}'`);
    }
  }

  private getButtonConfig(name: string): ButtonInputConfiguration | undefined {
    return this.configuration.buttons?.find((button) => button.name === name);
  }

  private getAxisConfig(name: string): AxisInputConfiguration | undefined {
    return this.configuration.axes?.find((axis) => axis.name === name);
  }

  /**
   * Check whether the pointer lock state matches reality and attempt
   * to change it if it doesn't.
   */
  private ensurePointerLockIsCorrect(): void {
    if (this.state.isPointerLocked && !this.isPointerActuallyLocked && 'requestPointerLock' in this.canvas) {
      void this.canvas.requestPointerLock().catch((e) => {
        console.warn(`Failed to request pointer lock. It will be retried on next player pointer interaction.`, e);
      });
    } else if (!this.state.isPointerLocked && this.isPointerActuallyLocked && 'exitPointerLock' in document) {
      document.exitPointerLock();
    }
  }

  /**
   * Notify all `listenForDevices()` callbacks that a device was pressed.
   * @param deviceId Id of the device that was pressed.
   */
  private notifyDeviceListeners(deviceId: InputDeviceId): void {
    for (const listenerFn of this.listenForDevicesCallbacks) {
      listenerFn(deviceId);
    }
  }

  private debug_updateCurrentInput(): void {
    const element = document.querySelector('#current-input');
    if (element) {
      const html: string[] = [];
      const span = (label: string, className?: string): string => `<span class="mr-1 p-2 ${className ?? 'bg-blue-300'}">${label}</span>`;

      const inputStateDown = <TInput extends string>(state: InputState<TInput>, toLabel: (input: TInput, value: number) => string): void => {
        for (const key in state.current) {
          const value: number | undefined = state.current[key as TInput];
          if (Math.abs(value!) > this.analogButtonPressedThreshold) {
            html.push(span(toLabel(key as TInput, value!)));
          }
        }
      };

      const inputStateMomentary = <TInput extends string>(state: InputState<TInput>, toLabel: (input: TInput) => string): void => {
        for (const key in state.current) {
          const currentValue: number | undefined = state.current[key as TInput];
          const previousValue: number | undefined = state.previous[key as TInput];
          if (
            Math.abs(currentValue!) > this.analogButtonPressedThreshold &&
            !(Math.abs(previousValue!) > this.analogButtonPressedThreshold)
          ) {
            html.push(span(toLabel(key as TInput), `bg-[red]`));
          }
        }
        for (const key in state.previous) {
          const currentValue: number | undefined = state.current[key as TInput];
          const previousValue: number | undefined = state.previous[key as TInput];
          if (
            !(Math.abs(currentValue!) > this.analogButtonPressedThreshold) &&
            Math.abs(previousValue!) > this.analogButtonPressedThreshold
          ) {
            html.push(span(toLabel(key as TInput), `bg-[purple]`));
          }
        }
      };

      html.push(`<div class="mb-2">`);

      inputStateDown(this.state.keyboard, (key, value) => `Key:${key}:${value}`);
      inputStateDown(this.state.mouse, (button, value) => `Mouse:${button}:${value}`);
      inputStateDown(this.state.mouseWheel, (direction, value) => `Wheel:${direction}:${value}`);
      for (const gamepadIndex of this.connectedGamepadIndices) {
        if (this.state.gamepadButton[gamepadIndex]) {
          inputStateDown(this.state.gamepadButton[gamepadIndex], (button, value) => `GamepadButton:${gamepadIndex}:${button}:${value}`);
        }
        if (this.state.gamepadAxis[gamepadIndex]) {
          inputStateDown(this.state.gamepadAxis[gamepadIndex], (axis, value) => `GamepadAxis:${gamepadIndex}:${axis}:${value}`);
        }
      }

      inputStateMomentary(this.state.keyboard, (key) => `Key:${key}`);
      inputStateMomentary(this.state.mouse, (button) => `Mouse:${button}`);
      inputStateMomentary(this.state.mouseWheel, (direction) => `Wheel:${direction}`);
      for (const gamepadIndex of this.connectedGamepadIndices) {
        if (this.state.gamepadButton[gamepadIndex]) {
          inputStateMomentary(this.state.gamepadButton[gamepadIndex], (button) => `GamepadButton:${gamepadIndex}:${button}`);
        }
        if (this.state.gamepadAxis[gamepadIndex]) {
          inputStateMomentary(this.state.gamepadAxis[gamepadIndex], (axis) => `GamepadAxis:${gamepadIndex}:${axis}`);
        }
      }

      html.push(`</div>`);

      element.innerHTML = html.join('\n');
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.debug_allKnownKeyCodes.add(e.code); // @TODO @DEBUG REMOVE
    // Ignore key "repeats" and "problematic" keys
    if (e.repeat || ProblematicKeyCodes[e.code]) return;

    e.preventDefault();

    // Watch for unfamiliar keys (mostly @DEBUG)
    if (!(e.code in KeyCode)) {
      console.warn(`[${InputSystem.name}] (${this.onKeyDown.name}}) Unfamiliar key pressed: ${e.code}`);
    }

    // Mark key as currently pressed
    this.state.keyboard.current[e.code as KeyCodeValue] = 1;

    this.notifyDeviceListeners(KeyboardAndMouseDeviceId);
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (ProblematicKeyCodes[e.code]) {
      // @NOTE "Problematic" keys can cause other keys to stick.
      // For example (on MacOS) while Cmd is pressed, `keyup` events don't fire.
      // Another example: Pressing Opt => Ctrl => L. Pressing `Opt` does not fire `keydown`, releasing `L` does not fire `keyup`
      // @TODO I think there's some kind of hacks we can do here to work somewhat around this
      // but I see obvious bugs in Babylon.js, so I don't think it can be fully solved.
      // I promise I've tried various things to try and track this state but I think the most
      // predictable thing we can do is just clear the state of all keys when you release one
      // of these problematic keys. They aren't bindable in the engine so there should be no
      // reason a user expects to be able to press them while playing a game and expect
      // other keys to remain held.
      this.state.keyboard.current = {};
      return;
    }

    e.preventDefault();

    // Watch for unfamiliar keys (mostly @DEBUG)
    if (!(e.code in KeyCode)) {
      console.warn(`[${InputSystem.name}] (${this.onKeyUp.name}}) Unfamiliar key released: ${e.code}`);
    }

    // Mark key as not currently pressed
    delete this.state.keyboard.current[e.code as KeyCodeValue];
  }

  /**
   * Update the current mouse input state from a `buttons`
   * bit mask, emitted from PointerEvents.
   * @param buttonsBitMask Bit mask of mouse button states.
   */
  private updateMouseState(buttonsBitMask: number): void {
    let buttonNumber = 0;

    // Clear out current state
    for (const mouseButton in this.state.mouse.current) {
      delete this.state.mouse.current[mouseButton as unknown as MouseButtonValue]; // @NOTE Type laundering because strings are fine here.
    }

    // Read each bit, only store buttons that are pressed
    while (buttonsBitMask !== 0) {
      const buttonState = (buttonsBitMask & 0x1);
      if (buttonState > 0) {
        this.state.mouse.current[buttonNumber as MouseButtonValue] = buttonState;
      }

      buttonNumber++;
      buttonsBitMask >>= 1;
    }
  }

  private onPointerDown(e: PointerEvent): void {
    // Only acknowledge `pointerdown` if the canvas is already focused.
    // Otherwise we would prevent focusing the canvas initially (i.e. by clicking on it)
    // This also means the first click is ignored i.e. focusing the canvas doesn't take an action
    if (this.state.isCanvasFocused) {
      e.preventDefault();

      if (!this.isPointerActuallyLocked) {
        // Capture pointer, for dragging outside of the canvas
        this.canvas.setPointerCapture(e.pointerId);
      }

      this.ensurePointerLockIsCorrect();

      // Update mouse state from current buttons bit mask
      this.updateMouseState(e.buttons);

      this.notifyDeviceListeners(KeyboardAndMouseDeviceId);
    }
  }

  private onPointerUp(e: PointerEvent): void {
    // Only acknowledge `pointerup` if the canvas is already focused.
    // This prevents some edge cases where e.g. clicking and dragging into the canvas
    // doesn't misfire a rogue `pointerup` event.
    if (this.state.isCanvasFocused) {
      e.preventDefault();

      // If remove touch / stylus input, deactivate the cursor
      if (e.pointerType !== 'mouse') {
        this.state.pointer.x = undefined;
        this.state.pointer.y = undefined;
      }

      this.ensurePointerLockIsCorrect();

      // Update mouse state from current buttons bit mask
      this.updateMouseState(e.buttons);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    /**
     * @NOTE Tricky variable to name.
     * "Active" means we should be listening to pointer movements.
     * If the pointer is supposed to be locked (through `lockPointer()`)
     * and the pointer is actually locked then it is active.
     * If the pointer is supposed to be locked but the pointer lock is not
     * actually locked (because e.g. the user pressed escape) then the pointer
     * is NOT active.
     * If the pointer is not supposed to be locked then it is always active.
     * This feels intuitive on the page but is hard to think about
     * in the code here.
     */
    const isPointerActive = !this.state.isPointerLocked || this.isPointerActuallyLocked;
    if (this.state.isCanvasFocused && isPointerActive) {
      const { canvas } = this;
      const pageToCanvasX = canvas.width / canvas.clientWidth;
      const pageToCanvasY = canvas.height / canvas.clientHeight;

      this.state.pointer.x = e.offsetX * pageToCanvasX;
      this.state.pointer.y = e.offsetY * pageToCanvasY;

      this.state.pointer.xDelta = e.movementX * pageToCanvasX;
      this.state.pointer.yDelta = e.movementY * pageToCanvasY;

      // Update mouse state from current buttons bit mask
      // @NOTE Weird to do this in `pointermove` you might ask?
      // Yeah, pretty weird. But you might be surprised to learn
      // this is how the specification works.
      // `pointerup` and `pointerdown` don't fire if you are already
      // pressing another mouse button. The specification says
      // that subsequent mouse pressed must generate `pointermove`
      // events.
      this.updateMouseState(e.buttons);
    }
  }

  private onWheel(e: WheelEvent, _isLegacy: boolean): void {
    e.preventDefault();

    // Detect which is the primary direction of scrolling
    // This is the input that will be fired this frame
    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);
    const absZ = Math.abs(e.deltaZ);
    let type: MouseWheelDirectionValue;
    if (absZ > absX && absZ > absY) {
      if (e.deltaZ < 0) {
        type = 'back';
      } else {
        type = 'forward';
      }
    } else if (absX > absY && absX > absZ) {
      if (e.deltaX < 0) {
        type = 'left';
      } else {
        type = 'right';
      }
    } else {
      if (e.deltaY < 0) {
        type = 'up';
      } else {
        type = 'down';
      }
    }
    this.state.mouseWheel.current[type] = 1;

    this.notifyDeviceListeners(KeyboardAndMouseDeviceId);
  }

  private onGamepadConnected(e: GamepadEvent): void {
    const { gamepad } = e;

    if (gamepad.mapping !== 'standard') {
      // @TODO support custom mapping of buttons for non-standard controllers
      console.warn(`Ignoring non-standard controller: ${gamepad.id}`);
      return;
    }

    this.connectedGamepadIndices.add(gamepad.index);

    // Ensure state is initialised for this gamepad
    this.state.gamepadButton[gamepad.index] ??= {
      current: {},
      previous: {},
    };
    this.state.gamepadAxis[gamepad.index] ??= {
      current: {},
      previous: {},
    };

    // Assign first controller to player 0 by default
    if (this.connectedGamepadIndices.size === 1) {
      this.assignInputDeviceToPlayer(0, gamepadIndexToDeviceId(gamepad.index));
    }
  }

  private onGamepadDisconnected(e: GamepadEvent): void {
    const { gamepad } = e;
    this.connectedGamepadIndices.delete(gamepad.index);

    // @TODO @DEBUG REMOVE
    console.log(`[${InputSystem.name}] (${this.onGamepadDisconnected.name}) Gamepad disconnected. Total gamepads connected: ${this.connectedGamepadIndices.size}`, e);
  }

  /**
   * Whether the pointer is actually locked in the DOM.
   * Does not necessarily reflect the value in `state`.
   * For example, if the user pressed Escape and exits
   * pointer lock, the values will not agree.
   */
  private get isPointerActuallyLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }
}

/**
 * "Problematic" keys on a keyboard that can cause bugs in different
 * environments. Pressing any of these keys clears all currently pressed keyboard inputs.
 */
export const ProblematicKeyCodes: Record<string, true> = {
  ['MetaLeft']: true,
  ['MetaRight']: true,
  ['AltLeft']: true,
  ['AltRight']: true,
};

export const DefaultInputConfiguration: InputConfiguration = {
  buttons: [
    {
      name: 'jump',
      bindings: [
        KeyCode.Space,
        GamepadButton.South,
      ],
    },
    {
      name: 'action',
      bindings: [
        KeyCode.KeyF,
        GamepadButton.West,
      ],
    },
  ],
  axes: [
    {
      name: 'player:x',
      bindings: [
        { min: KeyCode.KeyA, max: KeyCode.KeyD },
        { min: KeyCode.ArrowLeft, max: KeyCode.ArrowRight },
        GamepadAxis.JoyLeftX,
      ],
    },
    {
      name: 'player:y',
      bindings: [
        { min: KeyCode.KeyS, max: KeyCode.KeyW },
        { min: KeyCode.ArrowDown, max: KeyCode.ArrowUp },
        GamepadAxis.JoyLeftY,
      ],
    },
  ],
};

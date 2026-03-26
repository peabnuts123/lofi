import type { Enum } from "@polyzone/engine/util/enum";

/*
  @TODO Backlog
    // - Gamepad binding
    // - Axes
    - Pointer position / delta
    // - Axes as buttons
    - Virtual gamepads (on screen)

    - A callback for "on any input" => get device ID / stop listening
    // - Method to set player X is device ID Y
    // - Player 1 is assumed to be device ID 0, player 2 is assumed to be device Id 1, etc.
    - A callback for gamepads connecting / disconnecting?
    - Hack Y axis of standard controllers to be `positive=up`...
    - Tidy this dang class up
    - Write tests
 */
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

  assignInputDeviceToPlayer(playerNumber: PlayerNumber, deviceId: InputDeviceId): void;
}

type InputState<TInput extends string | number, TRange extends number = NumberZeroToOne> = {
  current: Partial<Record<TInput, TRange>>;
  previous: Partial<Record<TInput, TRange>>;
}
type KeyboardInputState = InputState<KeyCodeValue>;
type MouseInputState = InputState<MouseButtonValue>;
type MouseWheelInputState = InputState<MouseWheelDirectionValue>;
type GamepadButtonInputState = InputState<GamepadButtonValue>;
type GamepadAxisInputState = InputState<GamepadAxisValue, NumberNegativeOneToOne>;

type RawButtonInput = Enum<typeof KeyCode> | Enum<typeof MouseButton> | Enum<typeof MouseWheelDirection> | Enum<typeof GamepadButton>;
export type ButtonInput = RawButtonInput | { axis: RawAxisInput, direction: 'positive' | 'negative' };
export interface ButtonInputConfiguration {
  name: string;
  bindings: ButtonInput[];
}
type RawAxisInput = Enum<typeof GamepadAxis>;
export type AxisInput = RawAxisInput | { min: RawButtonInput, max: RawButtonInput };
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

export class InputSystem implements IInputSystem {
  private debug_allKnownKeyCodes: Set<string>;
  private debug_console: InputSystemConsole;

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


  /** State of all inputs for this frame and the previous frame. */
  private state = {
    isCanvasFocused: false,
    keyboard: {
      current: {},
      previous: {},
    } satisfies KeyboardInputState as KeyboardInputState,
    mouse: {
      current: {},
      previous: {},
    } satisfies KeyboardInputState as MouseInputState,
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
    this.debug_console = new InputSystemConsole();

    this.canvas = canvas;
    this.configuration = DefaultInputConfiguration;
    this.connectedGamepadIndices = new Set();
    this.playerInputDeviceMapping = new Map();
    // @NOTE Assign keyboard and mouse by default
    this.assignInputDeviceToPlayer(0, KeyboardAndMouseDeviceId);

    canvas.addEventListener('keydown', (e) => this.onKeyDown(e));
    canvas.addEventListener('keyup', (e) => this.onKeyUp(e));
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e, true));
    canvas.addEventListener('mousewheel', (e) => this.onWheel(e as WheelEvent, false));
    window.addEventListener('gamepadconnected', (e) => this.onGamepadConnected(e));
    window.addEventListener('gamepaddisconnected', (e) => this.onGamepadDisconnected(e));

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    canvas.addEventListener('focus', () => {
      this.debug_console.log(`Focused game.`);
      this.state.isCanvasFocused = true;
    });
    canvas.addEventListener('blur', () => {
      this.debug_console.log(`Lost focus.`);
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
    console.log(`[DEBUG] Assigning device '${JSON.stringify(deviceId)}' to player '${playerNumber}'`);
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
      If there's any new scenarios we haven't considered, they'll get caught
      and throw errors.
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
      If there's any new scenarios we haven't considered, they'll get caught
      and throw errors.
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

    this.debug_console.log(`[${InputSystem.name}] (${this.onKeyDown.name}) ${e.code}`); // @TODO @DEBUG REMOVE

    // Watch for unfamiliar keys (mostly @DEBUG)
    if (!(e.code in KeyCode)) {
      console.warn(`[${InputSystem.name}] (${this.onKeyDown.name}}) Unfamiliar key pressed: ${e.code}`);
    }

    // Mark key as currently pressed
    this.state.keyboard.current[e.code as KeyCodeValue] = 1;
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

    this.debug_console.log(`[${InputSystem.name}] (${this.onKeyUp.name}) ${e.code}`); // @TODO @DEBUG REMOVE

    // Watch for unfamiliar keys (mostly @DEBUG)
    if (!(e.code in KeyCode)) {
      console.warn(`[${InputSystem.name}] (${this.onKeyUp.name}}) Unfamiliar key released: ${e.code}`);
    }

    // Mark key as not currently pressed
    delete this.state.keyboard.current[e.code as KeyCodeValue];
  }

  private onPointerDown(e: PointerEvent): void {
    // Only acknowledge `pointerdown` if the canvas is already focused.
    // Otherwise we would prevent focusing the canvas initially (i.e. by clicking on it)
    // This also means the first click is ignored i.e. focusing the canvas doesn't take an action
    if (this.state.isCanvasFocused) {
      e.preventDefault();

      this.debug_console.log(`[${InputSystem.name}] (${this.onPointerDown.name}) ${e.button} (${e.pointerType})`); // @TODO @DEBUG REMOVE

      // Capture pointer, for dragging outside of the canvas
      this.canvas.setPointerCapture(e.pointerId);

      // Mark mouse button as currently pressed
      this.state.mouse.current[e.button as MouseButtonValue] = 1;
    }
  }

  private onPointerUp(e: PointerEvent): void {
    // Only acknowledge `pointerup` if the canvas is already focused.
    // This prevents some edge cases where e.g. clicking and dragging into the canvas
    // doesn't misfire a rogue `pointerup` event.
    if (this.state.isCanvasFocused) {
      this.debug_console.log(`[${InputSystem.name}] (${this.onPointerUp.name}) ${e.button} (${e.pointerType})`); // @TODO @DEBUG REMOVE

      // Mark mouse button as not currently pressed
      delete this.state.mouse.current[e.button as MouseButtonValue];
    }
  }

  private onWheel(e: WheelEvent, isLegacy: boolean): void {
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
    this.debug_console.log(`[${InputSystem.name}] (${this.onWheel.name}) Wheel ${type}${isLegacy ? " (legacy)" : ""}`);// @TODO @DEBUG REMOVE
    this.state.mouseWheel.current[type] = 1;
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

    // @TODO @DEBUG REMOVE
    console.log(`[${InputSystem.name}] (${this.onGamepadConnected.name}) Gamepad connected (${e.gamepad.index}). Total gamepads connected: ${this.connectedGamepadIndices.size}`,
      gamepad.id,
      gamepad.buttons,
      gamepad.axes,
      e);
  }
  private onGamepadDisconnected(e: GamepadEvent): void {
    const { gamepad } = e;
    this.connectedGamepadIndices.delete(gamepad.index);

    // @TODO @DEBUG REMOVE
    console.log(`[${InputSystem.name}] (${this.onGamepadDisconnected.name}) Gamepad disconnected. Total gamepads connected: ${this.connectedGamepadIndices.size}`, e);
  }
}

// @TODO DEBUG
class InputSystemConsole {
  private console: Element | null;
  public constructor() {
    this.console = document.querySelector('#input-system-console');
  }

  public log(str: string): void {
    // console.log(`[InputSystem] (Console) ${str}`);
    if (this.console) {
      this.console.innerHTML = `${str}\n` + this.console.innerHTML;
    }
  }
}

/**
 * An enum that holds a mapping of friendly names to an object containing
 * the type of the enum as well as the raw / native value
 * e.g.
 * ```json
 * {
 *   "KeyA": { "type": "Keyboard", "value": "KeyA" },
 *   "KeyS": { "type": "Keyboard", "value": "KeyS" },
 *   ...
 * }
 * ```
 */
type InputEnum<TType extends string, TEnum extends object> = {
  [T in keyof TEnum]: { type: TType, value: TEnum[T] }
};
/**
 * Convert a raw enum object into an `InputEnum`.
 * @param type
 * @param enumObj
 */
function createInputEnum<TType extends string, TEnum extends object>(type: TType, enumObj: TEnum): InputEnum<TType, TEnum> {
  const result: Partial<InputEnum<TType, TEnum>> = {};
  for (const key in enumObj) {
    result[key] = { type, value: enumObj[key] };
  }
  return result as InputEnum<TType, TEnum>;
}
/** Extract every value from an `InputEnum`. */
type InputEnumValues<T extends InputEnum<any, any>> = T[keyof T]['value']
/** Extract the type from an `InputEnum`. */
type InputEnumType<T extends InputEnum<any, any>> = T[keyof T]['type']

/**
 * A button pressed on a mouse.
 */
export const MouseButton = createInputEnum('Mouse', {
  Left: 0 as const,
  Middle: 1 as const,
  Right: 2 as const,
});
export type MouseButtonValue = InputEnumValues<typeof MouseButton>;

/**
 * A scroll input in a particular direction.
 * Note that the frequency of "pressed" events for these inputs
 * varies wildly based on the input device. For example, some trackpads and other
 * devices may fire a "pressed" event every frame.
 *
 * NOTE: Mouse wheel inputs DO NOT fire "released" events. They are instantaneous inputs only.
 */
export const MouseWheelDirection = createInputEnum('MouseWheel', {
  Up: 'up' as const,
  Down: 'down' as const,
  Left: 'left' as const,
  Right: 'right' as const,
  Forward: 'forward' as const,
  Back: 'back' as const,
});
export type MouseWheelDirectionValue = InputEnumValues<typeof MouseWheelDirection>;

// @TODO Expand this by testing on other devices
/**
 * A key pressed on a keyboard.
 */
export const KeyCode = createInputEnum('Keyboard', {
  Escape: 'Escape' as const,
  F1: 'F1' as const,
  F2: 'F2' as const,
  F3: 'F3' as const,
  F4: 'F4' as const,
  F5: 'F5' as const,
  F6: 'F6' as const,
  F7: 'F7' as const,
  F8: 'F8' as const,
  F9: 'F9' as const,
  F10: 'F10' as const,
  F11: 'F11' as const,
  F12: 'F12' as const,
  F13: 'F13' as const,
  F14: 'F14' as const,
  F15: 'F15' as const,
  F16: 'F16' as const,
  F17: 'F17' as const,
  F18: 'F18' as const,
  F19: 'F19' as const,
  F20: 'F20' as const,
  Backquote: 'Backquote' as const,
  Digit1: 'Digit1' as const,
  Digit2: 'Digit2' as const,
  Digit3: 'Digit3' as const,
  Digit4: 'Digit4' as const,
  Digit5: 'Digit5' as const,
  Digit6: 'Digit6' as const,
  Digit7: 'Digit7' as const,
  Digit8: 'Digit8' as const,
  Digit9: 'Digit9' as const,
  Digit0: 'Digit0' as const,
  Minus: 'Minus' as const,
  Equal: 'Equal' as const,
  Backspace: 'Backspace' as const,
  Tab: 'Tab' as const,
  KeyQ: 'KeyQ' as const,
  KeyW: 'KeyW' as const,
  KeyE: 'KeyE' as const,
  KeyR: 'KeyR' as const,
  KeyT: 'KeyT' as const,
  KeyY: 'KeyY' as const,
  KeyU: 'KeyU' as const,
  KeyI: 'KeyI' as const,
  KeyO: 'KeyO' as const,
  KeyP: 'KeyP' as const,
  BracketLeft: 'BracketLeft' as const,
  BracketRight: 'BracketRight' as const,
  Backslash: 'Backslash' as const,
  CapsLock: 'CapsLock' as const,
  KeyA: 'KeyA' as const,
  KeyS: 'KeyS' as const,
  KeyD: 'KeyD' as const,
  KeyF: 'KeyF' as const,
  KeyG: 'KeyG' as const,
  KeyH: 'KeyH' as const,
  KeyJ: 'KeyJ' as const,
  KeyK: 'KeyK' as const,
  KeyL: 'KeyL' as const,
  Semicolon: 'Semicolon' as const,
  Quote: 'Quote' as const,
  Enter: 'Enter' as const,
  ShiftLeft: 'ShiftLeft' as const,
  KeyZ: 'KeyZ' as const,
  KeyX: 'KeyX' as const,
  KeyC: 'KeyC' as const,
  KeyV: 'KeyV' as const,
  KeyB: 'KeyB' as const,
  KeyN: 'KeyN' as const,
  KeyM: 'KeyM' as const,
  Comma: 'Comma' as const,
  Period: 'Period' as const,
  Slash: 'Slash' as const,
  ShiftRight: 'ShiftRight' as const,
  ControlLeft: 'ControlLeft' as const,
  Space: 'Space' as const,
  ControlRight: 'ControlRight' as const,
  Home: 'Home' as const,
  Delete: 'Delete' as const,
  End: 'End' as const,
  PageUp: 'PageUp' as const,
  PageDown: 'PageDown' as const,
  ArrowLeft: 'ArrowLeft' as const,
  ArrowRight: 'ArrowRight' as const,
  ArrowUp: 'ArrowUp' as const,
  ArrowDown: 'ArrowDown' as const,
  Numpad0: 'Numpad0' as const,
  Numpad1: 'Numpad1' as const,
  Numpad2: 'Numpad2' as const,
  Numpad3: 'Numpad3' as const,
  Numpad4: 'Numpad4' as const,
  Numpad5: 'Numpad5' as const,
  Numpad6: 'Numpad6' as const,
  Numpad7: 'Numpad7' as const,
  Numpad8: 'Numpad8' as const,
  Numpad9: 'Numpad9' as const,
  NumpadDecimal: 'NumpadDecimal' as const,
  NumpadEnter: 'NumpadEnter' as const,
  NumpadAdd: 'NumpadAdd' as const,
  NumpadSubtract: 'NumpadSubtract' as const,
  NumpadMultiply: 'NumpadMultiply' as const,
  NumpadDivide: 'NumpadDivide' as const,
  NumpadEqual: 'NumpadEqual' as const,
  NumLock: 'NumLock' as const,
});
export type KeyCodeValue = InputEnumValues<typeof KeyCode>;

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
/**
 * A button pressed on any gamepad / controller.
 */
export const GamepadButton = createInputEnum('GamepadButton', {
  South: 'South' as const,
  East: 'East' as const,
  West: 'West' as const,
  North: 'North' as const,
  L1: 'L1' as const,
  R1: 'R1' as const,
  L2: 'L2' as const,
  R2: 'R2' as const,
  Select: 'Select' as const,
  Start: 'Start' as const,
  L3: 'L3' as const,
  R3: 'R3' as const,
  DpadUp: 'DpadUp' as const,
  DpadDown: 'DpadDown' as const,
  DpadLeft: 'DpadLeft' as const,
  DpadRight: 'DpadRight' as const,
  Home: 'Home' as const,
});
export type GamepadButtonValue = InputEnumValues<typeof GamepadButton>;

/**
 * A 1D axis on any gamepad / controller.
 */
export const GamepadAxis = createInputEnum('GamepadAxis', {
  JoyLeftX: 'JoyLeftX' as const,
  JoyLeftY: 'JoyLeftY' as const,
  JoyRightX: 'JoyRightX' as const,
  JoyRightY: 'JoyRightY' as const,
});
export type GamepadAxisValue = InputEnumValues<typeof GamepadAxis>;

/**
 * Mapping of native button indices to `GamepadButton` enum.
 */
export const NativeStandardGamepadButtonMapping: Record<NativeGamepadButtonIndex, typeof GamepadButton[keyof typeof GamepadButton]> = {
  // See: https://www.w3.org/TR/gamepad/#remapping
  [0]: GamepadButton.South,
  [1]: GamepadButton.East,
  [2]: GamepadButton.West,
  [3]: GamepadButton.North,
  [4]: GamepadButton.L1,
  [5]: GamepadButton.R1,
  [6]: GamepadButton.L2,
  [7]: GamepadButton.R2,
  [8]: GamepadButton.Select,
  [9]: GamepadButton.Start,
  [10]: GamepadButton.L3,
  [11]: GamepadButton.R3,
  [12]: GamepadButton.DpadUp,
  [13]: GamepadButton.DpadDown,
  [14]: GamepadButton.DpadLeft,
  [15]: GamepadButton.DpadRight,
  [16]: GamepadButton.Home,
};
/**
 * Mapping of native axis indices to `GamepadAxis` enum.
 */
export const NativeStandardGamepadAxisMapping: Record<NativeGamepadAxisIndex, typeof GamepadAxis[keyof typeof GamepadAxis]> = {
  // See: https://www.w3.org/TR/gamepad/#remapping
  [0]: GamepadAxis.JoyLeftX,
  [1]: GamepadAxis.JoyLeftY,
  [2]: GamepadAxis.JoyRightX,
  [3]: GamepadAxis.JoyRightY,
};

/**
 * Index of a connected gamepad input. Unique to each connected gamepad. Assigned when the gamepad is connected.
 */
export type NativeGamepadIndex = number;
/**
 * Index of a button input on a gamepad.
 */
export type NativeGamepadButtonIndex = number;
/**
 * Index of an axis input on a gamepad.
 */
export type NativeGamepadAxisIndex = number;

/**
 * Enum type of every input enum i.e. every type of input binding.
 */
export type InputBindingType = InputEnumType<typeof MouseButton> | InputEnumType<typeof MouseWheelDirection> | InputEnumType<typeof KeyCode> | InputEnumType<typeof GamepadButton> | InputEnumType<typeof GamepadAxis>;

/** A player index. Player 1 is `0`. */
export type PlayerNumber = number;
/** A number that is intended to be between values 0 and 1 (inclusive) */
export type NumberZeroToOne = number;
/** A number that is intended to be between values -1 and 1 (inclusive) */
export type NumberNegativeOneToOne = number;

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

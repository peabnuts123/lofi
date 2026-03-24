import type { Enum } from "@polyzone/engine/util/enum";

export interface IInputSystem {
  configure(configuration: InputConfiguration): void;
  addInput(inputConfig: AddInputArgs): void;
  removeInput(type: 'button' | 'axis', name: string): void;
  addInputBinding(inputBinding: AddInputBindingArgs): void;
  removeInputBinding(inputBinding: RemoveInputBindingArgs): void;

  wasButtonPressed(buttonName: string): boolean;
  wasButtonReleased(buttonName: string): boolean;
  isButtonDown(buttonName: string): boolean;
  getAxis(axisName: string): number;
}

type InputState<TInput extends string | number> = {
  current: Partial<Record<TInput, boolean>>;
  previous: Partial<Record<TInput, boolean>>;
}
type KeyboardInputState = InputState<KeyCodeValue>;
type MouseInputState = InputState<MouseButtonValue>;
type MouseWheelInputState = InputState<MouseWheelDirectionValue>;

export type ButtonInput = Enum<typeof KeyCode> | Enum<typeof MouseButton> | Enum<typeof MouseWheelDirection>;
export interface ButtonInputConfiguration {
  name: string;
  bindings: ButtonInput[];
}
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type AxisInput = never /* @TODO Gamepad */ | { min: ButtonInput, max: ButtonInput };
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


export class InputSystem implements IInputSystem {
  private debug_allKnownKeyCodes: Set<string>;
  private debug_console: InputSystemConsole;
  private configuration: InputConfiguration;

  /**
   * @NOTE Canvas requirements for touch input:
   *  - `tabindex="0"` (HTML) - Make game focusable
   *  - `touch-action: none` (CSS) - Prevent scrolling on mobile when dragging on the game
   *  - `user-select: none` (CSS) - Prevent selecting the canvas on mobile (e.g. long press)
   */
  private canvas: HTMLCanvasElement;
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
  };

  public constructor(canvas: HTMLCanvasElement) {
    this.debug_allKnownKeyCodes = new Set();
    this.debug_console = new InputSystemConsole();

    this.canvas = canvas;
    this.configuration = DefaultInputConfiguration;

    /*
      @TODO Listen to:
        // - keydown/up
        // - mouse down / up
        - gamepad connected
        - gamepad button down / up
     */
    canvas.addEventListener('keydown', (e) => this.onKeyDown(e));
    canvas.addEventListener('keyup', (e) => this.onKeyUp(e));
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e, true));
    canvas.addEventListener('mousewheel', (e) => this.onWheel(e as WheelEvent, false));

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

  public wasButtonPressed(buttonName: string): boolean {
    const buttonConfig = this.getButtonConfig(buttonName);
    if (buttonConfig === undefined) {
      return false;
    }

    let atLeastOneBindingWasPressed = false;
    for (const binding of buttonConfig.bindings) {
      let current: boolean;
      let previous: boolean;
      switch (binding.type) {
        case 'Keyboard':
          current = this.state.keyboard.current[binding.value] === true;
          previous = this.state.keyboard.previous[binding.value] === true;
          break;
        case 'Mouse':
          current = this.state.mouse.current[binding.value] === true;
          previous = this.state.mouse.previous[binding.value] === true;
          break;
        case 'MouseWheel':
          current = this.state.mouseWheel.current[binding.value] === true;
          previous = this.state.mouseWheel.previous[binding.value] === true;
          break;
        default:
          throw new Error(`Unimplemented binding type '${(binding as { type: string }).type}'`);
      }

      if (previous) {
        // Button was not pressed since at least one binding was already pressed last frame
        return false;
      } else {
        // At least one binding was pressed if this binding was pressed,
        // since we know `previous` must be false
        atLeastOneBindingWasPressed = current || atLeastOneBindingWasPressed;
      }
    }

    return atLeastOneBindingWasPressed;
  }
  public wasButtonReleased(buttonName: string): boolean {
    const buttonConfig = this.getButtonConfig(buttonName);
    if (buttonConfig === undefined) {
      return false;
    }

    let atLeastOneBindingWasHeldLastFrame = false;
    for (const binding of buttonConfig.bindings) {
      let current: boolean;
      let previous: boolean;
      switch (binding.type) {
        case 'Keyboard':
          current = this.state.keyboard.current[binding.value] === true;
          previous = this.state.keyboard.previous[binding.value] === true;
          break;
        case 'Mouse':
          current = this.state.mouse.current[binding.value] === true;
          previous = this.state.mouse.previous[binding.value] === true;
          break;
        case 'MouseWheel':
          current = this.state.mouseWheel.current[binding.value] === true;
          previous = this.state.mouseWheel.previous[binding.value] === true;
          break;
        default:
          throw new Error(`Unimplemented binding type '${(binding as { type: string }).type}'`);
      }

      if (current) {
        // Button was not released since at least one binding is current being pressed this frame
        return false;
      } else {
        atLeastOneBindingWasHeldLastFrame = previous || atLeastOneBindingWasHeldLastFrame;
      }
    }

    return atLeastOneBindingWasHeldLastFrame;
  }
  public isButtonDown(buttonName: string): boolean {
    const buttonConfig = this.getButtonConfig(buttonName);
    if (buttonConfig === undefined) {
      return false;
    }

    for (const binding of buttonConfig.bindings) {
      let current: boolean;
      switch (binding.type) {
        case 'Keyboard':
          current = this.state.keyboard.current[binding.value] === true;
          break;
        case 'Mouse':
          current = this.state.mouse.current[binding.value] === true;
          break;
        case 'MouseWheel':
          current = this.state.mouseWheel.current[binding.value] === true;
          break;
        default:
          throw new Error(`Unimplemented binding type '${(binding as { type: string }).type}'`);
      }

      if (current) {
        return true;
      }
    }

    return false;
  }
  public getAxis(axisName: string): number {
    // @TODO
    throw new Error("Method not implemented.");
  }

  public onUpdate(): void {
    this.debug_updateCurrentInput();

    this.updateInputState(this.state.keyboard);
    this.updateInputState(this.state.mouse);
    // @NOTE Always clear out mouse wheel state every frame as inputs are instantaneous only
    for (const key in this.state.mouseWheel.current) {
      delete this.state.mouseWheel.current[key as MouseWheelDirectionValue];
    }
  }
  private updateInputState<TInput extends string>(state: InputState<TInput>): void {
    // Iterate current inputs
    for (const key in state.current) {
      state.previous[key as TInput] = state.current[key as TInput] === true;
    }
    // ALSO iterate previous inputs to update deletes / clears
    for (const key in state.previous) {
      state.previous[key as TInput] = state.current[key as TInput] === true;
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

      function inputStateDown<TInput extends string>(state: InputState<TInput>, toLabel: (input: TInput) => string): void {
        for (const key in state.current) {
          if (state.current[key as TInput]) {
            html.push(span(toLabel(key as TInput)));
          }
        }
      }

      function inputStateMomentary<TInput extends string>(state: InputState<TInput>, toLabel: (input: TInput) => string): void {
        for (const key in state.current) {
          if (
            state.current[key as TInput] &&
            !state.previous[key as TInput]
          ) {
            html.push(span(toLabel(key as TInput), `bg-[red]`));
          }
        }
        for (const key in state.previous) {
          if (
            !state.current[key as TInput] &&
            state.previous[key as TInput]
          ) {
            html.push(span(toLabel(key as TInput), `bg-[purple]`));
          }
        }
      }

      html.push(`<div class="mb-2">`);

      inputStateDown(this.state.keyboard, (key) => `Key:${key}`);
      inputStateDown(this.state.mouse, (button) => `Mouse:${button}`);
      inputStateDown(this.state.mouseWheel, (direction) => `Wheel:${direction}`);

      inputStateMomentary(this.state.keyboard, (key) => `Key:${key}`);
      inputStateMomentary(this.state.mouse, (button) => `Mouse:${button}`);
      inputStateMomentary(this.state.mouseWheel, (direction) => `Wheel:${direction}`);

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
    this.state.keyboard.current[e.code as KeyCodeValue] = true;
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
      this.state.mouse.current[e.button as MouseButtonValue] = true;
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
    this.state.mouseWheel.current[type] = true;
  }
}

// @TODO DEBUG
class InputSystemConsole {
  private console: Element | null;
  public constructor() {
    this.console = document.querySelector('#input-system-console');
  }

  public log(str: string): void {
    console.log(`[InputSystem] (Console) ${str}`);
    if (this.console) {
      this.console.innerHTML = `${str}\n` + this.console.innerHTML;
    }
  }
}

type InputEnumResult<TType extends string, TEnum extends object> = { [T in keyof TEnum]: { type: TType, value: TEnum[T] } };
function createInputEnum<TType extends string, TEnum extends object>(type: TType, enumObj: TEnum): InputEnumResult<TType, TEnum> {
  const result: Partial<InputEnumResult<TType, TEnum>> = {};
  for (const key in enumObj) {
    result[key] = { type, value: enumObj[key] };
  }
  return result as InputEnumResult<TType, TEnum>;
}
type InputEnumValues<T extends InputEnumResult<any, any>> = T[keyof T]['value']

export const MouseButton = createInputEnum('Mouse', {
  'Left': 0 as const,
  'Middle': 1 as const,
  'Right': 2 as const,
});
export const MouseWheelDirection = createInputEnum('MouseWheel', {
  'Up': 'up' as const,
  'Down': 'down' as const,
  'Left': 'left' as const,
  'Right': 'right' as const,
  'Forward': 'forward' as const,
  'Back': 'back' as const,
});
// @TODO Expand this by testing on other devices
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
export const ProblematicKeyCodes: Record<string, true> = {
  ['MetaLeft']: true,
  ['MetaRight']: true,
  ['AltLeft']: true,
  ['AltRight']: true,
};

export type MouseButtonValue = InputEnumValues<typeof MouseButton>;
export type KeyCodeValue = InputEnumValues<typeof KeyCode>;
export type MouseWheelDirectionValue = InputEnumValues<typeof MouseWheelDirection>;

export const DefaultInputConfiguration: InputConfiguration = {
  buttons: [
    {
      name: 'jump',
      bindings: [
        KeyCode.Space,
      ],
    },
    {
      name: 'action',
      bindings: [
        KeyCode.KeyF,
      ],
    },
  ],
  axes: [
    {
      name: 'player:x',
      bindings: [
        { min: KeyCode.KeyA, max: KeyCode.KeyD },
        { min: KeyCode.ArrowLeft, max: KeyCode.ArrowRight },
      ],
    },
    {
      name: 'player:y',
      bindings: [
        { min: KeyCode.KeyS, max: KeyCode.KeyW },
        { min: KeyCode.ArrowDown, max: KeyCode.ArrowUp },
      ],
    },
  ],
};

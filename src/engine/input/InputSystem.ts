
export interface IInputSystem {

}

type InputState<TInput extends string> = {
  current: Partial<Record<TInput, boolean>>;
  previous: Partial<Record<TInput, boolean>>;
}
type KeyboardInputState = InputState<KeyCodeName>;
type MouseInputState = InputState<MouseButtonName>;
type MouseWheelInputState = InputState<MouseWheelDirection>;

export class InputSystem implements IInputSystem {
  private debug_allKnownKeyCodes: Set<string>;
  private debug_console: InputSystemConsole;

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

  public onUpdate(): void {
    this.debug_updateCurrentInput();

    this.updateInputState(this.state.keyboard);
    this.updateInputState(this.state.mouse);
    // @NOTE Always clear out mouse wheel state every frame as inputs are instantaneous only
    for (const key in this.state.mouseWheel.current) {
      delete this.state.mouseWheel.current[key as MouseWheelDirection];
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
    if (e.repeat || ProblematicKeyCodes[e.code as ProblematicKeyCodeName]) return;

    e.preventDefault();

    this.debug_console.log(`[${InputSystem.name}] (${this.onKeyDown.name}) ${e.code}`); // @TODO @DEBUG REMOVE

    // Watch for unfamiliar keys (mostly @DEBUG)
    if (!(e.code in KeyCode)) {
      console.warn(`[${InputSystem.name}] (${this.onKeyDown.name}}) Unfamiliar key pressed: ${e.code}`);
    }

    // Mark key as currently pressed
    this.state.keyboard.current[e.code as KeyCodeName] = true;
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (ProblematicKeyCodes[e.code as ProblematicKeyCodeName]) {
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
    delete this.state.keyboard.current[e.code as KeyCodeName];
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
      this.state.mouse.current[getMouseButtonName(e.button)!] = true;
    }
  }

  private onPointerUp(e: PointerEvent): void {
    // Only acknowledge `pointerup` if the canvas is already focused.
    // This prevents some edge cases where e.g. clicking and dragging into the canvas
    // doesn't misfire a rogue `pointerup` event.
    if (this.state.isCanvasFocused) {
      this.debug_console.log(`[${InputSystem.name}] (${this.onPointerUp.name}) ${e.button} (${e.pointerType})`); // @TODO @DEBUG REMOVE

      // Mark mouse button as not currently pressed
      delete this.state.mouse.current[getMouseButtonName(e.button)!];
    }
  }

  private onWheel(e: WheelEvent, isLegacy: boolean): void {
    e.preventDefault();

    // Detect which is the primary direction of scrolling
    // This is the input that will be fired this frame
    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);
    const absZ = Math.abs(e.deltaZ);
    let type: MouseWheelDirection;
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

export const MouseButton = {
  'Left': 0 as const,
  'Middle': 1 as const,
  'Right': 2 as const,
};
export function getMouseButtonName(button: number): MouseButtonName | undefined {
  switch (button) {
    case 0:
      return 'Left';
    case 1:
      return 'Middle';
    case 2:
      return 'Right';
  }
  return undefined;
}
export const MouseWheelDirection = {
  'up': 'up',
  'down': 'down',
  'left': 'left',
  'right': 'right',
  'forward': 'forward',
  'back': 'back',
};
// @TODO Expand this by testing on other devices
export const KeyCode = {
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
};
export const ProblematicKeyCodes = {
  MetaLeft: 'MetaLeft',
  MetaRight: 'MetaRight',
  AltLeft: 'AltLeft',
  AltRight: 'AltRight',
};

export type MouseButtonName = keyof typeof MouseButton;
export type KeyCodeName = keyof typeof KeyCode;
export type ProblematicKeyCodeName = keyof typeof ProblematicKeyCodes;
export type MouseWheelDirection = keyof typeof MouseWheelDirection;

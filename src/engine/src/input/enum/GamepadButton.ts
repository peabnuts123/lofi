import { createInputEnum, type InputEnumValues } from "./InputEnum";

/**
 * A button pressed on any gamepad / controller.
 */
export const GamepadButton = createInputEnum('GamepadButton', {
  South: 'South',
  East: 'East',
  West: 'West',
  North: 'North',
  L1: 'L1',
  R1: 'R1',
  L2: 'L2',
  R2: 'R2',
  Select: 'Select',
  Start: 'Start',
  L3: 'L3',
  R3: 'R3',
  DpadUp: 'DpadUp',
  DpadDown: 'DpadDown',
  DpadLeft: 'DpadLeft',
  DpadRight: 'DpadRight',
  Home: 'Home',
} as const);
export type GamepadButtonValue = InputEnumValues<typeof GamepadButton>;

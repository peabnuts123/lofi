import { createInputEnum, type InputEnumValues } from "./InputEnum";

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

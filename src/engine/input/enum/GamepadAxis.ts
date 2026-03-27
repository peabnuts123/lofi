import { createInputEnum, type InputEnumValues } from "./InputEnum";

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

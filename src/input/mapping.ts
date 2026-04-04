import type { NativeGamepadAxisIndex, NativeGamepadButtonIndex } from "./types";
import {
  GamepadAxis,
  GamepadButton,
} from './enum';

/**
 * Mapping of native button indices to `GamepadButton` enum according to the "standard" gamepad layout.
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
 * Mapping of native axis indices to `GamepadAxis` enum according to the "standard" gamepad layout.
 */
export const NativeStandardGamepadAxisMapping: Record<NativeGamepadAxisIndex, typeof GamepadAxis[keyof typeof GamepadAxis]> = {
  // See: https://www.w3.org/TR/gamepad/#remapping
  [0]: GamepadAxis.JoyLeftX,
  [1]: GamepadAxis.JoyLeftY,
  [2]: GamepadAxis.JoyRightX,
  [3]: GamepadAxis.JoyRightY,
};

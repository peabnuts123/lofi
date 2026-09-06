import { createInputEnum, type InputEnumValues } from "./InputEnum";

/**
 * A scroll input in a particular direction.
 * Note that the frequency of "pressed" events for these inputs
 * varies wildly based on the input device. For example, some trackpads and other
 * devices may fire a "pressed" event every frame.
 *
 * NOTE: Mouse wheel inputs DO NOT fire "released" events. They are instantaneous inputs only.
 *
 * Directions are interpreted as follows:
 * | Direction | Meaning |
 * | ---------- | -------- |
 * | Up / Down | Typical scroll directions available on most mice |
 * | Left / Right | Horizontal scrolling available on some mice and trackpads |
 * | Forward / Back | "Z axis" 3D scrolling typically only available on specialist mice |
 */
export const MouseWheelDirection = createInputEnum('MouseWheel', {
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
  Forward: 'forward',
  Back: 'back',
} as const);
export type MouseWheelDirectionValue = InputEnumValues<typeof MouseWheelDirection>;

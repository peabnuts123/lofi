import { createInputEnum, type InputEnumValues } from "./InputEnum";

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

import { createInputEnum, type InputEnumValues } from "./InputEnum";

/**
 * A button pressed on a mouse.
 * @TODO Should this be more abstract like "PointerButton" to account for e.g. Touch input
 *    and do "left" and "right" make sense? for example, what about left handed folk, does it register backwards?
 */
export const MouseButton = createInputEnum('Mouse', {
  Left: 0,
  Middle: 1,
  Right: 2,
} as const);
/**
 * A button pressed on a mouse.
 */
export type MouseButtonValue = InputEnumValues<typeof MouseButton>;

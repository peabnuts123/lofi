import { createInputEnum, type InputEnumValues } from "./InputEnum";

/**
 * A button pressed on a mouse.
 */
export const MouseButton = createInputEnum('Mouse', {
  Left: 0 as const,
  Middle: 1 as const,
  Right: 2 as const,
});
/**
 * A button pressed on a mouse.
 */
export type MouseButtonValue = InputEnumValues<typeof MouseButton>;

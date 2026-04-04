/**
 * An enum that holds a mapping of friendly names to an object containing
 * the type of the enum as well as the raw / native value
 * e.g.
 * ```json
 * {
 *   "KeyA": { "type": "Keyboard", "value": "KeyA" },
 *   "KeyS": { "type": "Keyboard", "value": "KeyS" },
 *   ...
 * }
 * ```
 */
export type InputEnum<TType extends string, TEnum extends object> = {
  [T in keyof TEnum]: { type: TType, value: TEnum[T] }
};
/**
 * Convert a raw enum object into an `InputEnum`.
 * @param type
 * @param enumObj
 */
export function createInputEnum<TType extends string, TEnum extends object>(type: TType, enumObj: TEnum): InputEnum<TType, TEnum> {
  const result: Partial<InputEnum<TType, TEnum>> = {};
  for (const key in enumObj) {
    result[key] = { type, value: enumObj[key] };
  }
  return result as InputEnum<TType, TEnum>;
}
/** Extract every value from an `InputEnum`. */
export type InputEnumValues<T extends InputEnum<any, any>> = T[keyof T]['value'];

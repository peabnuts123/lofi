export const DegreesToRadians = 1 / 180 * Math.PI;
export const RadiansToDegrees = 1 / Math.PI * 180;

/**
 * Better modulus operation than built-in javascript `%` operator
 * (which normally returns negative values for negative numbers).
 * @param value
 * @param modulus
 * @example
 * ```ts
 * betterModulus(12, 10); // 2
 * betterModulus(-12, 10); // 8
 * ```
 */
export function betterModulus(value: number, modulus: number): number {
  if (value >= modulus) {
    return value % modulus;
  } else if (value < 0) {
    return (value % modulus) + modulus;
  } else {
    return value;
  }
}

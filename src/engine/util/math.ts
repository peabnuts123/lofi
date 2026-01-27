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

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function inverseLerp(start: number, end: number, value: number): number {
  if (start === end) {
    return 0;
  }
  return (value - start) / (end - start);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

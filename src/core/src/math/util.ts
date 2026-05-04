/* @TODO Rename to `utils.ts` */

export const Pi = Math.PI;
export const Tau = Pi * 2;

export const DegreesToRadians = 1 / 180 * Pi;
export const RadiansToDegrees = 1 / Pi * 180;


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

export function sinDegrees(value: number): number {
  return Math.sin(value / 360 * Tau);
}
export function sin(value: number, period: number, min: number, max: number): number {
  return ((Math.sin(value / period * Tau) + 1) / 2) * (max - min) + min;
}

export function cosDegrees(value: number): number {
  return Math.cos(value / 360 * Tau);
}
export function cos(value: number, period: number, min: number, max: number): number {
  return ((Math.cos(value / period * Tau) + 1) / 2) * (max - min) + min;
}

export function tanDegrees(value: number): number {
  return Math.tan(value / 360 * Tau);
}
export function tan(value: number, period: number): number {
  return Math.tan(value / period * Tau);
}

/**
 * Extract the type(s) of elements from an array.
 * @example
 * ```
 * const values = [1, 2, 3, 4];
 * type ValuesType = ArrayElementType<typeof values>; // Type `number`
 * ```
 */
export type ArrayElementType<T> = T extends Array<infer ElementType> ? ElementType : never;

/**
 * Like `Partial<T>` but recursive, so all properties and subproperties are also partial.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Any class constructor that produces an instance assignable to `TClass`.
 * @example
 * ```
 * interface INamed {
 *   name: string;
 * }
 * class Dog implements INamed {
 *   public name: string;
 *   public constructor(name: string) {
 *     this.name = name;
 *   }
 * }
 * const Constructor: ClassReference<INamed> = Dog;
 * ```
 */
export type ClassReference<TClass> = abstract new (...args: any[]) => TClass;


/**
 * Extract the values from an enum constant.
 * @example
 * ```
 * const Colors = {
 *   Red: 'red',
 *   Green: 'green',
 *   Blue: 'blue',
 * } as const;
 * type Color = Enum<typeof Colors>; // Type `'red' | 'green' | 'blue'`
 * ```
 */
export type Enum<T> = T[keyof T];

export type TypedArray = Float64Array<ArrayBuffer> | Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer> | Uint16Array<ArrayBuffer> | Uint8Array<ArrayBuffer> | Int16Array<ArrayBuffer> | Int8Array<ArrayBuffer>;

export interface Optional<T> {
  value: T | undefined;
}
export function Optional<T>(value?: T): Optional<T> {
  return { value };
}

export type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

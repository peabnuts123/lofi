export type ArrayElementType<T> = T extends Array<infer ElementType> ? ElementType : never;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

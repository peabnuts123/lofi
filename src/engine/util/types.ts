export type ArrayElementType<T> = T extends Array<infer ElementType> ? ElementType : never;

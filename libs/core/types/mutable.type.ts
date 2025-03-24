type MutableArray<T> = Array<Mutable<T>>;
type MutableObject<T> = {
  -readonly [P in keyof T]: Mutable<T[P]>;
};
export type Mutable<T> =
  T extends Array<infer U> ? MutableArray<U> : T extends object ? MutableObject<T> : T;

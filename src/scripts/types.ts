import type { ColumnNormalized } from "./components/DndTable.svelte";

export type MaybeGetter<T> = T | (() => T);

export type AnyArray = any[];
export type AnyFunction = (...args: any[]) => any;
export type AnyConstructor = { new (...args: any[]): any };

export type DeepPartial<T extends object> = _DeepPartial<T>;

type _DeepPartial<T> = T extends object
  ? T extends AnyArray | AnyFunction | AnyConstructor
    ? T
    : {
        [K in keyof T]?: _DeepPartial<T[K]>;
      }
  : T;

export type TableContextValue = {
  name: () => string;
  columns: () => { id: string; width: number; formatted: string }[];
  columnsById: () => Map<string, ColumnNormalized>;
};

export type TupleOf<
  Value,
  Length extends number,
  Result extends readonly Value[] = [],
> = Result["length"] extends Length ? Result : TupleOf<Value, Length, [...Result, Value]>;

export type TupleFirst<Tuple extends readonly unknown[]> =
  Tuple extends Readonly<[infer Head, ...(readonly unknown[])]> ? Head : never;

export type TupleExcludingFirst<Tuple extends readonly unknown[]> =
  Tuple extends Readonly<[unknown, ...infer Tail]> ? Tail : never;

export type TupleLast<Tuple extends readonly unknown[]> =
  Tuple extends Readonly<[...infer _, infer Last]> ? Last : never;

export type TupleExcludingLast<Tuple extends readonly unknown[]> =
  Tuple extends Readonly<[...infer Rest, unknown]> ? Rest : never;

export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

export type AllKeys<T> = T extends unknown ? keyof T : never;

export type ObjectUnionMerged<T> = Prettify<
  {
    [K in SharedKeys<T>]: T[K];
  } & {
    [K in Exclude<AllKeys<T>, SharedKeys<T>>]?: T extends unknown ? (K extends keyof T ? T[K] : never) : never;
  }
>;

export type SharedKeys<T> = [T] extends [unknown] ? keyof T : never;

export type Consumer<T> = (event: T) => void;
export type Producer<T> = () => T;

export type UnionSameKeys<T> = keyof T;
export type OnlySelectedPartial<T, K extends keyof T> = T extends unknown
  ? Prettify<Partial<Pick<T, K>> & Required<Omit<T, K>>>
  : never;

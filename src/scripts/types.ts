import { ComputedRef, InjectionKey } from "vue"

export type MaybeGetter<T> = T | (() => T)

export const TableInjectionKey = Symbol() as TableInjectionKeyType

export type TableInjectionValue = {
    name: string,
    columns: ComputedRef<{ id: string, width: number, formatted: string }[]>,
    columnsById: ComputedRef<Map<string, {
        id: string,
        formatted: string,
        width: number
    }>>
}

export type TableInjectionKeyType = InjectionKey<TableInjectionValue>

export type TupleOf<
    Value,
    Length extends number,
    Result extends readonly Value[] = [],
> = Result['length'] extends Length ? Result : TupleOf<Value, Length, [...Result, Value]>

export type TupleFirst<Tuple extends readonly unknown[]> =
    Tuple extends Readonly<[infer Head, ...(readonly unknown[])]> ? Head : never

export type TupleExcludingFirst<Tuple extends readonly unknown[]> =
    Tuple extends Readonly<[unknown, ...infer Tail]> ? Tail : never

export type TupleLast<Tuple extends readonly unknown[]> =
    Tuple extends Readonly<[...infer _, infer Last]> ? Last : never

export type TupleExcludingLast<Tuple extends readonly unknown[]> =
    Tuple extends Readonly<[...infer Rest, unknown]> ? Rest : never

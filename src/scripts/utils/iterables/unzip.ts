import { TupleFirst, TupleExcludingFirst } from "../../types"

export type UnzipOutput<T extends readonly unknown[]> = RecursiveUnzipOutput<T>

type RecursiveUnzipOutput<
    Input extends readonly unknown[],
    Output extends readonly unknown[] = [],
> = Input extends []
    ? Output
    : TupleFirst<Input> extends infer K
    ? RecursiveUnzipOutput<TupleExcludingFirst<Input>, [...Output, K[]]>
    : never

/**
 * Opposite of the Zip function. When given an Iterable of an array of items, returns an array of arrays with each array containing the values from that index in the original arrays
 *
 * @template T Array type
 * @param iters Iterable of arrays
 * @example
 * ```ts
 * const original = [['a',1],['b',2]]
 * unzip(original) // [['a','b'], [1,2]]
 * ```
 * @example With Objects you can get all keys and values from entries
 * ```ts
 * const [keys, values] = unzip(Object.entries({a:1,b:2}))
 * ```
 */
export function unzip<const T extends readonly unknown[]>(iterable: Iterable<T>): UnzipOutput<T> {
    const iterator = iterable[Symbol.iterator]()

    let item = iterator.next() as IteratorResult<T, T>
    const result: unknown[][] = Array.from({ length: item.value.length ?? 0 }, () => [])
    while (!item.done) {
        item.value.forEach((x, i) => result[i].push(x))
        item = iterator.next() as IteratorResult<T, T>
    }

    return result as UnzipOutput<T>
}

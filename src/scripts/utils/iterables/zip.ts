import { every } from './every'
import { some } from './some'
import { TupleExcludingFirst, TupleFirst } from '../../types'

type ZipOutput<T extends readonly unknown[]> = Iterable<RecursiveZipOutput<T>>

type RecursiveZipOutput<
    Input extends readonly unknown[],
    Output extends readonly unknown[] = [],
> = Input extends []
    ? Output
    : TupleFirst<Input> extends infer K
    ? RecursiveZipOutput<TupleExcludingFirst<Input>, [...Output, IterableItem<K>]>
    : never

type IterableItem<T> = T extends Iterable<infer Item> ? Item : never

/**
 * Combines multiple iterables into tuples by index position.
 * @example
 * ```ts
 * [...zip([[1,2], ['a','b']])] // [[1,'a'], [2,'b']]
 * [...zip(true)([[1,2,3], ['a','b']])] // [[1,'a'], [2,'b']]
 * ```
 */
export function zip(stopOnMin?: boolean): <I extends Iterable<unknown>[]>(iter: I) => ZipOutput<I>
export function zip<const I extends Iterable<unknown>[]>(iter: I, stopOnMin?: boolean): ZipOutput<I>
export function zip<I extends Iterable<unknown>[]>(
    stopOnMinOrIter?: boolean | I,
    maybeStopOnMin?: boolean
): ZipOutput<I> | (<I extends Iterable<unknown>[]>(iter: I) => ZipOutput<I>) {
    if (Array.isArray(stopOnMinOrIter)) {
        // Direct form: zip the iterables
        return _zip(stopOnMinOrIter, maybeStopOnMin) as ZipOutput<I>
    }
    // Curried form: return a function that takes iterables
    return <I extends Iterable<unknown>[]>(iter: I) => _zip(iter, stopOnMinOrIter) as ZipOutput<I>
}

/**
 * Returns an iterator that yields the result of zipping the iterables provided
 *
 * @template T item type for the input iterables
 * @param iters array of iterables to zip
 * @param stopOnMin whether or not to zip up to the shortest iterable, set to false to keep going until all iterables provided are done (using undefined if a previous iterable is done before this)
 * @example
 * ```ts
 * const abc = ['a', 'b', 'c']
 * const nums = [0, 1, 2, 3]
 * [...zip([abc, nums], true)] // result: [['a', 0], ['b', 1], ['c', 2]]
 * ```
 * @example
 * ```ts
 * const abc = ['a', 'b', 'c']
 * const nums = [0, 1, 2, 3]
 * [...zip([abc, nums], false)] // result: [['a', 0], ['b', 1], ['c', 2], [undefined, 3]]
 * ```
 */
function* _zip<T>(iters: Iterable<T>[], stopOnMin?: boolean): IterableIterator<T[]> {
    const iterators = iters.map((iter) => iter[Symbol.iterator]())

    const items = iterators.map((iter) => iter.next())
    const limitFn = stopOnMin ? every : some

    while (limitFn(items, (item: IteratorResult<T>) => !item.done)) {
        yield items.map((item) => item.value as T)

        for (let i = 0; i < items.length; i++) {
            items[i] = iterators[i].next()
        }
    }
}

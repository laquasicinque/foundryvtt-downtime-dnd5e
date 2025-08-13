type PartitionResult<T, F = T> = [passed: T[], failed: F[]]

/**
 * Splits an iterable into two arrays based on a predicate function.
 * @example
 * ```ts
 * partition([1,2,3,4], x => x % 2 === 0) // [[2, 4], [1, 3]]
 * partition(x => x > 2)([1,2,3,4]) // [[3, 4], [1, 2]]
 * ```
 */
export function partition<T, U extends T = T>(
    predicate: (item: T, index: number) => item is U
): (iter: Iterable<T>) => Prettify<PartitionResult<U, Exclude<T, U>>>
export function partition<T>(
    predicate: (item: T, index: number) => unknown
): (iter: Iterable<T>) => Prettify<PartitionResult<T>>
export function partition<T, U extends T = T>(
    iter: Iterable<T>,
    predicate: (item: T, index: number) => item is U
): Prettify<PartitionResult<U, Exclude<T, U>>>
export function partition<T>(
    iter: Iterable<T>,
    predicate: (item: T, index: number) => unknown
): Prettify<PartitionResult<T>>
export function partition<T>(
    predicateOrIter: ((item: T, index: number) => unknown) | Iterable<T>,
    maybePredicate?: (item: T, index: number) => unknown
): PartitionResult<T> | ((iter: Iterable<T>) => PartitionResult<T>) {
    if (typeof predicateOrIter === 'function') {
        // Curried form: return a function that takes an iterable
        return (iter: Iterable<T>) => _partition(iter, predicateOrIter)
    }
    // Direct form: partition the iterable with the predicate
    return _partition(predicateOrIter, maybePredicate!)
}

function _partition<T>(
    iter: Iterable<T>,
    predicate: (item: T, index: number) => unknown
): PartitionResult<T> {
    const passed: T[] = []
    const failed: T[] = []

    const output: [passed: T[], failed: T[]] = [passed, failed]

    let i = 0
    for (const item of iter) {
        if (predicate(item, i++)) passed.push(item)
        else failed.push(item)
    }

    return output
}

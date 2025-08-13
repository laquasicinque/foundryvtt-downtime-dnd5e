/**
 * Splits an iterable into chunks of a specified size.
 * @example
 * ```ts
 * [...chunk([1,2,3,4,5], 2)] // [[1,2], [3,4], [5]]
 * [...chunk(3)([1,2,3,4,5])] // [[1,2,3], [4,5]]
 * ```
 */
export function chunk(limit: number): <T>(iter: Iterable<T>) => IterableIterator<T[]>
export function chunk<T>(iter: Iterable<T>, limit: number): IterableIterator<T[]>
export function chunk<T>(
  limitOrIter: number | Iterable<T>,
  maybeLimit?: number
): IterableIterator<T[]> | (<T>(iter: Iterable<T>) => IterableIterator<T[]>) {
  if (typeof limitOrIter === 'number') {
    // Curried form: return a function that takes an iterable
    return <T>(iter: Iterable<T>) => _chunk(iter, limitOrIter)
  }
  // Direct form: chunk the iterable with the limit
  return _chunk(limitOrIter, maybeLimit!)
}

function* _chunk<T>(iter: Iterable<T>, limit: number): IterableIterator<T[]> {
  let arr: T[] = []
  for (const item of iter) {
    arr.push(item)
    if (arr.length >= limit) {
      yield arr
      arr = []
    }
  }

  if (arr.length > 0) {
    yield arr
  }
}

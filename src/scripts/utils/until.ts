/**
 * Takes items until a predicate is true, then stops.
 * @example
 * ```ts
 * [...until([1,2,3,4], x => x > 2)] // [1, 2]
 * [...until(x => x === 3)([1,2,3,4])] // [1, 2]
 * ```
 */
export function until<T>(fn: (item: T, index: number) => unknown): (iter: Iterable<T>) => IterableIterator<T>
export function until<T>(iter: Iterable<T>, fn: (item: T, index: number) => unknown): IterableIterator<T>
export function until<T>(
  fnOrIter: ((item: T, index: number) => unknown) | Iterable<T>,
  maybeFn?: (item: T, index: number) => unknown
): IterableIterator<T> | ((iter: Iterable<T>) => IterableIterator<T>) {
  if (typeof fnOrIter === 'function') {
    // Curried form: return a function that takes an iterable
    return (iter: Iterable<T>) => _until(iter, fnOrIter)
  }
  // Direct form: take until predicate is true
  return _until(fnOrIter, maybeFn!)
}

function* _until<T>(
  iter: Iterable<T>,
  fn: (item: T, index: number) => unknown
): IterableIterator<T> {
  let i = 0
  for (const item of iter) {
    if (fn(item, i++)) return
    yield item
  }
}

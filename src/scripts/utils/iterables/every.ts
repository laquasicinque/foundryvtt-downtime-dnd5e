/**
 * Tests whether all items in an iterable pass a predicate function.
 * @example
 * ```ts
 * every([2,4,6], x => x % 2 === 0) // true
 * every(x => x > 0)([1,2,3]) // true
 * ```
 */
export function every<T>(predicate: (item: T, index: number) => unknown): (iter: Iterable<T>) => boolean
export function every<T>(iter: Iterable<T>, predicate: (item: T, index: number) => unknown): boolean
export function every<T>(
  predicateOrIter: ((item: T, index: number) => unknown) | Iterable<T>,
  maybePredicate?: (item: T, index: number) => unknown
): boolean | ((iter: Iterable<T>) => boolean) {
  if (typeof predicateOrIter === 'function') {
    // Curried form: return a function that takes an iterable
    return (iter: Iterable<T>) => _every(iter, predicateOrIter)
  }
  // Direct form: test every item in the iterable
  return _every(predicateOrIter, maybePredicate!)
}

function _every<T>(
  iter: Iterable<T>,
  predicate: (item: T, index: number) => unknown
): boolean {
  let i = 0
  for (const item of iter) {
    if (!predicate(item, i++)) return false
  }
  return true
}

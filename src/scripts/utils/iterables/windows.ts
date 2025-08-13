/**
 * Creates sliding windows of a specified size from an iterable.
 * @example
 * ```ts
 * [...windows([1,2,3,4], 2)] // [[1,2], [2,3], [3,4]]
 * [...windows(3)([1,2,3,4,5])] // [[1,2,3], [2,3,4], [3,4,5]]
 * ```
 */
export function windows(size: number): <T>(iter: Iterable<T>) => IterableIterator<T[]>
export function windows<T>(iter: Iterable<T>, size: number): IterableIterator<T[]>
export function windows<T>(
  sizeOrIter: number | Iterable<T>,
  maybeSize?: number
): IterableIterator<T[]> | (<T>(iter: Iterable<T>) => IterableIterator<T[]>) {
  if (typeof sizeOrIter === 'number') {
    // Curried form: return a function that takes an iterable
    return <T>(iter: Iterable<T>) => _windows(iter, sizeOrIter)
  }
  // Direct form: create windows from the iterable
  return _windows(sizeOrIter, maybeSize!)
}

function* _windows<T>(iter: Iterable<T>, size: number): IterableIterator<T[]> {
  let arr: T[] = []

  for (const item of iter) {
    if (arr.length === size) {
      arr = arr.slice(1)
    }
    arr.push(item)
    if (arr.length === size) {
      yield arr
    }
  }
}

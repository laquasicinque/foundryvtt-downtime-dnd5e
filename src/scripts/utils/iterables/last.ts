/**
 * Returns the last item of an iterable
 * @example ```ts
 * last([1, 2, 3]) // 3
 * last(new Set([4,5,4])) // 4
 * ```
 */
export function last<T>(iter: Iterable<T>): T | undefined {
  let lastItem: T | undefined = undefined
  for (const item of iter) {
    lastItem = item
  }
  return lastItem
}

import { isNonStringIterable } from './isIterable'

/**
 * Joins items from an iterable into a string with a delimiter.
 * @example
 * ```ts
 * join([1,2,3], '-') // '1-2-3'
 * join(',')(['a','b','c']) // 'a,b,c'
 * ```
 */
export function join(delimiter?: string): <T>(iter: Iterable<T>) => string
export function join<T>(iter: Iterable<T>, delimiter?: string): string
export function join<T>(
  delimiterOrIter?: string | Iterable<T>,
  maybeDelimiter?: string
): string | (<T>(iter: Iterable<T>) => string) {
  if (isNonStringIterable(delimiterOrIter)) {
    // Direct form: join the iterable with the delimiter
    return [...delimiterOrIter].join(maybeDelimiter)
  }
  // Curried form: return a function that takes an iterable
  return <T>(iter: Iterable<T>) => [...iter].join(delimiterOrIter)
}

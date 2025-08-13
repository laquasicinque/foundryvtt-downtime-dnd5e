/**
 * Checks if the given item is an iterables
 */
export const isIterable = <T = unknown>(x: unknown): x is Iterable<T> =>
  typeof x?.[Symbol.iterator] === 'function'

export const isNonStringIterable = <T = unknown>(x: unknown): x is Iterable<T> =>
  isIterable(x) && typeof x !== 'string'

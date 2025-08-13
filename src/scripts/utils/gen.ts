/**
 * Returns a function that returns an iterable that calls the given function with the index
 * Useful for generating an unknown number of values. Consider using with `take` or `takeWhile`
 */
export const gen =
  <T>(fn: (n: number) => T) =>
  () =>
    _uncurriedGenerator(fn)

function* _uncurriedGenerator<T>(fn: (n: number) => T): IterableIterator<T> {
  let i = 0

  while (true) {
    yield fn(i++)
  }
}

type AutoCurryingIterableTake = {
  /**
   * Curried form of take, returns a function that takes in an iterable and returns an iterable that yields `n` number of items from that iterable
   *
   * @param num the number of items to yield
   * @example
   * ```ts
   * const take3 = take(3)
   * const arr = [1, 2, 3, 4, 5, 6]
   * [...take3(arr)] // result: [1, 2, 3]
   * ```
   */
  (n: number): <T>(iter: Iterable<T>) => IterableIterator<T>
  /**
   * Returns an iterable that yields up to `num` number of items
   *
   * @template T the input (and output) item type of the iterable
   * @param iter an iterable of items of type `T`
   * @param num the number of items to yield
   * @example
   * ```ts
   * const arr = [1, 2, 3, 4, 5, 6]
   * [...take(arr, 3)] // result: [1, 2, 3]
   * ```
   */
  <T>(iter: Iterable<T>, n: number): IterableIterator<T>
}

export const take = ((...args) => {
  if (typeof args[0] === 'number') {
    return _curriedTake(...(args as Parameters<typeof _curriedTake>))
  }
  return _uncurriedTake(...(args as Parameters<typeof _uncurriedTake>))
}) as AutoCurryingIterableTake

const _curriedTake =
  (n: number) =>
  <T>(iter: Iterable<T>) =>
    _uncurriedTake(iter, n)

function* _uncurriedTake<T>(iter: Iterable<T>, n: number): IterableIterator<T> {
  let i = 0

  for (const item of iter) {
    if (i++ >= n) {
      break
    }
    yield item
  }
}

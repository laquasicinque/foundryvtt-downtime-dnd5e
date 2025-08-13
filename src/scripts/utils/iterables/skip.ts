type AutoCurryingIterableSkip = {
  (count: number): <T>(iter: Iterable<T>) => IterableIterator<T>

  <T>(iter: Iterable<T>, count: number): IterableIterator<T>
}

export const skip = ((...args) => {
  if (typeof args[0] === 'number') {
    return _curriedSkip(...(args as Parameters<typeof _curriedSkip>))
  }
  return _uncurriedSkip(...(args as Parameters<typeof _uncurriedSkip>))
}) as AutoCurryingIterableSkip

function* _uncurriedSkip<T>(iter: Iterable<T>, count: number): IterableIterator<T> {
  let i = 0
  for (const item of iter) {
    if (i++ < count) continue
    yield item
  }
}

const _curriedSkip =
  (count: number) =>
  <T>(iter: Iterable<T>) =>
    _uncurriedSkip(iter, count)

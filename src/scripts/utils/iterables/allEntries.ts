import { isPlainObject } from 'is-what'
import { isIterable } from './isIterable'

type Entry<T> = { [K in keyof T]: [K, T[K]] }[keyof T]

/**
 * Like Entries but also returns Symbol keys on objects
 * @param input
 */
// Plain Objects are acceptable
export function allEntries<T extends Partial<Record<PropertyKey, unknown>>>(
  input: T
): IterableIterator<Entry<T>>
// Objects that are iterable iterators are acceptable, (i.e Map, Set, Array)
export function allEntries<T extends IterableIterator<[K, V]>, K, V>(
  input: T
): IterableIterator<[T, K]>
// Objects that have a function `entries` are acceptable assuming it returns an Iterable(i.e Map, Set, Array)
export function allEntries<T extends Record<'entries', () => Iterable<[K, V]>>, K, V>(
  input: T
): IterableIterator<[K, V]>
export function* allEntries<
  T extends
    | Record<K & PropertyKey, V>
    | IterableIterator<[K, V]>
    | Record<'entries', () => Iterable<[K, V]>>,
  K,
  V,
>(input: T): IterableIterator<[K, V]> {
  const inputIsIterable = isIterable(input)
  const inputHasEntries = 'entries' in input && typeof input?.entries === 'function'
  const inputIsObject = isPlainObject(input)

  if (!(inputIsIterable || inputIsObject || inputHasEntries)) {
    throw new TypeError('Input is not an iterable or a plain object')
  }

  if (inputIsIterable || inputHasEntries) {
    const iter = inputHasEntries ? input.entries() : (input as Iterable<[K, V]>)
    yield* iter
  }

  if (inputIsObject) {
    for (const key of Reflect.ownKeys(input)) {
      yield [key, input[key as keyof typeof input]] as [K, V]
    }
  }
}

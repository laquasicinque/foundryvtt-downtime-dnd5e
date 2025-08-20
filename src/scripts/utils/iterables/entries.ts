import { isIterable } from './isIterable'

type Entry<T> = { [K in keyof T & string]: [K, T[K]] }[keyof T & string]

// Plain Objects are acceptable
export function entries<T extends Partial<Record<PropertyKey, unknown>>>(
    input: T
): IterableIterator<Entry<T>>
// Objects that are iterable iterators are acceptable, (i.e Map, Set, Array)
export function entries<T extends IterableIterator<[K, V]>, K, V>(
    input: T
): IterableIterator<[T, K]>
// Objects that have a function `entries` are acceptable assuming it returns an Iterable(i.e Map, Set, Array)
export function entries<T extends Record<'entries', () => Iterable<[K, V]>>, K, V>(
    input: T
): IterableIterator<[K, V]>
export function* entries<
    T extends
    | Record<K & PropertyKey, V>
    | IterableIterator<[K, V]>
    | Record<'entries', () => Iterable<[K, V]>>,
    K,
    V,
>(input: T): IterableIterator<[K, V]> {
    const inputIsIterable = isIterable(input)
    const inputHasEntries = 'entries' in input && typeof input?.entries === 'function'
    const inputIsObject = Object.prototype.toString.call(input) === '[object Object]'

    if (!(inputIsIterable || inputIsObject || inputHasEntries)) {
        throw new TypeError('Input is not an iterable or a plain object')
    }

    if (inputIsIterable || inputHasEntries) {
        const iter = inputHasEntries ? input.entries() : (input as Iterable<[K, V]>)
        yield* iter
    }

    if (inputIsObject) {
        for (const key in input) {
            if (Object.hasOwn(input, key)) {
                yield [key, input[key as keyof typeof input]] as [K, V]
            }
        }
    }
}

import { isNonStringIterable } from './isIterable'
import { map } from './map'

/**
 * Extracts a property value from each item in an iterable.
 * @example
 * ```ts
 * [...pluck([{a: 1}, {a: 2}], 'a')] // [1, 2]
 * [...pluck('name')([{name: 'John'}, {name: 'Jane'}])] // ['John', 'Jane']
 * ```
 */
export function pluck<Key extends PropertyKey>(
    key: Key
): <Input extends Record<Key, unknown>>(iter: Iterable<Input>) => IterableIterator<Input[Key]>
export function pluck<Input, Key extends keyof Input>(
    iter: Iterable<Input>,
    key: Key
): IterableIterator<Input[Key]>
export function pluck<Input, Key extends keyof Input>(
    keyOrIter: Key | Iterable<Input>,
    maybeKey?: Key
): IterableIterator<Input[Key]> | ((iter: Iterable<Input>) => IterableIterator<Input[Key]>) {
    if (isNonStringIterable(keyOrIter)) {
        // Direct form: pluck from the iterable with the key
        return map(keyOrIter as Iterable<Input>, (input) => input[maybeKey!])
    }
    // Curried form: return a function that takes an iterable
    return <Input extends Record<Key, unknown>>(iter: Iterable<Input>) =>
        map(iter, (input) => input[keyOrIter])
}

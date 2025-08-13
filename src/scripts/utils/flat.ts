import { isNonStringIterable } from './isIterable'

type FlattenOnce<T> = T extends Array<infer U> ? U : T

type Flatten<T, Depth extends number, Count extends Array<unknown> = [unknown]> =
    Count['length'] extends Depth
    ? T
    : Flatten<FlattenOnce<T>, Depth, [...Count, unknown]>


export type FlatItem<Item, Depth extends number> =
    Depth extends 0
    ? Item
    : Item extends Array<infer U>
    ? Flatten<U, Depth>
    : Item

/**
 * Flattens nested iterables by a specified depth level.
 * @example
 * ```ts
 * [...flat([[1,2], [3,4]])] // [1, 2, 3, 4]
 * [...flat(2)([[[1]], [[2]]])] // [1, 2]
 * ```
 */
export function flat<Depth extends number = 1>(depth?: Depth): <T>(iter: Iterable<T>) => IterableIterator<FlatItem<T, Depth>>
export function flat<T, Depth extends number = 1>(iter: Iterable<T>, depth?: Depth): IterableIterator<FlatItem<T, Depth>>
export function flat<T, Depth extends number = 1>(
    depthOrIter?: Depth | Iterable<T>,
    maybeDepth?: Depth
): IterableIterator<FlatItem<T, Depth>> | (<T extends Array<unknown>>(iter: Iterable<T>) => IterableIterator<FlatItem<T, Depth>>) {
    if (typeof depthOrIter === 'number' || depthOrIter === undefined) {
        // Curried form: return a function that takes an iterable
        return <T extends Array<unknown>>(iter: Iterable<T>) => _flat(iter, depthOrIter ?? 1)
    }
    // Direct form: flatten the iterable
    return _flat(depthOrIter, maybeDepth ?? 1)
}

function* _flat<T, Depth extends number>(iter: Iterable<T>, depth: Depth): IterableIterator<any> {
    for (const item of iter) {
        // use isNonStringIterable as if we flatten strings, it could go infinitely.
        if (depth > 0 && isNonStringIterable(item)) {
            yield* _flat(item as Iterable<any>, depth - 1)
        } else {
            yield item
        }
    }
}

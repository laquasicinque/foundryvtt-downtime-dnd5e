/**
 * Map function for iterables with currying support
 */
export function map<T, U>(iter: Iterable<T>, fn: (item: T, index: number) => U): IterableIterator<U>
export function map<T, U>(fn: (item: T, index: number) => U): (iter: Iterable<T>) => IterableIterator<U>
export function map<T, U>(
    fnOrIter: ((item: T, index: number) => U) | Iterable<T>,
    maybeFn?: (item: T, index: number) => U
): IterableIterator<U> | ((iter: Iterable<T>) => IterableIterator<U>) {
    if (typeof fnOrIter === 'function') {
        // Curried form: return a function that takes an iterable
        return (iter: Iterable<T>) => _map(iter, fnOrIter)
    }
    // Direct form: map the iterable with the function
    return _map(fnOrIter, maybeFn!)
}

function* _map<T, U>(
    iter: Iterable<T>,
    fn: (item: T, index: number) => U
): IterableIterator<U> {
    let i = 0
    for (const item of iter) {
        yield fn(item, i++)
    }
}

/**
 * Filters items from an iterable based on a predicate function.
 * @example
 * ```ts
 * [...filter([1,2,3,4], x => x % 2 === 0)] // [2, 4]
 * [...filter(x => x > 2)([1,2,3,4])] // [3, 4]
 * ```
 */
export function filter<Input>(
    fn: (item: Input, index: number) => unknown
): <ActualInput extends Input = Input>(iter: Iterable<ActualInput>) => IterableIterator<ActualInput>
export function filter<Input, Output extends Input>(
    fn: (item: Input, index: number) => item is Output
): <ActualInput extends Input = Input>(iter: Iterable<ActualInput>) => IterableIterator<Output>
export function filter<Input>(
    iter: Iterable<Input>,
    fn: (item: Input, index: number) => unknown
): IterableIterator<Input>
export function filter<Input, Output extends Input>(
    iter: Iterable<Input>,
    fn: (item: Input, index: number) => item is Output
): IterableIterator<Output>
export function filter<Input, Output extends Input = Input>(
    fnOrIter: ((item: Input, index: number) => unknown) | ((item: Input, index: number) => item is Output) | Iterable<Input>,
    maybeFn?: ((item: Input, index: number) => unknown) | ((item: Input, index: number) => item is Output)
): IterableIterator<Input> | IterableIterator<Output> | ((iter: Iterable<Input>) => IterableIterator<Input | Output>) {
    if (typeof fnOrIter === 'function') {
        // Curried form: return a function that takes an iterable
        return (iter: Iterable<Input>) => _filter(iter, fnOrIter)
    }
    // Direct form: filter the iterable with the function
    return _filter(fnOrIter, maybeFn!)
}

function* _filter<Input, Output extends Input = Input>(
    iter: Iterable<Input>,
    fn: ((item: Input, index: number) => unknown) | ((item: Input, index: number) => item is Output)
): IterableIterator<Input | Output> {
    let i = 0
    for (const item of iter) {
        if (fn(item, i++)) {
            yield item as Output
        }
    }
}

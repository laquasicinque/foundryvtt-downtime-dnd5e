export type KeyValuePair<U> = [PropertyKey[], U]

/**
 * Recursively searches an object for values matching a predicate.
 * @example
 * ```ts
 * [...search({a: {b: 1}}, (path, val) => typeof val === 'number')] // [['a', 'b'], 1]
 * [...search((_, val) => val === 'test')({x: 'test'})] // [['x'], 'test']
 * ```
 */
export function search<U>(
    fn: (path: PropertyKey[], value: any) => unknown,
    skipAfterYield?: boolean
): (obj: object) => IterableIterator<KeyValuePair<U>>
export function search<U>(
    obj: unknown,
    fn: (path: PropertyKey[], value: any) => unknown,
    skipAfterYield?: boolean
): IterableIterator<KeyValuePair<U>>
export function search<U>(
    fnOrObj: unknown,
    skipAfterYieldOrFn?: boolean | ((path: PropertyKey[], value: any) => unknown),
    maybeSkipAfterYield?: boolean
): IterableIterator<KeyValuePair<U>> | ((obj: object) => IterableIterator<KeyValuePair<U>>) {
    if (typeof fnOrObj === 'function') {
        // Curried form: return a function that takes an object
        return (obj: any) => _search(obj, fnOrObj as (path: PropertyKey[], value: any) => unknown, skipAfterYieldOrFn as boolean)
    }
    // Direct form: search the object
    return _search(fnOrObj, skipAfterYieldOrFn as ((path: PropertyKey[], value: any) => unknown), maybeSkipAfterYield)
}

function* _search<U>(
    obj: unknown,
    fn: (path: PropertyKey[], value: any) => unknown,
    skipAfterYield = false
): IterableIterator<KeyValuePair<U>> {
    const seen = new Set()

    /* istanbul ignore next */
    function* _recursiveSearch(value: any, path: PropertyKey[] = []): Generator<KeyValuePair<U>> {
        if (fn(path, value)) {
            yield [path, value]
            if (skipAfterYield) {
                return
            }
        }

        if (value == null || typeof value !== 'object') {
            return
        }

        seen.add(value)

        if (Array.isArray(value)) {
            const len = value.length
            for (let i = 0; i < len; i++) {
                const item = value[i] as unknown
                if (seen.has(item)) {
                    continue
                }
                yield* _recursiveSearch(item, [...path, i])
            }
            return
        }

        for (const [key, val] of Object.entries(value as NonNullable<unknown>)) {
            if (seen.has(val)) {
                continue
            }
            yield* _recursiveSearch(val, [...path, key])
        }
    }

    yield* _recursiveSearch(obj, [])
}

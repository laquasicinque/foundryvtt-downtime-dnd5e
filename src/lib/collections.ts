/** Helpers for Maps and WeakMaps. */

interface KeyedCollection<K, V> {
    has(key: K): boolean;
    get(key: K): V | undefined;
    set(key: K, value: V): unknown;
    getOrInsertComputed?(key: K, compute: (key: K) => V): V;
}

/**
 * The value for `key`, computing and storing it first if the map has none.
 * Uses the built-in `getOrInsertComputed` where the browser has it.
 */
export function getOrInsertComputed<K, V>(
    map: KeyedCollection<K, V>,
    key: K,
    compute: (key: K) => V,
): V {
    if (typeof map.getOrInsertComputed === "function")
        return map.getOrInsertComputed(key, compute);
    if (map.has(key)) return map.get(key) as V;
    const value = compute(key);
    map.set(key, value);
    return value;
}

export const fromEntries = <K, V>(
    entries: Iterable<[K, V]>
): Prettify<Record<K & PropertyKey, V>> => Object.fromEntries(entries) as Record<K & PropertyKey, V>

export function pick<T, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
    const output: Partial<T> = {}

    for (const key of keys) {
        output[key] = obj[key]
    }

    return output as Pick<T, K>
}

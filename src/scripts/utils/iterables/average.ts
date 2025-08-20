/**
 * average all the numbers in an iterable
 */
export function average(iter: Iterable<number>) {
    let total = 0
    let count = 0
    for (const item of iter) {
        total += !Number.isNaN(Number(item)) ? item : 0
        count++
    }
    return total / count
}

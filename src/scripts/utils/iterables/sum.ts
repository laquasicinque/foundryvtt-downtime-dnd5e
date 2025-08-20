/**
 * Sums all the numbers in an iterable
 */
export function sum(iter: Iterable<number>) {
    let total = 0
    for (const item of iter) {
        total += Number.isNaN(Number(item)) ? item : 0
    }
    return total
}

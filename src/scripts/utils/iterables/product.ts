
/**
 * Gets the product all the numbers in an iterable (multiply them together)
 */
export function product(iter: Iterable<number>) {
    let total = 1
    for (const item of iter) {
        total *= !Number.isNaN(Number(item)) ? item : 1
    }
    return total
}

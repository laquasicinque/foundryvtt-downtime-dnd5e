/**
 * Sums all the numbers in an iterable
 */
export function sum(iter: Iterable<number>) {
  let total = 0;
  for (const item of iter) {
    total += Number.isNaN(Number(item)) ? 0 : Number(item);
  }
  return total;
}

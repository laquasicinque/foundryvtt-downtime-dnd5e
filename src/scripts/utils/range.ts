/**
 * returns an iterable that iterates between stop and start with given stepsize
 * @example ```ts
 * [...range(0,10,2)] // [0,2,4,6,8,10]
 * ```
 */
export function* range(stop: number, start = 0, stepSize = 1) {
  const step = Math.abs(stepSize) * Math.sign(stop - start)
  if (step === 0) throw new Error('Step size must be non-zero')
  if (stop > start) {
    for (let i = start; i <= stop; i += step) yield i
  } else {
    for (let i = start; i >= stop; i += step) yield i
  }
}

export type FunctionChainInput<Input> = [(input: Input) => any, ...((x: any) => any)[]]
export type FunctionChainOutput<Output> = [...((x: any) => any)[], (input: any) => Output]
export type FunctionChain<Input, Output> = FunctionChainInput<Input> & FunctionChainOutput<Output>

/**
 * calls the functions on the input in order given in the array
 *
 * @template Input the input of the first function in `fns`
 * @template Output the output of the last function in `fns`
 * @param input input to apply the functions on
 * @param fns array of functions to apply to the input
 * @example
 * ```ts
 * const double = (x:number) => x * 2
 * const plus5 = (x:number) => x + 5
 * apply(5, [double, plus5]) // result: 15
 * ```
 */
export const apply = <Input, Output>(input: Input, fns: FunctionChain<Input, Output>): Output =>
  fns.reduce((value, fn) => fn(value) as Input, input) as unknown as Output
/**
 * Returns a function that applies the given functions to the input in the order they were provided
 * The curried version of apply
 *
 * @template Input the input of the first function in `fns`
 * @template Output the output of the last function in `fns`
 * @param fns array of functions to apply to the input
 * @example
 * ```ts
 * const double = x => x * 2
 * const plus5 = x => x + 5
 *
 * const doubleThenAdd5 = pipe([double, add5])
 * doubleThenAdd5(5) // returns 15
 * ```
 * @see apply
 */
export const pipe =
  <Input, Output>(fns: FunctionChain<Input, Output>) =>
  (item: Input): Output =>
    apply(item, fns)


export function manualOverride<
    Fn extends (...args: any[]) => any
>(constructor: ConstructorOf<unknown>, method: string, cb: CallbackWithOverride<Fn>) {
    const og = constructor.prototype[method]
    if (typeof og !== 'function') throw new Error("A non-static method is required to be overridden")

    constructor.prototype[method] = function (...args: Parameters<Fn>) {
        // "super call"
        const superResult = og.apply(this, args)
        if (superResult instanceof Promise) {
            // little hack to name a function
            // wrpa this in an async function and return that for a nicer stack trace
            const awaiter = {
                awaiter: async () => {
                    return cb.call(this, await superResult, ...args)
                }
            }['awaiter']
            return awaiter()
        }
        return cb.call(this, superResult, ...args)
    }
}


type ConstructorOf<Class> = {
    new(...args: any[]): Class
}

type CallbackWithOverride<
    Func
> = Func extends Fn<infer Parameters, infer Result>
    ? (...args: [superResult: Result, ...Parameters]) => Result : never
type Values<T> = T[keyof T]
type FunctionOnlyKeys<T> = Values<{
    [K in keyof T]: T[K] extends Function ? K : never
}>

type Fn<Parameters extends readonly unknown[], ReturnType> = (...args: Parameters) => ReturnType

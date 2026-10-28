/** Small shared type helpers. */

export type MaybeGetter<T> = T | (() => T);

export type AnyArray = any[];
export type AnyFunction = (...args: any[]) => any;
export type AnyConstructor = { new (...args: any[]): any };

export type DeepPartial<T extends object> = _DeepPartial<T>;

type _DeepPartial<T> = T extends object
    ? T extends AnyArray | AnyFunction | AnyConstructor
        ? T
        : {
              [K in keyof T]?: _DeepPartial<T[K]>;
          }
    : T;

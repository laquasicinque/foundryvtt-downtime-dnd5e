import { average } from './average'
import { chunk } from './chunk'
import { entries } from './entries'
import { every } from './every'
import { filter } from './filter'
import { first } from './first'
import { flat, FlatItem } from './flat'
import { gen } from './gen'
import { join } from './join'
import { last } from './last'
import { map } from './map'
import { partition } from './partition'
import { pluck } from './pluck'
import { product } from './product'
import { range } from './range'
import { skip } from './skip'
import { skipWhile } from './skipWhile'
import { some } from './some'
import { sum } from './sum'
import { take } from './take'
import { takeWhile } from './takeWhile'
import { until } from './until'
import { unzip, UnzipOutput } from './unzip'
import { windows } from './windows'
import { zip } from './zip'

const _collectAsArray = <T>([...x]: Iterable<T>): T[] => x


/**
 * Class version of the iterable functions. Wraps iterable results in itself
 * other than collect
 */
export class Iter<T> implements Iterable<T> {
    #value: Iterable<T>

    static from<T>(iterable: Iterable<T>) {
        return new Iter<T>(iterable)
    }

    static fromEntries(obj: Partial<Record<PropertyKey, unknown>>) {
        return new Iter(entries(obj))
    }

    static fromRange(stop: number, start?: number, stepSize?: number) {
        return new Iter(range(stop, start, stepSize))
    }

    static gen<T>(fn: (index: number) => T) {
        return new Iter(gen(fn)())
    }

    static zip<const I extends Iterable<unknown>[]>(iter: I, stopOnMin?: boolean) {
        return new Iter(zip(iter, stopOnMin))
    }

    constructor(iterable: Iterable<T>) {
        this.#value = iterable
    }

    flatMap<U>(fn: (item: T, index: number) => U) {
        return this.map(fn).flat(1)
    }

    flat<Depth extends number = 1>(depth?: Depth) {
        return new Iter(flat(this.#value as any, depth ?? 1)) as Iter<FlatItem<T, Depth>>
    }

    map<U>(fn: (item: T, index: number) => U) {
        return new Iter(map(this.#value, fn))
    }

    filter(fn: (item: T, index: number) => unknown) {
        return new Iter(filter(this.#value, fn))
    }

    pluck<K extends keyof T>(key: K): Iter<T[K]> {
        return new Iter(pluck(this.#value, key))
    }

    take(count: number) {
        return new Iter(take(this.#value, count))
    }

    chunk(count: number) {
        return new Iter(chunk(this.#value, count))
    }

    skip(count: number) {
        return new Iter(skip(this.#value, count))
    }

    takeWhile(fn: (item: T, index: number) => unknown) {
        return new Iter(takeWhile(this.#value, fn))
    }

    skipWhile(fn: (item: T, index: number) => unknown) {
        return new Iter(skipWhile(this.#value, fn))
    }

    until(fn: (item: T, index: number) => unknown) {
        return new Iter(until(this.#value, fn))
    }

    windows(size: number) {
        return new Iter(windows(this.#value, size))
    }

    // methods that won't necessarily return Iter instances

    first() {
        return first(this.#value)
    }
    last() {
        return last(this.#value)
    }

    every(fn: (item: T, index: number) => unknown) {
        return every(this.#value, fn)
    }

    some(fn: (item: T, index: number) => unknown) {
        return some(this.#value, fn)
    }

    unzip<Output = [T] extends [readonly unknown[]] ? UnzipOutput<T> : never>(): Output {
        return unzip(this.#value as Iterable<readonly unknown[]>) as Output
    }

    sum<Output = [T] extends [number] ? number : never>(): Output {
        return sum(this.#value as unknown as Iterable<number>) as Output
    }

    product<Output = [T] extends [number] ? number : never>(): Output {
        return product(this.#value as unknown as Iterable<number>) as Output
    }

    average<Output = [T] extends [number] ? number : never>(): Output {
        return average(this.#value as unknown as Iterable<number>) as Output
    }

    partition<Result extends T = T>(predicate: (item: T, index: number) => item is Result): [passed: T[], failed: T[]]
    partition(predicate: (item: T, index: number) => unknown): [passed: T[], failed: T[]]
    partition(predicate: (item: T, index: number) => unknown) {
        return partition(this.#value, predicate)
    }

    join(delimiter = ',') {
        return join(this.#value, delimiter)
    }

    collect<Output = T[]>(collector?: (x: Iterable<T>) => Output): Output {
        return collector ? collector(this.#value) : (_collectAsArray<T>(this.#value) as Output)
    }

    toArray() {
        return this.collect()
    }

    [Symbol.iterator](): Iterator<T> {
        return this.#value[Symbol.iterator]()
    }
}

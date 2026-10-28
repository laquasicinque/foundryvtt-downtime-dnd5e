import { describe, expect, it, vi } from "vite-plus/test";
import { getOrInsertComputed } from "../../lib/collections";

/** A Map without the built-in method, to exercise the fallback. */
function plainMap<K, V>(entries: [K, V][] = []) {
    const map = new Map(entries);
    Object.defineProperty(map, "getOrInsertComputed", { value: undefined });
    return map;
}

describe("getOrInsertComputed", () => {
    it("computes and stores a missing value", () => {
        const map = plainMap<string, number>();
        expect(getOrInsertComputed(map, "a", (k) => k.length)).toBe(1);
        expect(map.get("a")).toBe(1);
    });

    it("returns an existing value without computing", () => {
        const compute = vi.fn(() => 2);
        expect(getOrInsertComputed(plainMap([["a", 1]]), "a", compute)).toBe(1);
        expect(compute).not.toHaveBeenCalled();
    });

    it("keeps a stored undefined", () => {
        const compute = vi.fn(() => 2);
        const map = plainMap<string, number | undefined>([["a", undefined]]);
        expect(getOrInsertComputed(map, "a", compute)).toBeUndefined();
        expect(compute).not.toHaveBeenCalled();
    });

    it("works with WeakMaps", () => {
        const key = {};
        const map = new WeakMap<object, string[]>();
        getOrInsertComputed(map, key, () => []).push("x");
        expect(map.get(key)).toEqual(["x"]);
    });
});

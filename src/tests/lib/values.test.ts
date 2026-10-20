import { describe, expect, it } from "vite-plus/test";
import {
    finiteOrNull,
    isFiniteNumber,
    isRecord,
    parseFinite,
} from "../../lib/values";

describe("isRecord", () => {
    it("accepts plain objects only", () => {
        expect(isRecord({})).toBe(true);
        expect(isRecord({ a: 1 })).toBe(true);
        expect(isRecord(null)).toBe(false);
        expect(isRecord([])).toBe(false);
        expect(isRecord("x")).toBe(false);
        expect(isRecord(undefined)).toBe(false);
    });
});

describe("isFiniteNumber / finiteOrNull", () => {
    it("rejects NaN, infinities and non-numbers", () => {
        expect(isFiniteNumber(0)).toBe(true);
        expect(isFiniteNumber(-2.5)).toBe(true);
        expect(isFiniteNumber(Number.NaN)).toBe(false);
        expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
        expect(isFiniteNumber("3")).toBe(false);
        expect(finiteOrNull(12)).toBe(12);
        expect(finiteOrNull(Number.NaN)).toBeNull();
        expect(finiteOrNull(undefined)).toBeNull();
        expect(finiteOrNull("12")).toBeNull();
    });
});

describe("parseFinite", () => {
    it("parses numbers and numeric strings", () => {
        expect(parseFinite(4)).toBe(4);
        expect(parseFinite("4")).toBe(4);
        expect(parseFinite(" -1.5 ")).toBe(-1.5);
    });

    it("is null for blank, non-numeric and non-finite input", () => {
        expect(parseFinite("")).toBeNull();
        expect(parseFinite("   ")).toBeNull();
        expect(parseFinite("abc")).toBeNull();
        expect(parseFinite("Infinity")).toBeNull();
        expect(parseFinite(Number.NaN)).toBeNull();
        expect(parseFinite(null)).toBeNull();
        expect(parseFinite(true)).toBeNull();
    });
});

import { describe, expect, it } from "vite-plus/test";
import {
    effectiveDc,
    evaluateDelta,
    formulaData,
    resolveBand,
    type BandRoll,
} from "../../../model/rules/bands";
import {
    clampProgress,
    computeDelta,
    percentOf,
} from "../../../model/rules/progress";
import { band } from "../../helpers/fixtures";
import type { ResultTable } from "../../../types/data";

const roll = (
    total: number,
    natural: number | null,
    dc: number | null = null,
): BandRoll => ({
    total,
    natural,
    dc,
});

const resolve = (table: ResultTable, r: BandRoll) => resolveBand(table, r)?.id;

describe("result bands", () => {
    it("nat 20 = 2, nat 1 = -1, otherwise 1", () => {
        const table: ResultTable = {
            bands: [
                band("crit", 2, [{ on: "NATURAL", op: "eq", value: 20 }]),
                band(
                    "botch",
                    -1,
                    [{ on: "NATURAL", op: "eq", value: 1 }],
                    "FAILURE",
                ),
                band("normal", 1),
            ],
        };
        expect(resolve(table, roll(25, 20))).toBe("crit");
        expect(resolve(table, roll(3, 1))).toBe("botch");
        expect(resolve(table, roll(12, 9))).toBe("normal");
    });

    it("DC tiers by total: 10 → 1, 15 → 2, 20 → 4", () => {
        const table: ResultTable = {
            bands: [
                band("t20", 4, [{ on: "TOTAL", op: "gte", value: 20 }]),
                band("t15", 2, [{ on: "TOTAL", op: "gte", value: 15 }]),
                band("t10", 1, [{ on: "TOTAL", op: "gte", value: 10 }]),
                band("fail", 0, [], "FAILURE"),
            ],
        };
        expect(resolve(table, roll(9, 9))).toBe("fail");
        expect(resolve(table, roll(10, 10))).toBe("t10");
        expect(resolve(table, roll(17, 12))).toBe("t15");
        expect(resolve(table, roll(23, 18))).toBe("t20");
    });

    it("margin ladder follows the DC", () => {
        const table: ResultTable = {
            bands: [
                band("great", 3, [{ on: "MARGIN", op: "gte", value: 10 }]),
                band("good", 2, [{ on: "MARGIN", op: "gte", value: 5 }]),
                band("pass", 1, [{ on: "MARGIN", op: "gte", value: 0 }]),
                band(
                    "bad",
                    -1,
                    [{ on: "MARGIN", op: "lte", value: -5 }],
                    "FAILURE",
                ),
                band("fail", 0, [], "FAILURE"),
            ],
        };
        expect(resolve(table, roll(10, 5, 10))).toBe("pass");
        expect(resolve(table, roll(15, 5, 10))).toBe("good");
        expect(resolve(table, roll(15, 5, 15))).toBe("pass");
        expect(resolve(table, roll(4, 2, 10))).toBe("bad");
        expect(resolve(table, roll(8, 2, 10))).toBe("fail");
    });

    it("skips NATURAL without a d20 and MARGIN without a DC", () => {
        const table: ResultTable = {
            bands: [
                band("crit", 2, [{ on: "NATURAL", op: "eq", value: 20 }]),
                band("pass", 1, [{ on: "MARGIN", op: "gte", value: 0 }]),
                band("otherwise", 0, [], null),
            ],
        };
        expect(resolve(table, roll(20, null, null))).toBe("otherwise");
    });

    it("requires every condition in a band to match", () => {
        const table: ResultTable = {
            bands: [
                band("crit-and-pass", 3, [
                    { on: "NATURAL", op: "eq", value: 20 },
                    { on: "MARGIN", op: "gte", value: 0 },
                ]),
                band("otherwise", 0),
            ],
        };
        expect(resolve(table, roll(15, 20, 20))).toBe("otherwise");
        expect(resolve(table, roll(25, 20, 20))).toBe("crit-and-pass");
    });
});

describe("effective DC", () => {
    it("prefers the method DC", () => {
        expect(effectiveDc(12, 15)).toEqual({ dc: 12, source: "METHOD" });
    });
    it("falls back to the activity DC", () => {
        expect(effectiveDc(null, 15)).toEqual({ dc: 15, source: "ACTIVITY" });
    });
    it("has no DC when neither is set", () => {
        expect(effectiveDc(null, null)).toEqual({ dc: null, source: null });
    });
});

describe("delta evaluation", () => {
    it("returns STATIC values directly", async () => {
        const value = await evaluateDelta(
            { kind: "STATIC", value: 3 },
            formulaData(null),
            () => {
                throw new Error("not called");
            },
        );
        expect(value).toBe(3);
    });

    it("passes roll variables to the formula evaluator", async () => {
        const data = formulaData(roll(17, 12, 10));
        expect(data).toMatchObject({
            total: 17,
            natural: 12,
            dc: 10,
            margin: 7,
        });
        const value = await evaluateDelta(
            { kind: "FORMULA", formula: "1 + floor(@margin / 5)" },
            data,
            (_formula, d) => 1 + Math.floor((d.margin ?? 0) / 5),
        );
        expect(value).toBe(2);
    });

    it("rejects non-finite formula results", async () => {
        await expect(
            evaluateDelta(
                { kind: "FORMULA", formula: "x" },
                formulaData(null),
                () => Number.NaN,
            ),
        ).rejects.toThrow(/finite/);
    });
});

describe("progress", () => {
    const bounded = { target: 10, min: 0, max: 10 };
    const open = { target: null, min: null, max: null };

    it("clamps to bounds, null meaning unbounded", () => {
        expect(clampProgress(12, bounded)).toBe(10);
        expect(clampProgress(-3, bounded)).toBe(0);
        expect(clampProgress(-3, open)).toBe(-3);
        expect(clampProgress(1e6, open)).toBe(1e6);
    });

    it("records requested and applied separately", () => {
        expect(computeDelta(8, 4, bounded)).toEqual({
            requested: 4,
            applied: 2,
            before: 8,
            after: 10,
        });
        expect(computeDelta(8, 4, open)).toEqual({
            requested: 4,
            applied: 4,
            before: 8,
            after: 12,
        });
    });

    it("calculates percentages only with a target", () => {
        expect(percentOf(5, 10)).toBe(50);
        expect(percentOf(15, 10)).toBe(150);
        expect(percentOf(5, null)).toBeNull();
        expect(percentOf(5, 0)).toBeNull();
    });
});

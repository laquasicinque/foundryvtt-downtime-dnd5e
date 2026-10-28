import { describe, expect, it } from "vite-plus/test";
import { t } from "../../helpers/i18n";
import { alice, bob, gm, item, skillMethod } from "../../helpers/fixtures";
import { HistoryBuilder } from "../../helpers/HistoryBuilder";
import type { UsageRule } from "../../../types/data";
import {
    currentTier,
    tierFor,
    usageCount,
    usageProblems,
} from "../../../model/rules/usage";

const attemptsPerActor: UsageRule = {
    count: { kind: "ATTEMPTS" },
    per: "ACTOR",
    tiers: [
        {
            from: 2,
            kind: "EFFECT",
            effect: { delta: { kind: "STATIC", value: 0 } },
        },
        { from: 3, kind: "DISABLE", hint: "Exhausted" },
    ],
};

describe("usageCount", () => {
    const history = new HistoryBuilder()
        .method("e1", 1, { contributor: alice })
        .method("e2", 0, { contributor: alice })
        .method("e3", 1, { contributor: bob })
        .method("e4", 1, { contributor: alice, methodId: "other" })
        .adjust("e5", 1, alice)
        .set("e6", 0, alice).events;

    it("counts attempts per actor for the method only", () => {
        expect(usageCount(history, "m1", attemptsPerActor, alice)).toBe(2);
        expect(usageCount(history, "m1", attemptsPerActor, bob)).toBe(1);
    });

    it("counts per item across everyone", () => {
        expect(
            usageCount(history, "m1", { ...attemptsPerActor, per: "ITEM" }, gm),
        ).toBe(3);
    });

    it("counts successes and failures by band countsAs", () => {
        expect(
            usageCount(
                history,
                "m1",
                { ...attemptsPerActor, count: { kind: "SUCCESSES" } },
                alice,
            ),
        ).toBe(1);
        expect(
            usageCount(
                history,
                "m1",
                { ...attemptsPerActor, count: { kind: "FAILURES" } },
                alice,
            ),
        ).toBe(1);
    });

    it("counts specific bands", () => {
        const rule: UsageRule = {
            ...attemptsPerActor,
            per: "ITEM",
            count: { kind: "BANDS", bandIds: ["pass"] },
        };
        expect(usageCount(history, "m1", rule, alice)).toBe(2);
    });

    it("counts per user, falling back to name", () => {
        const sameUserOtherActor = { ...bob, userId: "user-a" };
        expect(
            usageCount(
                history,
                "m1",
                { ...attemptsPerActor, per: "USER" },
                sameUserOtherActor,
            ),
        ).toBe(2);
    });

    it("ignores reverted events", () => {
        const reverted = new HistoryBuilder()
            .method("e1", 1, { contributor: alice })
            .method("e2", 1, { contributor: alice })
            .revert("r1", "e2").events;
        expect(usageCount(reverted, "m1", attemptsPerActor, alice)).toBe(1);
    });
});

describe("tierFor", () => {
    it("uses the implicit NORMAL tier below the first threshold", () => {
        expect(tierFor(attemptsPerActor, 0)).toEqual({
            tier: { from: 0, kind: "NORMAL" },
            index: null,
        });
        expect(tierFor(attemptsPerActor, 1).index).toBeNull();
    });

    it("picks the highest threshold reached", () => {
        expect(tierFor(attemptsPerActor, 2).tier.kind).toBe("EFFECT");
        expect(tierFor(attemptsPerActor, 3).tier.kind).toBe("DISABLE");
        expect(tierFor(attemptsPerActor, 99).index).toBe(1);
    });
});

describe("currentTier", () => {
    it("returns null for methods without a usage rule", () => {
        expect(
            currentTier(item({ methods: [skillMethod()] }), "m1", alice),
        ).toBeNull();
    });

    it("combines count and tier for the next use", () => {
        const history = new HistoryBuilder()
            .method("e1", 1)
            .method("e2", 1)
            .method("e3", 1).events;
        const tracked = item({
            methods: [skillMethod({ usage: attemptsPerActor })],
            history,
        });
        expect(currentTier(tracked, "m1", alice)).toMatchObject({
            count: 3,
            index: 1,
            tier: { kind: "DISABLE" },
        });
    });
});

describe("usageProblems", () => {
    const rule = (patch: Partial<UsageRule>): UsageRule => ({
        count: { kind: "ATTEMPTS" },
        per: "ACTOR",
        tiers: [{ from: 2, kind: "DISABLE", hint: null }],
        ...patch,
    });

    it("is quiet for a sensible rule", () => {
        expect(usageProblems(rule({}), [], t)).toEqual([]);
    });

    it("flags empty and deleted counted results", () => {
        expect(
            usageProblems(
                rule({ count: { kind: "BANDS", bandIds: [] } }),
                ["a"],
                t,
            ),
        ).toHaveLength(1);
        expect(
            usageProblems(
                rule({ count: { kind: "BANDS", bandIds: ["x"] } }),
                ["a"],
                t,
            )[0],
        ).toMatch(/no longer exists/);
    });

    it("flags duplicate, zero and missing steps", () => {
        expect(
            usageProblems(
                rule({
                    tiers: [
                        { from: 0, kind: "NORMAL" },
                        { from: 0, kind: "HIDE" },
                    ],
                }),
                [],
                t,
            ),
        ).toHaveLength(2);
        expect(usageProblems(rule({ tiers: [] }), [], t)[0]).toMatch(
            /Add a step/,
        );
    });
});

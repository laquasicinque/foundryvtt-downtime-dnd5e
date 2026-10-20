import { describe, expect, it } from "vite-plus/test";
import { t } from "../../helpers/i18n";
import {
    actionProblems,
    detectMilestones,
    hitsMilestone,
    milestoneProblems,
    repeatProgress,
} from "../../../model/rules/milestones";
import { computeDelta } from "../../../model/rules/progress";
import { item, milestone } from "../../helpers/fixtures";
import type { MilestoneAction, MilestoneData } from "../../../types/data";

describe("CROSS milestones", () => {
    const ms = milestone({ at: 10 });

    it("fires when moving from below to at/above", () => {
        expect(hitsMilestone(ms, 8, 10)).toBe(true);
        expect(hitsMilestone(ms, 8, 12)).toBe(true);
    });

    it("does not fire when already at/above, or moving down (v1)", () => {
        expect(hitsMilestone(ms, 10, 12)).toBe(false);
        expect(hitsMilestone(ms, 12, 8)).toBe(false);
        expect(hitsMilestone(ms, 4, 9)).toBe(false);
    });
});

describe("EXACT milestones", () => {
    const ms = milestone({ at: 10, match: "EXACT", maxTimes: null });

    it("checks after clamping: 8 + 4 clamped to 10 fires", () => {
        const { before, after } = computeDelta(8, 4, {
            target: 10,
            min: 0,
            max: 10,
        });
        expect(hitsMilestone(ms, before, after)).toBe(true);
    });

    it("does not fire when overshooting without a clamp", () => {
        const { before, after } = computeDelta(8, 4, {
            target: 10,
            min: 0,
            max: null,
        });
        expect(hitsMilestone(ms, before, after)).toBe(false);
    });

    it("fires from either direction", () => {
        expect(hitsMilestone(ms, 12, 10)).toBe(true);
    });

    it("does not re-fire while staying on the value", () => {
        expect(hitsMilestone(ms, 10, 10)).toBe(false);
    });
});

describe("detectMilestones", () => {
    const once = milestone({ id: "once", at: 5, maxTimes: 1 });
    const twice = milestone({ id: "twice", at: 5, maxTimes: 2 });
    const always = milestone({ id: "always", at: 5, maxTimes: null });
    const far = milestone({ id: "far", at: 50 });

    it("respects maxTimes using derived fire counts", () => {
        const fired = detectMilestones([once, twice, always, far], 0, 6, {
            once: 1,
            twice: 1,
            always: 7,
        });
        expect(fired.map((m) => m.id)).toEqual(["twice", "always"]);
    });

    it("fires several milestones crossed in one change, in definition order", () => {
        const fired = detectMilestones([far, once], 0, 60, {});
        expect(fired.map((m) => m.id)).toEqual(["far", "once"]);
    });
});

describe("EVERY (repeating) milestones", () => {
    const every8 = milestone({
        id: "batch",
        at: 8,
        match: "EVERY",
        maxTimes: null,
    });

    it("fires once per multiple passed, including several in one change", () => {
        expect(detectMilestones([every8], 0, 7, {})).toHaveLength(0);
        expect(detectMilestones([every8], 7, 8, {})).toHaveLength(1);
        expect(detectMilestones([every8], 8, 15, {})).toHaveLength(0);
        expect(detectMilestones([every8], 5, 25, {})).toHaveLength(3);
    });

    it("only counts positive multiples and only going up", () => {
        expect(detectMilestones([every8], -9, 3, {})).toHaveLength(0);
        expect(detectMilestones([every8], 20, 10, {})).toHaveLength(0);
    });

    it("respects maxTimes across firings", () => {
        const capped = { ...every8, maxTimes: 3 };
        expect(detectMilestones([capped], 0, 40, { batch: 1 })).toHaveLength(2);
        expect(detectMilestones([capped], 0, 40, { batch: 3 })).toHaveLength(0);
    });

    it("reports progress through the current batch", () => {
        expect(repeatProgress(29, 8)).toEqual({
            inBatch: 5,
            size: 8,
            batches: 3,
        });
        expect(repeatProgress(0, 8)).toEqual({
            inBatch: 0,
            size: 8,
            batches: 0,
        });
    });
});

describe("milestone and action problems", () => {
    const ctx = {
        store: { kind: "WORLD" } as const,
        progress: { target: 10, min: 0, max: 10 },
        items: [item({ id: "other" })],
        t,
    };

    it("flags unreachable and invalid milestones", () => {
        const p = (patch: Partial<MilestoneData>) =>
            milestoneProblems(milestone(patch), ctx).map((x) => x.blocking);
        expect(p({ at: 10 })).toEqual([]);
        expect(p({ at: 12 })).toEqual([false]);
        expect(p({ at: 0, match: "CROSS" })).toEqual([false]);
        expect(p({ at: 0, match: "EVERY" })).toEqual([true]);
    });

    it("blocks incomplete actions and impossible recipients", () => {
        const a = (action: MilestoneAction) =>
            actionProblems(action, ctx).map((x) => [x.blocking, x.message]);
        expect(
            a({
                id: "g",
                kind: "GRANT_ITEM",
                sourceUuid: "",
                quantity: 1,
                recipient: { type: "OWNING_ACTOR" },
            }).map(([b]) => b),
        ).toEqual([true, true]);
        expect(
            a({
                id: "g",
                kind: "APPLY_EFFECT",
                sourceUuid: "x",
                recipient: { type: "ACTOR", actorUuids: [], selection: "AUTO" },
            }).map(([b]) => b),
        ).toEqual([true]);
        expect(
            a({ id: "m", kind: "MACRO", macroUuid: "x", undoMacroUuid: null }),
        ).toEqual([[false, expect.stringMatching(/undo macro/)]]);
        expect(
            a({
                id: "j",
                kind: "ADJUST_PROGRESS",
                ref: { kind: "ITEM", id: "missing" },
                delta: 0,
            }).map(([b]) => b),
        ).toEqual([false, false]);
        expect(
            a({
                id: "j",
                kind: "ADJUST_PROGRESS",
                ref: { kind: "ITEM", id: "other" },
                delta: 2,
            }),
        ).toEqual([]);
    });
});

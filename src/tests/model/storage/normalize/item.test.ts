import { describe, expect, it } from "vite-plus/test";
import { t, text } from "../../../helpers/i18n";
import { deriveState } from "../../../../model/rules/derive";
import { counterIds } from "../../../helpers/fixtures";
import {
    parseCategory,
    parseTrackedItem,
} from "../../../../model/storage/normalize/item";

const parse = (raw: unknown) =>
    parseTrackedItem(raw, { randomId: counterIds(), t });

const validMethod = {
    id: "m1",
    kind: "SKILL",
    name: "Practice",
    skill: "ath",
    dc: 10,
    results: {
        bands: [
            {
                id: "pass",
                label: "Pass",
                when: [{ on: "MARGIN", op: "gte", value: 0 }],
                effect: { delta: { kind: "STATIC", value: 1 } },
                countsAs: "SUCCESS",
            },
            {
                id: "fail",
                label: "Fail",
                when: [],
                effect: { delta: { kind: "STATIC", value: 0 } },
                countsAs: "FAILURE",
            },
        ],
    },
};

const methodEvent = (
    id: string,
    seq: number,
    applied: number,
    extra: Record<string, unknown> = {},
) => ({
    id,
    kind: "METHOD",
    seq,
    timestamp: 1000 + seq,
    contributor: {
        actorUuid: "Actor.a",
        actorName: "A",
        userId: "u",
        userName: "U",
        userWasGM: false,
    },
    methodId: "m1",
    method: { name: "Practice", kind: "SKILL" },
    band: { id: "pass", label: "Pass", countsAs: "SUCCESS" },
    roll: null,
    usageTier: null,
    progress: { requested: applied, applied, before: 0, after: applied },
    dismissed: false,
    note: null,
    ...extra,
});

const validItem = (overrides: Record<string, unknown> = {}) => ({
    schemaVersion: 3,
    id: "item1",
    name: "Train",
    img: "icons/x.webp",
    description: "",
    categoryId: null,
    hidden: false,
    preset: "goal",
    progress: { target: 10, min: 0, max: 10 },
    approval: "WORLD_DEFAULT",
    methods: [validMethod],
    milestones: [
        {
            id: "ms1",
            label: "Done",
            at: 10,
            match: "CROSS",
            maxTimes: 1,
            revertWithCause: true,
            actions: [{ id: "a1", kind: "COMPLETE" }],
        },
    ],
    history: [methodEvent("e1", 0, 1), methodEvent("e2", 1, 1)],
    quarantine: [],
    ...overrides,
});

describe("parseTrackedItem: valid data", () => {
    it("parses a valid item without issues", () => {
        const result = parse(validItem());
        expect(result.issues).toEqual([]);
        expect(result.value?.methods).toHaveLength(1);
        expect(deriveState(result.value!).value).toBe(2);
    });

    it("round-trips: parsing its own output yields the same item", () => {
        const first = parse(validItem()).value!;
        const second = parse(JSON.parse(JSON.stringify(first)));
        expect(second.value).toEqual(first);
        expect(second.issues).toEqual([]);
    });
});

describe("parseTrackedItem: fatal", () => {
    it.each([null, "x", 3, []])("rejects non-objects (%j)", (raw) => {
        const result = parse(raw);
        expect(result.value).toBeNull();
        expect(result.issues[0]!.severity).toBe("fatal");
    });

    it("rejects data that needs migration", () => {
        const result = parse({ ...validItem(), schemaVersion: 1 });
        expect(result.value).toBeNull();
        expect(text(result.issues[0]!.message)).toMatch(/needs migration/);
    });
});

describe("parseTrackedItem: repairs", () => {
    it("fills missing simple fields with defaults", () => {
        const result = parse({ schemaVersion: 3 });
        expect(result.value).toMatchObject({
            id: "gen1",
            name: "Unnamed",
            progress: { target: null, min: 0, max: null },
            approval: "WORLD_DEFAULT",
            methods: [],
            history: [],
        });
        expect(result.issues.every((i) => i.severity === "repaired")).toBe(
            true,
        );
    });

    it("converts numeric strings", () => {
        const result = parse(
            validItem({ progress: { target: "10", min: "0", max: "10" } }),
        );
        expect(result.value!.progress).toEqual({ target: 10, min: 0, max: 10 });
        expect(
            result.issues.some((i) =>
                text(i.message)?.includes("converted string to number"),
            ),
        ).toBe(true);
    });

    it("swaps inverted bounds", () => {
        expect(
            parse(validItem({ progress: { target: 10, min: 10, max: 0 } }))
                .value!.progress,
        ).toEqual({
            target: 10,
            min: 0,
            max: 10,
        });
    });

    it("appends a missing 'otherwise' band", () => {
        const method = {
            ...validMethod,
            results: { bands: [validMethod.results.bands[0]] },
        };
        const result = parse(validItem({ methods: [method] }));
        const bands = (
            result.value!.methods[0] as {
                results: { bands: { when: unknown[] }[] };
            }
        ).results.bands;
        expect(bands).toHaveLength(2);
        expect(bands[1]!.when).toEqual([]);
    });
});

describe("parseTrackedItem: timestamps (never broken)", () => {
    it.each([
        ["{} from a serialised Date", {}, null],
        ["missing", undefined, null],
        ["invalid string", "not a date", null],
        [
            "ISO string",
            "2024-01-02T03:04:05.000Z",
            Date.parse("2024-01-02T03:04:05.000Z"),
        ],
        ["epoch number", 1700000000000, 1700000000000],
    ])("%s", (_name, timestamp, expected) => {
        const result = parse(
            validItem({ history: [methodEvent("e1", 0, 1, { timestamp })] }),
        );
        expect(result.value!.history).toHaveLength(1);
        expect(result.value!.history[0]!.timestamp).toBe(expected);
        expect(result.issues.every((i) => i.severity === "repaired")).toBe(
            true,
        );
    });
});

describe("parseTrackedItem: quarantine", () => {
    it("quarantines a broken method but keeps the rest of the item", () => {
        const broken = { id: "m2", kind: "SKILL", name: "Broken" }; // no skill, no results
        const result = parse(validItem({ methods: [validMethod, broken] }));
        expect(result.value!.methods.map((m) => m.id)).toEqual(["m1"]);
        expect(result.value!.quarantine).toHaveLength(1);
        expect(result.value!.quarantine[0]).toMatchObject({
            path: "methods[1]",
            raw: broken,
        });
        expect(result.issues.some((i) => i.severity === "quarantined")).toBe(
            true,
        );
    });

    it("fails closed: a broken requirement quarantines its method", () => {
        const method = {
            ...validMethod,
            requirements: [
                { id: "r1", whenUnmet: "HIDE", test: { kind: "NOPE" } },
            ],
        };
        const result = parse(validItem({ methods: [method] }));
        expect(result.value!.methods).toEqual([]);
        expect(result.value!.quarantine).toHaveLength(1);
    });

    it("fails closed: a broken action quarantines its milestone", () => {
        const ms = {
            id: "ms1",
            at: 10,
            actions: [{ id: "a1", kind: "GRANT_ITEM" }],
        }; // no sourceUuid/recipient
        const result = parse(validItem({ milestones: [ms] }));
        expect(result.value!.milestones).toEqual([]);
        expect(result.value!.quarantine[0]!.path).toBe("milestones[0]");
    });

    it("quarantines ADD_TRACKED_ITEM templates with any invalid part", () => {
        const ms = {
            id: "ms1",
            at: 10,
            actions: [
                {
                    id: "a1",
                    kind: "ADD_TRACKED_ITEM",
                    template: { name: "Next", methods: [{ kind: "SKILL" }] },
                },
            ],
        };
        const result = parse(validItem({ milestones: [ms] }));
        expect(result.value!.milestones).toEqual([]);
    });

    it("quarantines duplicate ids", () => {
        const result = parse(
            validItem({
                methods: [validMethod, { ...validMethod, name: "Copy" }],
            }),
        );
        expect(result.value!.methods).toHaveLength(1);
        expect(text(result.value!.quarantine[0]!.reason)).toMatch(
            /duplicate id m1/,
        );
    });

    it("quarantines broken events and unknown event kinds", () => {
        const result = parse(
            validItem({
                history: [
                    methodEvent("e1", 0, 1),
                    { id: "e2", kind: "TELEPORT", seq: 1 },
                    methodEvent("e3", 2, 1, { progress: {} }),
                ],
            }),
        );
        expect(result.value!.history.map((e) => e.id)).toEqual(["e1"]);
        expect(result.value!.quarantine.map((q) => q.path)).toEqual([
            "history[1]",
            "history[2]",
        ]);
    });

    it("keeps existing quarantine entries", () => {
        const result = parse(
            validItem({
                quarantine: [
                    { path: "methods[3]", reason: "old", raw: { x: 1 } },
                ],
            }),
        );
        expect(result.value!.quarantine).toEqual([
            { path: "methods[3]", reason: "old", raw: { x: 1 } },
        ]);
    });

    it("drops an unreadable roll summary instead of quarantining the event", () => {
        const result = parse(
            validItem({
                history: [
                    methodEvent("e1", 0, 1, { roll: { rolled: "nope" } }),
                ],
            }),
        );
        expect(result.value!.history[0]!).toMatchObject({
            id: "e1",
            roll: null,
        });
        expect(result.value!.quarantine).toEqual([]);
    });
});

describe("parseTrackedItem: history storage shape and ordering", () => {
    it("accepts keyed history and uses keys as fallback ids", () => {
        const { id: _id, ...withoutId } = methodEvent("ignored", 1, 2);
        const result = parse(
            validItem({ history: { a: methodEvent("a", 0, 1), b: withoutId } }),
        );
        expect(result.value!.history.map((e) => e.id)).toEqual(["a", "b"]);
    });

    it("sorts by seq regardless of storage order", () => {
        const result = parse(
            validItem({
                history: [
                    methodEvent("late", 5, 1),
                    methodEvent("early", 2, 1),
                ],
            }),
        );
        expect(result.value!.history.map((e) => e.id)).toEqual([
            "early",
            "late",
        ]);
        expect(result.issues).toEqual([]);
    });

    it("renumbers missing or duplicate seq, keeping a stable order", () => {
        const result = parse(
            validItem({
                history: [
                    methodEvent("b", 1, 1, { timestamp: 20 }),
                    methodEvent("a", 1, 1, { timestamp: 10 }),
                    methodEvent("c", 0, 1, { seq: undefined }),
                ],
            }),
        );
        expect(result.value!.history.map((e) => [e.id, e.seq])).toEqual([
            ["a", 0],
            ["b", 1],
            ["c", 2],
        ]);
        expect(
            result.issues.some((i) => text(i.message)?.includes("renumbered")),
        ).toBe(true);
    });

    it("accepts a V1-style plain string contributor", () => {
        const result = parse(
            validItem({
                history: [methodEvent("e1", 0, 1, { contributor: "Player A" })],
            }),
        );
        expect(result.value!.history[0]!.contributor.userName).toBe("Player A");
    });
});

describe("parseCategory", () => {
    it("repairs missing fields", () => {
        expect(
            parseCategory({ name: 3 }, { randomId: counterIds("cat"), t })
                .value,
        ).toEqual({
            id: "cat1",
            name: "3",
            description: "",
        });
    });

    it("is fatal for non-objects", () => {
        expect(
            parseCategory("x", { randomId: counterIds(), t }).value,
        ).toBeNull();
    });
});

describe("parseTrackedItem: repeating milestones and item requirements", () => {
    it("accepts EVERY milestones with a positive interval and quarantines others", () => {
        const good = {
            id: "m1",
            at: 8,
            match: "EVERY",
            maxTimes: null,
            actions: [],
        };
        const bad = {
            id: "m2",
            at: 0,
            match: "EVERY",
            maxTimes: null,
            actions: [],
        };
        const result = parse(validItem({ milestones: [good, bad] }));
        expect(result.value!.milestones.map((m) => m.id)).toEqual(["m1"]);
        expect(text(result.value!.quarantine[0]!.reason)).toMatch(
            /positive interval/,
        );
    });

    it("parses item requirements, defaulting to none", () => {
        expect(parse(validItem()).value!.requirements).toEqual([]);
        const requirement = {
            id: "r1",
            whenUnmet: "HIDE",
            hint: null,
            test: { kind: "TOOL_PROFICIENCY", tool: "woodcarver" },
        };
        expect(
            parse(validItem({ requirements: [requirement] })).value!
                .requirements,
        ).toEqual([requirement]);
    });

    it("fails closed: an unreadable item requirement hides the item from players", () => {
        const result = parse(
            validItem({
                hidden: false,
                requirements: [
                    { id: "r1", whenUnmet: "HIDE", test: { kind: "NOPE" } },
                ],
            }),
        );
        expect(result.value!.hidden).toBe(true);
        expect(result.value!.requirements).toEqual([]);
        expect(result.value!.quarantine).toHaveLength(1);
    });
});

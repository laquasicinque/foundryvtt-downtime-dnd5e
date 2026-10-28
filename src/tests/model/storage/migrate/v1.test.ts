import { describe, expect, it } from "vite-plus/test";
import { t, text } from "../../../helpers/i18n";
import { resolveBand } from "../../../../model/rules/bands";
import { deriveState } from "../../../../model/rules/derive";
import { counterIds } from "../../../helpers/fixtures";
import type {
    CheckMethodData,
    FixedMethodData,
    MacroMethodData,
} from "../../../../types/data";
import {
    isV1Item,
    migratedValueMatches,
    migrateV1Item,
    type V1MigrationContext,
} from "../../../../model/storage/migrate/v1";

const ctx = (
    overrides: Partial<V1MigrationContext> = {},
): V1MigrationContext => ({
    randomId: counterIds("mig"),
    resolveToolKey: (id) => (id === "toolItem1" ? "smith" : null),
    resolveMacroUuid: (name) => (name === "Gain XP" ? "Macro.xp" : null),
    methodName: (style, key) => `${style}:${key ?? ""}`,
    t,
    isMethodAction: (name) => name.startsWith("Roll "),
    now: () => 9_999,
    ...overrides,
});

/** Shaped like real V1 data, including the `{}` timestamps Date objects turned into. */
const v1 = (overrides: Record<string, unknown> = {}) => ({
    id: "v1item",
    name: "Train Athletics",
    img: "icons/svg/sword.svg",
    category: "",
    hidden: false,
    description: "<p>Lift things</p>",
    progressionStyle: "SKILL",
    skill: "ath",
    ability: null,
    tool: null,
    fixedIncrease: null,
    macroName: null,
    dc: 12,
    progress: 2,
    completionAt: 5,
    schemaVersion: 1,
    changes: [
        {
            id: "c1",
            timestamp: {},
            actionName: "Roll Athletics",
            valueChanged: "progress",
            oldValue: 0,
            newValue: 1,
            user: "Player A",
            note: "",
        },
        {
            id: "c2",
            timestamp: "2024-03-01T10:00:00.000Z",
            actionName: "Adjust Progress (=)",
            valueChanged: "progress",
            oldValue: 1,
            newValue: 2,
            user: "Gamemaster",
            note: "",
            dismissed: true,
        },
    ],
    ...overrides,
});

const migrate = (raw: unknown, context = ctx()) => migrateV1Item(raw, context);

describe("isV1Item", () => {
    it("detects V1 and pre-V1 data", () => {
        expect(isV1Item(v1())).toBe(true);
        expect(isV1Item({ name: "old" })).toBe(true);
        expect(isV1Item({ schemaVersion: 3 })).toBe(false);
        expect(isV1Item(null)).toBe(false);
    });
});

describe("migrateV1Item: item and progress", () => {
    it("maps item fields and V1 bounds", () => {
        const item = migrate(v1()).value!;
        expect(item).toMatchObject({
            schemaVersion: 3,
            id: "v1item",
            name: "Train Athletics",
            img: "icons/svg/sword.svg",
            description: "<p>Lift things</p>",
            categoryId: null,
            preset: "goal",
            progress: { target: 5, min: 0, max: 5 },
        });
    });

    it("keeps the category id", () => {
        expect(migrate(v1({ category: "cat1" })).value!.categoryId).toBe(
            "cat1",
        );
    });

    it("derives the same progress V1 stored", () => {
        const result = migrate(v1());
        expect(deriveState(result.value!).value).toBe(2);
        expect(migratedValueMatches(result.value!, v1())).toBe(true);
    });
});

describe("migrateV1Item: methods", () => {
    it("SKILL with DC: pass (+1) / fail (+0) bands", () => {
        const method = migrate(v1()).value!.methods[0] as CheckMethodData;
        expect(method).toMatchObject({
            id: "v1-method",
            kind: "SKILL",
            skill: "ath",
            dc: 12,
            name: "SKILL:ath",
        });
        expect(
            resolveBand(method.results, { total: 12, natural: 8, dc: 12 })
                ?.effect.delta,
        ).toEqual({ kind: "STATIC", value: 1 });
        expect(
            resolveBand(method.results, { total: 11, natural: 8, dc: 12 })
                ?.effect.delta,
        ).toEqual({ kind: "STATIC", value: 0 });
    });

    it("no DC: adds the roll total", () => {
        const method = migrate(v1({ dc: null })).value!
            .methods[0] as CheckMethodData;
        expect(method.dc).toBeNull();
        expect(method.results.bands).toHaveLength(1);
        expect(method.results.bands[0]!.effect.delta).toEqual({
            kind: "FORMULA",
            formula: "@total",
        });
    });

    it("ABILITY", () => {
        const method = migrate(
            v1({ progressionStyle: "ABILITY", ability: "str", skill: null }),
        ).value!.methods[0];
        expect(method).toMatchObject({ kind: "ABILITY", ability: "str" });
    });

    it("TOOL resolves the item id to a tool key", () => {
        const method = migrate(
            v1({ progressionStyle: "TOOL", tool: "toolItem1" }),
        ).value!.methods[0];
        expect(method).toMatchObject({
            kind: "TOOL",
            tool: "smith",
            fallback: null,
        });
    });

    it("TOOL that can't be resolved is quarantined with a clear reason", () => {
        const result = migrate(v1({ progressionStyle: "TOOL", tool: "gone" }));
        expect(result.value!.methods).toEqual([]);
        expect(text(result.value!.quarantine[0]!.reason)).toMatch(
            /could not be resolved/,
        );
        expect(result.issues.some((i) => i.severity === "quarantined")).toBe(
            true,
        );
    });

    it.each([
        [{ fixedIncrease: 3 }, 3],
        [{ fixedIncrease: null, fixed: 2 }, 2],
        [{ fixedIncrease: null }, 1],
    ])("FIXED %j → +%i", (fields, value) => {
        const method = migrate(
            v1({ progressionStyle: "FIXED", skill: null, ...fields }),
        ).value!.methods[0] as FixedMethodData;
        expect(method.effect.delta).toEqual({ kind: "STATIC", value });
    });

    it("MACRO keeps the name and resolves the uuid when possible", () => {
        const found = migrate(
            v1({ progressionStyle: "MACRO", macro: "Gain XP" }),
        ).value!.methods[0] as MacroMethodData;
        expect(found).toMatchObject({
            macroUuid: "Macro.xp",
            macroName: "Gain XP",
        });
        const missing = migrate(
            v1({ progressionStyle: "MACRO", macro: "Deleted" }),
        ).value!.methods[0] as MacroMethodData;
        expect(missing).toMatchObject({ macroUuid: "", macroName: "Deleted" });
    });
});

describe("migrateV1Item: history", () => {
    it("turns audit entries into LEGACY events, keeping order, dismissed and contributor", () => {
        const history = migrate(v1()).value!.history;
        expect(history.map((e) => [e.id, e.kind, e.seq])).toEqual([
            ["c1", "LEGACY", 0],
            ["c2", "LEGACY", 1],
        ]);
        expect(history[0]).toMatchObject({
            contributor: { userName: "Player A" },
            dismissed: false,
            methodId: "v1-method",
        });
        expect(history[1]).toMatchObject({
            contributor: { userName: "Gamemaster" },
            dismissed: true,
            methodId: null,
        });
    });

    it("repairs `{}` timestamps to null without reporting them as broken", () => {
        const result = migrate(v1());
        expect(result.value!.history[0]!.timestamp).toBeNull();
        expect(result.value!.history[1]!.timestamp).toBe(
            Date.parse("2024-03-01T10:00:00.000Z"),
        );
        expect(result.issues.filter((i) => i.severity !== "repaired")).toEqual(
            [],
        );
    });

    it("appends a MIGRATION SET when history doesn't explain the stored progress", () => {
        const result = migrate(v1({ progress: 4 }));
        const last = result.value!.history.at(-1)!;
        expect(last).toMatchObject({
            kind: "SET",
            reason: "MIGRATION",
            value: 4,
            before: 2,
        });
        expect(migratedValueMatches(result.value!, v1({ progress: 4 }))).toBe(
            true,
        );
    });

    it("handles items with no history at all", () => {
        const result = migrate(v1({ changes: undefined, progress: 3 }));
        expect(result.value!.history.map((e) => e.kind)).toEqual(["SET"]);
        expect(deriveState(result.value!).value).toBe(3);
    });

    it("quarantines unreadable audit entries", () => {
        const result = migrate(
            v1({
                changes: ["junk", { id: "c9", oldValue: "x", newValue: 1 }],
                progress: 0,
            }),
        );
        expect(result.value!.quarantine.map((q) => q.path)).toEqual([
            "history[0]",
            "history[1]",
        ]);
    });
});

describe("migrateV1Item: completion", () => {
    it("adds a completion milestone that completes and announces", () => {
        const milestone = migrate(v1()).value!.milestones[0]!;
        expect(milestone).toMatchObject({ at: 5, match: "CROSS", maxTimes: 1 });
        expect(milestone.actions.map((a) => a.kind)).toEqual([
            "COMPLETE",
            "ANNOUNCE",
        ]);
    });

    it("records already-complete items as fired so they don't re-announce", () => {
        const raw = v1({
            progress: 5,
            changes: [
                {
                    id: "c1",
                    timestamp: 1,
                    actionName: "Roll Athletics",
                    oldValue: 4,
                    newValue: 5,
                    user: "A",
                },
            ],
        });
        const item = migrate(raw).value!;
        const state = deriveState(item);
        expect(state).toMatchObject({
            value: 5,
            completed: true,
            everCompleted: true,
        });
        expect(state.milestoneFires).toEqual({ "v1-completion": 1 });
    });

    it("has no milestone or target when V1 had no completion value", () => {
        const item = migrate(v1({ completionAt: 0 })).value!;
        expect(item.milestones).toEqual([]);
        expect(item.progress).toEqual({ target: null, min: 0, max: null });
    });
});

describe("migrateV1Item: robustness", () => {
    it("repairs numeric strings from old data", () => {
        const item = migrate(
            v1({ progress: "2", completionAt: "5", dc: "12" }),
        ).value!;
        expect(item.progress.target).toBe(5);
        expect((item.methods[0] as CheckMethodData).dc).toBe(12);
        expect(deriveState(item).value).toBe(2);
    });

    it("is fatal (not a crash) for non-objects", () => {
        expect(migrate("junk").value).toBeNull();
    });
});

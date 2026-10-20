import { describe, expect, it } from "vite-plus/test";
import { t } from "../../helpers/i18n";
import { ActivityAdapterRegistry } from "../../../model/ActivityAdapterRegistry";
import { resolveBand } from "../../../model/rules/bands";
import { deriveState } from "../../../model/rules/derive";
import {
    changeMethodKind,
    createFromPreset,
    defaultMethod,
    defaultResultTable,
    describeCondition,
    ensureOtherwise,
    groupByCategory,
    insertBand,
    moveBand,
    newConditionalBand,
    removeBand,
    syncCompletionMilestones,
    ACTION_KIND_LABELS,
    defaultAction,
    defaultMilestone,
    defaultRecipient,
    defaultTier,
    defaultUsageRule,
    duplicateData,
    moveMethod,
    parseProgressInput,
    placeInOrder,
    sortTiers,
    templateFrom,
    tierKindsFor,
} from "../../../model/authoring/editing";
import { parseTrackedItem } from "../../../model/storage/normalize/item";
import { naturalOf, toClientRoll } from "../../../model/rules/rolls";
import { counterIds, item, skillMethod } from "../../helpers/fixtures";
import { HistoryBuilder } from "../../helpers/HistoryBuilder";
import type { CheckMethodData, ResultTable } from "../../../types/data";

const ids = () => counterIds("e");

describe("result table editing", () => {
    it("defaults to 'meet the DC → +1, otherwise +0' with a DC", () => {
        const table = defaultResultTable(true, ids());
        expect(
            resolveBand(table, { total: 10, natural: 5, dc: 10 })?.effect.delta,
        ).toEqual({ kind: "STATIC", value: 1 });
        expect(
            resolveBand(table, { total: 9, natural: 5, dc: 10 })?.effect.delta,
        ).toEqual({ kind: "STATIC", value: 0 });
    });

    it("defaults to '+roll total' without a DC", () => {
        const table = defaultResultTable(false, ids());
        expect(table.bands).toHaveLength(1);
        expect(table.bands[0]!.effect.delta).toEqual({
            kind: "FORMULA",
            formula: "@total",
        });
    });

    it("never inserts below the otherwise row", () => {
        const newId = ids();
        const table = defaultResultTable(true, newId);
        const band = newConditionalBand(newId, true, 5);
        const below = insertBand(table, 1, "below", band);
        expect(below.bands.map((b) => b.id)).toEqual([
            table.bands[0]!.id,
            band.id,
            table.bands[1]!.id,
        ]);
        const above = insertBand(table, 0, "above", band);
        expect(above.bands[0]!.id).toBe(band.id);
    });

    it("keeps the otherwise row last when moving and removing", () => {
        const newId = ids();
        let table: ResultTable = defaultResultTable(true, newId);
        table = insertBand(
            table,
            0,
            "above",
            newConditionalBand(newId, true, 5),
        );
        const otherwise = table.bands.at(-1)!.id;
        expect(moveBand(table, 1, 1)).toBe(table); // can't move below otherwise
        expect(moveBand(table, 2, -1)).toBe(table); // can't move otherwise
        expect(
            moveBand(table, 1, -1)
                .bands.map((b) => b.id)
                .at(-1),
        ).toBe(otherwise);
        expect(removeBand(table, 2)).toBe(table);
        expect(removeBand(table, 0).bands).toHaveLength(2);
    });

    it("ensureOtherwise appends a missing fallback", () => {
        const newId = ids();
        const table = { bands: [newConditionalBand(newId, true)] };
        expect(ensureOtherwise(table, newId).bands.at(-1)!.when).toEqual([]);
        const complete = defaultResultTable(true, newId);
        expect(ensureOtherwise(complete, newId)).toBe(complete);
    });

    it("describes thresholds relative to the DC with resulting totals", () => {
        expect(
            describeCondition({ on: "MARGIN", op: "gte", value: 5 }, 10, t),
        ).toBe("total ≥ DC + 5 (15)");
        expect(
            describeCondition({ on: "MARGIN", op: "lte", value: -5 }, null, t),
        ).toBe("total ≤ DC − 5");
        expect(
            describeCondition({ on: "NATURAL", op: "eq", value: 20 }, 10, t),
        ).toBe("natural = 20");
    });
});

describe("methods", () => {
    it.each(["ABILITY", "SKILL", "TOOL", "FIXED", "MANUAL", "MACRO"] as const)(
        "default %s method is valid",
        (kind) => {
            const item = createFromPreset(
                "goal",
                { name: "x", target: 10 },
                ids(),
                t,
            );
            const method = defaultMethod(kind, ids(), t);
            // TOOL/MACRO need a tool/macro picked before they're valid; fill one in.
            if (method.kind === "TOOL") method.tool = "smith";
            if (method.kind === "MACRO") method.macroName = "Some macro";
            const parsed = parseTrackedItem(
                { ...item, methods: [method] },
                { randomId: ids(), t },
            );
            expect(parsed.value?.methods).toHaveLength(1);
            expect(parsed.value?.quarantine).toEqual([]);
        },
    );

    it("keeps shared fields, DC and results when switching between check kinds", () => {
        const skill = defaultMethod("SKILL", ids(), t) as CheckMethodData;
        const asTool = changeMethodKind(
            { ...skill, name: "Practice", dc: 14 },
            "TOOL",
            ids(),
            t,
        ) as CheckMethodData;
        expect(asTool).toMatchObject({
            id: skill.id,
            kind: "TOOL",
            name: "Practice",
            dc: 14,
            results: skill.results,
        });
        expect(changeMethodKind(skill, "FIXED", ids(), t)).toMatchObject({
            id: skill.id,
            kind: "FIXED",
        });
    });
});

describe("presets", () => {
    it("goal completes at the target (V1 behaviour)", () => {
        const item = createFromPreset(
            "goal",
            { name: "Train", target: 3 },
            ids(),
            t,
        );
        expect(item.progress).toEqual({ target: 3, min: 0, max: 3 });
        expect(item.milestones[0]!.actions.map((a) => a.kind)).toEqual([
            "COMPLETE",
            "ANNOUNCE",
        ]);
        expect(parseTrackedItem(item, { randomId: ids(), t }).issues).toEqual(
            [],
        );
        expect(deriveState(item).completed).toBe(false);
    });

    it("goal-lock also locks", () => {
        const item = createFromPreset(
            "goal-lock",
            { name: "Train", target: 3 },
            ids(),
            t,
        );
        expect(item.milestones[0]!.actions.map((a) => a.kind)).toEqual([
            "COMPLETE",
            "LOCK",
            "ANNOUNCE",
        ]);
    });

    it("open-ended has no target or milestones", () => {
        const item = createFromPreset(
            "open-ended",
            { name: "Tally", target: 3 },
            ids(),
            t,
        );
        expect(item.progress).toEqual({ target: null, min: 0, max: null });
        expect(item.milestones).toEqual([]);
    });
});

describe("groupByCategory", () => {
    it("groups in category order with uncategorised (and dangling) items last", () => {
        const items = [
            { id: "a", categoryId: "c2" },
            { id: "b", categoryId: null },
            { id: "c", categoryId: "c1" },
            { id: "d", categoryId: "deleted" },
        ];
        const groups = groupByCategory(items, [
            { id: "c1", name: "One", description: "" },
            { id: "c2", name: "Two", description: "" },
        ]);
        expect(
            groups.map((g) => [
                g.category?.id ?? null,
                g.items.map((i) => i.id),
            ]),
        ).toEqual([
            ["c1", ["c"]],
            ["c2", ["a"]],
            [null, ["b", "d"]],
        ]);
    });
});

describe("rolls", () => {
    const rolled = { kind: "SKILL" as const, key: "ath", label: "Athletics" };

    it("takes the kept d20 face from a D20Roll", () => {
        expect(
            naturalOf({ formula: "2d20kh + 5", total: 22, d20: { total: 17 } }),
        ).toBe(17);
    });

    it("takes a single d20 from a formula roll, and nothing otherwise", () => {
        expect(
            naturalOf({
                formula: "1d20 + 2",
                total: 9,
                dice: [{ faces: 20, total: 7 }],
            }),
        ).toBe(7);
        expect(
            naturalOf({
                formula: "2d6",
                total: 9,
                dice: [{ faces: 6, total: 9 }],
            }),
        ).toBeNull();
        expect(
            naturalOf({
                formula: "1d20 + 1d20",
                total: 9,
                dice: [
                    { faces: 20, total: 4 },
                    { faces: 20, total: 5 },
                ],
            }),
        ).toBeNull();
    });

    it("builds a ClientRoll with message id and roll mode", () => {
        const roll = toClientRoll(
            {
                formula: "1d20 + 5",
                total: 18,
                d20: { total: 13 },
                options: { rollMode: "gmroll" },
                parent: { id: "msg1" },
            },
            rolled,
            15,
            "publicroll",
        );
        expect(roll).toEqual({
            formula: "1d20 + 5",
            total: 18,
            natural: 13,
            activityDc: 15,
            rolled,
            rollMode: "gmroll",
            messageId: "msg1",
        });
    });

    it("rejects unevaluated rolls", () => {
        expect(() =>
            toClientRoll({ formula: "1d20" }, rolled, null, "publicroll"),
        ).toThrow(/no total/);
    });
});

describe("ActivityAdapterRegistry", () => {
    const option = (label: string) => ({ label, roll: async () => null });

    it("returns options from the adapter for the activity type", () => {
        const registry = new ActivityAdapterRegistry();
        registry.register({
            type: "check",
            source: "downtime-dnd5e",
            options: () => [option("Athletics"), option("Acrobatics")],
        });
        expect(
            registry.optionsFor({ type: "check" }, {}).map((o) => o.label),
        ).toEqual(["Athletics", "Acrobatics"]);
        expect(registry.optionsFor({ type: "attack" }, {})).toEqual([]);
    });

    it("lets later registrations override, warning about the conflict", () => {
        const warnings: string[] = [];
        const registry = new ActivityAdapterRegistry((m) => warnings.push(m));
        registry.register({
            type: "check",
            source: "downtime-dnd5e",
            options: () => [option("built-in")],
        });
        registry.register({
            type: "check",
            source: "other-module",
            options: () => [option("custom")],
        });
        expect(registry.optionsFor({ type: "check" }, {})[0]!.label).toBe(
            "custom",
        );
        expect(warnings[0]).toMatch(
            /other-module replaces the one from downtime-dnd5e/,
        );
    });

    it("treats a throwing adapter as unavailable", () => {
        const warnings: string[] = [];
        const registry = new ActivityAdapterRegistry((m) => warnings.push(m));
        registry.register({
            type: "boom",
            source: "x",
            options: () => {
                throw new Error("bad");
            },
        });
        expect(registry.optionsFor({ type: "boom" }, {})).toEqual([]);
        expect(warnings[0]).toMatch(/failed: bad/);
    });

    it("unregisters", () => {
        const registry = new ActivityAdapterRegistry();
        registry.register({
            type: "check",
            source: "x",
            options: () => [option("a")],
        });
        expect(registry.unregister("check")).toBe(true);
        expect(registry.types()).toEqual([]);
    });
});

describe("syncCompletionMilestones", () => {
    it("moves completion milestones that sat on the old target", () => {
        const newId = ids();
        const item = createFromPreset(
            "goal",
            { name: "Train", target: 10 },
            newId,
            t,
        );
        const other = {
            ...item.milestones[0]!,
            id: "halfway",
            at: 5,
            actions: [],
        };
        const edited = {
            ...item,
            milestones: [...item.milestones, other],
            progress: { target: 20, min: 0, max: 20 },
        };
        const synced = syncCompletionMilestones(edited, 10);
        expect(synced.milestones.map((m) => m.at)).toEqual([20, 5]);
    });

    it("does nothing without a target change", () => {
        const item = createFromPreset(
            "goal",
            { name: "Train", target: 10 },
            ids(),
            t,
        );
        expect(syncCompletionMilestones(item, 10)).toBe(item);
        expect(syncCompletionMilestones(item, null)).toBe(item);
    });
});

describe("usage and milestone defaults", () => {
    const parseItem = (patch: Record<string, unknown>) =>
        parseTrackedItem(
            {
                ...createFromPreset(
                    "goal",
                    { name: "x", target: 10 },
                    ids(),
                    t,
                ),
                ...patch,
            },
            { randomId: ids(), t },
        );

    it.each(["NORMAL", "RESULTS", "EFFECT", "DISABLE", "HIDE"] as const)(
        "%s tier is valid on a method that supports it",
        (kind) => {
            const method = defaultMethod(
                kind === "EFFECT" ? "FIXED" : "SKILL",
                ids(),
                t,
            );
            expect(tierKindsFor(method.kind)).toContain(kind);
            const usage = {
                ...defaultUsageRule(),
                tiers: [defaultTier(kind, 2, method, ids())],
            };
            const parsed = parseItem({ methods: [{ ...method, usage }] });
            expect(parsed.value?.methods).toHaveLength(1);
            expect(parsed.value?.quarantine).toEqual([]);
        },
    );

    it("sorts tiers by threshold", () => {
        const method = defaultMethod("FIXED", ids(), t);
        const rule = {
            ...defaultUsageRule(),
            tiers: [
                defaultTier("DISABLE", 5, method, ids()),
                defaultTier("EFFECT", 2, method, ids()),
            ],
        };
        expect(sortTiers(rule).tiers.map((t) => t.from)).toEqual([2, 5]);
    });

    it.each(
        Object.keys(ACTION_KIND_LABELS) as (keyof typeof ACTION_KIND_LABELS)[],
    )("%s action is valid once required fields are set", (kind) => {
        const action = defaultAction(kind, ids(), t) as unknown as Record<
            string,
            unknown
        >;
        if ("sourceUuid" in action) action.sourceUuid = "Compendium.x.Item.y";
        if (kind === "MACRO") action.macroUuid = "Macro.abc";
        const milestone = { ...defaultMilestone(ids(), 5), actions: [action] };
        const parsed = parseItem({ milestones: [milestone] });
        expect(parsed.value?.milestones).toHaveLength(1);
        expect(parsed.value?.quarantine).toEqual([]);
    });

    it.each([
        "TRIGGERING_ACTOR",
        "OWNING_ACTOR",
        "ACTOR",
        "CONTRIBUTORS",
    ] as const)("%s recipient is valid", (type) => {
        const recipient = defaultRecipient(type);
        if (recipient.type === "ACTOR") recipient.actorUuids = ["Actor.a"];
        const action = {
            ...defaultAction("GRANT_ITEM", ids(), t),
            sourceUuid: "Compendium.x.Item.y",
            recipient,
        };
        const parsed = parseItem({
            milestones: [{ ...defaultMilestone(ids(), 5), actions: [action] }],
        });
        expect(parsed.value?.quarantine).toEqual([]);
    });

    it("templates drop identity and history", () => {
        const item = createFromPreset(
            "goal",
            { name: "Template me", target: 4 },
            ids(),
            t,
        );
        const template = templateFrom(item) as Record<string, unknown>;
        expect(template).not.toHaveProperty("id");
        expect(template).not.toHaveProperty("history");
        expect(template.name).toBe("Template me");
    });
});

describe("duplicateData", () => {
    it("copies the configuration without identity, history or quarantine", () => {
        const source = item({
            id: "orig",
            name: "Fletch",
            history: new HistoryBuilder().method("e1", 1).events,
            methods: [skillMethod()],
        });
        const copy = duplicateData(source);
        expect(copy.name).toBe("Fletch (copy)");
        expect(copy.methods).toEqual(source.methods);
        expect(copy).not.toHaveProperty("id");
        expect(copy).not.toHaveProperty("history");
        expect(copy).not.toHaveProperty("quarantine");
    });
});

describe("moveMethod", () => {
    const a = () =>
        item({
            id: "a",
            methods: [
                skillMethod({ id: "m1" }),
                skillMethod({ id: "m2" }),
                skillMethod({ id: "m3" }),
            ],
        });
    const ids = (i: { methods: { id: string }[] }) =>
        i.methods.map((m) => m.id);

    it("reorders within an item", () => {
        const src = a();
        expect(
            ids(moveMethod(src, src, "m1", 3, false, counterIds("n")).target),
        ).toEqual(["m2", "m3", "m1"]);
        expect(
            ids(moveMethod(src, src, "m3", 0, false, counterIds("n")).target),
        ).toEqual(["m3", "m1", "m2"]);
        expect(
            ids(moveMethod(src, src, "m2", 1, false, counterIds("n")).target),
        ).toEqual(["m1", "m2", "m3"]);
    });

    it("copies within an item with a new id", () => {
        const src = a();
        expect(
            ids(moveMethod(src, src, "m1", 1, true, counterIds("n")).target),
        ).toEqual(["m1", "n1", "m2", "m3"]);
    });

    it("moves to another item, renaming on collision", () => {
        const target = item({ id: "b", methods: [skillMethod({ id: "m2" })] });
        const { source, target: t } = moveMethod(
            a(),
            target,
            "m2",
            0,
            false,
            counterIds("n"),
        );
        expect(ids(source)).toEqual(["m1", "m3"]);
        expect(ids(t)).toEqual(["n1", "m2"]);
        const copied = moveMethod(a(), target, "m1", 5, true, counterIds("n"));
        expect(ids(copied.source)).toEqual(["m1", "m2", "m3"]);
        expect(ids(copied.target)).toEqual(["m2", "n1"]);
    });
});

describe("placeInOrder", () => {
    it("moves an id before another, or to the end", () => {
        expect(placeInOrder(["a", "b", "c"], "c", "a")).toEqual([
            "c",
            "a",
            "b",
        ]);
        expect(placeInOrder(["a", "b", "c"], "a", null)).toEqual([
            "b",
            "c",
            "a",
        ]);
        expect(placeInOrder(["a", "b"], "x", "b")).toEqual(["a", "x", "b"]);
    });
});

describe("parseProgressInput", () => {
    it("treats signed numbers as changes and plain ones as values", () => {
        expect(parseProgressInput("+100")).toEqual({
            kind: "adjust",
            delta: 100,
        });
        expect(parseProgressInput(" -5 ")).toEqual({
            kind: "adjust",
            delta: -5,
        });
        expect(parseProgressInput("−2")).toEqual({ kind: "adjust", delta: -2 });
        expect(parseProgressInput("12")).toEqual({ kind: "set", value: 12 });
        expect(parseProgressInput("1.5")).toEqual({ kind: "set", value: 1.5 });
        expect(parseProgressInput("")).toBeNull();
        expect(parseProgressInput("abc")).toBeNull();
        expect(parseProgressInput("+")).toBeNull();
    });
});

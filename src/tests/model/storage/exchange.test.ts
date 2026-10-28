import { describe, expect, it } from "vite-plus/test";
import { t } from "../../helpers/i18n";
import {
    buildExport,
    detectImport,
    parseImport,
    planImport,
} from "../../../model/storage/exchange";
import type { V1MigrationContext } from "../../../model/storage/migrate/v1";
import { counterIds, item } from "../../helpers/fixtures";
import { HistoryBuilder } from "../../helpers/HistoryBuilder";
import type {
    CategoryData,
    Requirement,
    SetEventData,
} from "../../../types/data";

const v1ctx = (): V1MigrationContext => ({
    randomId: counterIds("mig"),
    resolveToolKey: () => null,
    resolveMacroUuid: () => null,
    methodName: (style) => style,
    t,
    isMethodAction: (name) => name.startsWith("Roll "),
    now: () => 9_999,
});

/** A V1 item whose audit trail doesn't add up to its stored progress. */
const v1Item = {
    id: "v1item",
    name: "Train Athletics",
    img: "",
    category: "c1",
    progressionStyle: "FIXED",
    fixedIncrease: 1,
    progress: 4,
    completionAt: 10,
    changes: [],
};
const v1Category = { id: "c1", name: "Training", description: "" };

const cat: CategoryData = { id: "cat1", name: "Training", description: "" };

describe("export", () => {
    it("is always V3 and round-trips through import", () => {
        const items = [
            item({
                id: "a",
                categoryId: "cat1",
                history: new HistoryBuilder().method("e1", 2).events,
            }),
        ];
        const file = buildExport(
            items,
            [cat],
            new Date("2026-01-02T03:04:05Z"),
        );
        expect(file).toMatchObject({
            module: "downtime-dnd5e",
            schemaVersion: 3,
            exportedAt: "2026-01-02T03:04:05.000Z",
        });
        const imported = parseImport(JSON.parse(JSON.stringify(file)), {
            randomId: counterIds("x"),
            v1: v1ctx(),
        })!;
        expect(imported.format).toBe("V3");
        expect(imported.items).toEqual(items);
        expect(imported.categories).toEqual([cat]);
    });
});

describe("detectImport", () => {
    it("recognises the V1 formats and rejects anything else", () => {
        expect(detectImport({ items: [v1Item], categories: [] })?.format).toBe(
            "V1",
        );
        expect(detectImport([v1Item])?.format).toBe("V1");
        expect(
            detectImport({ value: JSON.stringify([v1Item]) })?.items,
        ).toHaveLength(1);
        expect(detectImport({ foo: 1 })).toBeNull();
        expect(detectImport([{ nope: true }])).toBeNull();
        expect(
            detectImport({
                module: "downtime-dnd5e",
                schemaVersion: 99,
                items: [],
            }),
        ).toBeNull();
    });
});

describe("parseImport (V1)", () => {
    it("migrates and reconciles with an IMPORT set", () => {
        const imported = parseImport(
            { items: [v1Item], categories: [v1Category] },
            { randomId: counterIds("x"), v1: v1ctx() },
        )!;
        expect(imported.format).toBe("V1");
        const [migrated] = imported.items;
        const set = migrated!.history.find(
            (e) => e.kind === "SET",
        ) as SetEventData;
        expect(set).toMatchObject({ reason: "IMPORT", value: 4 });
        expect(imported.categories.map((c) => c.name)).toEqual(["Training"]);
    });
});

describe("planImport", () => {
    const needs = (id: string): Requirement => ({
        id: "r",
        whenUnmet: "HIDE",
        hint: null,
        test: {
            kind: "PROGRESS",
            ref: { kind: "ITEM", id },
            op: "gte",
            value: 1,
        },
    });

    it("renames colliding ids, following references, and matches categories by name", () => {
        const plan = planImport(
            {
                items: [
                    item({
                        id: "a",
                        categoryId: "imported-cat",
                        requirements: [needs("b")],
                    }),
                    item({ id: "b", categoryId: "other-cat" }),
                ],
                categories: [
                    { id: "imported-cat", name: "Training", description: "" },
                    { id: "other-cat", name: "Crafting", description: "" },
                ],
            },
            [item({ id: "b" })],
            [cat],
            counterIds("new"),
        );
        expect(plan.renamed).toEqual({ b: "new1" });
        expect(plan.create.map((i) => [i.id, i.categoryId])).toEqual([
            ["a", "cat1"],
            ["new1", "other-cat"],
        ]);
        expect(plan.create[0]!.requirements[0]!.test).toMatchObject({
            ref: { id: "new1" },
        });
        expect(plan.destCategories?.map((c) => c.name)).toEqual([
            "Training",
            "Crafting",
        ]);
    });
});

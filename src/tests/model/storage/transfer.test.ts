import { describe, expect, it } from "vite-plus/test";
import { counterIds, item, milestone } from "../../helpers/fixtures";
import { HistoryBuilder } from "../../helpers/HistoryBuilder";
import {
    planTransfer,
    refSites,
    type TransferInput,
} from "../../../model/storage/transfer";
import type {
    CategoryData,
    Requirement,
    TrackedItemData,
} from "../../../types/data";

const ACTOR_A = { kind: "ACTOR", actorUuid: "Actor.a" } as const;
const ACTOR_B = { kind: "ACTOR", actorUuid: "Actor.b" } as const;
const WORLD = { kind: "WORLD" } as const;

const needs = (id: string): Requirement => ({
    id: `req-${id}`,
    whenUnmet: "HIDE",
    hint: null,
    test: { kind: "PROGRESS", ref: { kind: "ITEM", id }, op: "gte", value: 1 },
});

const cat: CategoryData = { id: "cat1", name: "Crafting", description: "" };

/** a → (requires) b; c requires a; d adjusts b. */
function store(): TrackedItemData[] {
    return [
        item({
            id: "a",
            name: "A",
            categoryId: "cat1",
            requirements: [needs("b")],
            history: new HistoryBuilder().method("e1", 1).events,
        }),
        item({ id: "b", name: "B" }),
        item({ id: "c", name: "C", requirements: [needs("a")] }),
        item({
            id: "d",
            name: "D",
            milestones: [
                milestone({
                    actions: [
                        {
                            id: "adj",
                            kind: "ADJUST_PROGRESS",
                            ref: { kind: "ITEM", id: "b" },
                            delta: 1,
                        },
                    ],
                }),
            ],
        }),
    ];
}

const input = (patch: Partial<TransferInput> = {}): TransferInput => ({
    mode: "MOVE",
    source: ACTOR_A,
    dest: ACTOR_B,
    sourceItems: store(),
    sourceCategories: [cat],
    destItems: [],
    destCategories: [],
    worldItems: [],
    itemIds: ["a"],
    ...patch,
});

const plan = (patch: Partial<TransferInput> = {}, choices = {}) =>
    planTransfer(input(patch), choices, counterIds("new"));

describe("refSites", () => {
    it("finds requirement and ADJUST_PROGRESS references", () => {
        const [, , c, d] = store();
        expect(refSites(c!)).toEqual([
            { kind: "ITEM_REQUIREMENT", requirementId: "req-a", targetId: "a" },
        ]);
        expect(refSites(d!)).toEqual([
            {
                kind: "ACTION",
                milestoneId: "ms1",
                actionId: "adj",
                targetId: "b",
            },
        ]);
    });
});

describe("planTransfer", () => {
    it("moves dependencies and dependants along by default", () => {
        const p = plan();
        // A needs B; C needs A; D adjusts B, so it follows B.
        expect(p.entries.map((e) => [e.sourceId, e.why])).toEqual([
            ["a", "SELECTED"],
            ["b", "DEPENDENCY"],
            ["c", "INCOMING"],
            ["d", "INCOMING"],
        ]);
        expect(p.result.remove).toEqual(["a", "b", "c", "d"]);
        // The issues stay listed with their (default) choice, so they can be changed.
        expect(p.references.map((r) => [r.key, r.direction, r.choice])).toEqual(
            [
                ["a:req:req-b", "OUTGOING", "INCLUDE"],
                ["c:req:req-a", "INCOMING", "INCLUDE"],
                ["d:action:adj", "INCOMING", "INCLUDE"],
            ],
        );
        expect(p.result.create.find((i) => i.id === "a")!.history).toHaveLength(
            1,
        );
    });

    it("can copy a dependency instead, or remove the reference", () => {
        const copyDep = plan(
            {},
            {
                references: {
                    "a:req:req-b": "COPY_DEPENDENCY",
                    "c:req:req-a": "REMOVE",
                },
            },
        );
        expect(copyDep.entries.map((e) => [e.sourceId, e.mode])).toEqual([
            ["a", "MOVE"],
            ["b", "COPY"],
        ]);
        expect(copyDep.result.remove).toEqual(["a"]);
        expect(
            copyDep.result.updateSource.map((i) => [i.id, i.requirements]),
        ).toEqual([["c", []]]);

        const removed = plan(
            {},
            { references: { "a:req:req-b": "REMOVE", "c:req:req-a": "KEEP" } },
        );
        expect(removed.entries.map((e) => e.sourceId)).toEqual(["a"]);
        expect(removed.result.create[0]!.requirements).toEqual([]);
    });

    it("copies start fresh and keep links via renamed ids on collision", () => {
        const p = plan({
            mode: "COPY",
            itemIds: ["a", "b"],
            destItems: [item({ id: "b", name: "Other B" })],
        });
        // b collides; a's requirement follows the new id. Nothing is removed.
        const b = p.entries.find((e) => e.sourceId === "b")!;
        expect(b.destId).toBe("new1");
        const a = p.result.create.find((i) => i.name === "A")!;
        expect(a.history).toEqual([]);
        expect(a.requirements[0]!.test).toMatchObject({ ref: { id: "new1" } });
        expect(p.result.remove).toEqual([]);
        expect(p.references.every((r) => r.direction === "OUTGOING")).toBe(
            true,
        );
    });

    it("links up with a copy already in the destination", () => {
        const p = plan({
            mode: "COPY",
            destItems: [item({ id: "b", name: "B (copied earlier)" })],
        });
        expect(p.entries.map((e) => e.sourceId)).toEqual(["a"]);
        expect(p.result.create[0]!.requirements[0]!.test).toMatchObject({
            ref: { id: "b" },
        });
    });

    it("references into the world still resolve from an actor", () => {
        const p = plan({
            worldItems: [item({ id: "b", name: "World B" })],
            sourceItems: store().filter((i) => i.id !== "b"),
        });
        expect(p.references.filter((r) => r.direction === "OUTGOING")).toEqual(
            [],
        );
    });

    it("moving to the world keeps dependants working and switches OWNING_ACTOR", () => {
        const owner = item({
            id: "o",
            name: "Owned",
            milestones: [
                milestone({
                    actions: [
                        {
                            id: "g",
                            kind: "GRANT_ITEM",
                            sourceUuid: "Item.x",
                            quantity: 1,
                            recipient: { type: "OWNING_ACTOR" },
                        },
                    ],
                }),
            ],
        });
        const p = plan({
            dest: WORLD,
            sourceItems: [...store(), owner],
            itemIds: ["a", "o"],
        });
        expect(p.references.some((r) => r.direction === "INCOMING")).toBe(
            false,
        );
        expect(p.recipients).toHaveLength(1);
        const grant = p.result.create.find((i) => i.id === "o")!.milestones[0]!
            .actions[0]!;
        expect(grant).toMatchObject({
            recipient: { type: "TRIGGERING_ACTOR" },
        });

        const kept = plan(
            { dest: WORLD, sourceItems: [owner], itemIds: ["o"] },
            { recipients: { "o:recipient:g": "KEEP" } },
        );
        expect(kept.result.create[0]!.milestones[0]!.actions[0]).toMatchObject({
            recipient: { type: "OWNING_ACTOR" },
        });
    });

    it("maps categories by name, creating once or leaving uncategorised", () => {
        const existing = plan({
            destCategories: [{ id: "x", name: "Crafting", description: "" }],
            itemIds: ["b"],
            sourceItems: store().map((i) => ({ ...i, categoryId: "cat1" })),
        });
        expect(existing.result.create.every((i) => i.categoryId === "x")).toBe(
            true,
        );
        expect(existing.result.destCategories).toBeNull();

        const created = plan();
        expect(created.categories).toEqual([
            { name: "Crafting", choice: "CREATE" },
        ]);
        expect(created.result.destCategories).toEqual([cat]);

        const none = plan({}, { categories: { Crafting: "UNCATEGORISED" } });
        expect(
            none.result.create.find((i) => i.id === "a")!.categoryId,
        ).toBeNull();
        expect(none.result.destCategories).toBeNull();
    });
});

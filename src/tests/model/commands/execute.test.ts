import { describe, expect, it } from "vite-plus/test";
import { text } from "../../helpers/i18n";
import { deriveState } from "../../../model/rules/derive";
import { band, item, milestone, skillMethod } from "../../helpers/fixtures";
import {
    gmUser,
    memoryEnv,
    otherPlayer,
    player,
} from "../../helpers/memoryEnv";
import { MemoryBackend } from "../../helpers/MemoryBackend";
import type {
    FixedMethodData,
    MethodEventData,
    MilestoneEventData,
    StoreRef,
    TrackedItemData,
} from "../../../types/data";
import { WORLD_STORE } from "../../../model/storage/stores";
import { executeCommand } from "../../../model/commands/execute";
import type {
    ClientRoll,
    Command,
    CommandResult,
    UseMethodCommand,
} from "../../../types/commands";

const ALICE = "Actor.alice";
const aliceStore: StoreRef = { kind: "ACTOR", actorUuid: ALICE };

const actors = {
    [ALICE]: {
        name: "Alice",
        owners: ["user-a"],
        view: {
            skills: { ath: { proficiency: 1, total: 5 } },
            abilities: { str: { score: 16, mod: 3 } },
            toolProficiencies: new Set<string>(),
            items: [],
        },
    },
    "Actor.bob": { name: "Bob", owners: ["user-b"] },
};

const roll = (
    total: number,
    natural = 10,
    activityDc: number | null = null,
): ClientRoll => ({
    formula: "1d20 + 5",
    total,
    natural,
    activityDc,
    rolled: { kind: "SKILL", key: "ath", label: "Athletics" },
    rollMode: "publicroll",
    messageId: null,
});

function setup(
    items: TrackedItemData[],
    store: StoreRef = aliceStore,
    extraStores: [StoreRef, TrackedItemData[]][] = [],
) {
    const backend = new MemoryBackend().seed(store, items);
    for (const [ref, storeItems] of extraStores) backend.seed(ref, storeItems);
    if (
        store.kind !== "WORLD" &&
        !extraStores.some(([ref]) => ref.kind === "WORLD")
    )
        backend.seed(WORLD_STORE, []);
    const env = memoryEnv(backend, actors);
    const exec = (command: Command, user = player) =>
        executeCommand(command, user, env);
    const get = (id = "item1", ref = store) => backend.item(ref, id)!;
    return { backend, env, exec, get };
}

const use = (overrides: Partial<UseMethodCommand> = {}): Command => ({
    type: "USE_METHOD",
    store: aliceStore,
    itemId: "item1",
    methodId: "m1",
    actorUuid: ALICE,
    roll: roll(12),
    ...overrides,
});

function expectError(result: CommandResult, code: string) {
    expect(result.ok ? "ok" : result.error.code).toBe(code);
}

describe("USE_METHOD", () => {
    it("resolves the band, records the event and commits", async () => {
        const { exec, get, backend } = setup([
            item({ methods: [skillMethod()] }),
        ]);
        const result = await exec(use());
        expect(result.ok).toBe(true);

        const event = get().history[0] as MethodEventData;
        expect(event).toMatchObject({
            kind: "METHOD",
            methodId: "m1",
            band: { id: "pass", countsAs: "SUCCESS" },
            roll: { total: 12, dc: 10, dcSource: "METHOD" },
            progress: { requested: 1, applied: 1, before: 0, after: 1 },
            contributor: {
                actorUuid: ALICE,
                actorName: "Alice",
                userId: "user-a",
                userName: "Player A",
                userWasGM: false,
            },
        });
        expect(backend.commits).toHaveLength(1);
    });

    it("uses the activity's DC when the method has none", async () => {
        const { exec, get } = setup([
            item({ methods: [skillMethod({ dc: null })] }),
        ]);
        await exec(use({ roll: roll(14, 10, 15) }));
        expect((get().history[0] as MethodEventData).roll).toMatchObject({
            dc: 15,
            dcSource: "ACTIVITY",
        });
        expect((get().history[0] as MethodEventData).band!.id).toBe("fail");
    });

    it("evaluates FORMULA deltas from the roll", async () => {
        const method = skillMethod({
            results: {
                bands: [
                    {
                        ...band("scaled", 0),
                        effect: {
                            delta: {
                                kind: "FORMULA",
                                formula: "1 + floor(@margin / 5)",
                            },
                        },
                    },
                ],
            },
        });
        const { exec, get } = setup([
            item({
                methods: [method],
                progress: { target: 20, min: 0, max: 20 },
            }),
        ]);
        await exec(use({ roll: roll(21) }));
        expect((get().history[0] as MethodEventData).progress.applied).toBe(3);
    });

    it("rejects players who don't own the actor", async () => {
        const { exec } = setup([item({ methods: [skillMethod()] })]);
        expectError(await exec(use(), otherPlayer), "FORBIDDEN");
    });

    it("hides hidden methods and items from players but not GMs", async () => {
        const { exec } = setup([
            item({ methods: [skillMethod({ hidden: true })] }),
        ]);
        expectError(await exec(use()), "FORBIDDEN");
        expect((await exec(use(), gmUser)).ok).toBe(true);
    });

    it("refuses locked items", async () => {
        const { exec } = setup([
            item({ methods: [skillMethod()], history: [] }),
        ]);
        await exec(
            {
                type: "SET_STATE",
                store: aliceStore,
                itemId: "item1",
                locked: true,
            },
            gmUser,
        );
        expectError(await exec(use()), "LOCKED");
    });

    it("enforces requirements for players; GMs bypass", async () => {
        const method = skillMethod({
            requirements: [
                {
                    id: "r1",
                    whenUnmet: "DISABLE",
                    hint: null,
                    test: {
                        kind: "SKILL",
                        skill: "ath" as never,
                        min: "EXPERT",
                    },
                },
            ],
        });
        const { exec } = setup([item({ methods: [method] })]);
        expectError(await exec(use()), "UNAVAILABLE");
        expect((await exec(use(), gmUser)).ok).toBe(true);
    });

    it("applies usage tiers and limits", async () => {
        const fixed: FixedMethodData = {
            id: "m1",
            kind: "FIXED",
            name: "Study",
            description: "",
            img: null,
            hidden: false,
            requirements: [],
            effect: { delta: { kind: "STATIC", value: 2 } },
            countsAs: "SUCCESS",
            usage: {
                count: { kind: "ATTEMPTS" },
                per: "ACTOR",
                tiers: [
                    {
                        from: 1,
                        kind: "EFFECT",
                        effect: { delta: { kind: "STATIC", value: 1 } },
                    },
                    { from: 2, kind: "DISABLE", hint: "Come back tomorrow" },
                ],
            },
        };
        const { exec, get } = setup([item({ methods: [fixed] })]);
        await exec(use({ roll: null }));
        await exec(use({ roll: null }));
        const third = await exec(use({ roll: null }));
        expect(
            get().history.map((e) => (e as MethodEventData).progress.applied),
        ).toEqual([2, 1]);
        expect(third.ok ? null : third.error.message).toBe(
            "Come back tomorrow",
        );
    });

    it("requires a roll for check methods and an amount for manual ones", async () => {
        const manual = {
            id: "m2",
            kind: "MANUAL" as const,
            name: "Adjust",
            description: "",
            img: null,
            hidden: false,
            requirements: [],
            usage: null,
            gmOnly: false,
        };
        const { exec, get } = setup([
            item({ methods: [skillMethod(), manual] }),
        ]);
        expectError(await exec(use({ roll: null })), "INVALID");
        expectError(await exec(use({ methodId: "m2", roll: null })), "INVALID");
        expect(
            (await exec(use({ methodId: "m2", roll: null, amount: 3 }))).ok,
        ).toBe(true);
        expect(deriveState(get()).value).toBe(3);
    });

    it("rejects malformed commands", async () => {
        const { exec } = setup([item()]);
        expectError(await exec({ type: "USE_METHOD" } as never), "INVALID");
        expectError(
            await exec({ type: "NOPE", store: aliceStore } as never),
            "INVALID",
        );
    });
});

describe("milestones", () => {
    const grant = (selection?: "GM_PICKS") =>
        milestone({
            at: 1,
            actions: [
                { id: "done", kind: "COMPLETE" },
                {
                    id: "reward",
                    kind: "GRANT_ITEM",
                    sourceUuid: "Compendium.items.Item.trophy",
                    quantity: 1,
                    recipient: selection
                        ? {
                              type: "ACTOR",
                              actorUuids: [ALICE, "Actor.bob"],
                              selection,
                          }
                        : { type: "TRIGGERING_ACTOR" },
                },
            ],
        });

    it("fires actions immediately with AUTO approval", async () => {
        const { exec, get, env } = setup([
            item({ methods: [skillMethod()], milestones: [grant()] }),
        ]);
        await exec(use());
        const fired = get().history[1] as MilestoneEventData;
        expect(fired.kind).toBe("MILESTONE");
        expect(fired.actions.map((a) => a.status)).toEqual([
            "APPLIED",
            "APPLIED",
        ]);
        expect(fired.actions[1]!.createdUuids).toEqual([
            `${ALICE}.Item.granted1`,
        ]);
        expect(env.calls.map((c) => c.kind)).toEqual(["grantItem"]);
        expect(deriveState(get()).completed).toBe(true);
    });

    it("defers gated actions for players when approval is GM, then applies on approval", async () => {
        const { exec, get, env } = setup([
            item({ methods: [skillMethod()], milestones: [grant()] }),
        ]);
        env.approval = "GM";
        await exec(use());
        const fired = get().history[1] as MilestoneEventData;
        // COMPLETE is never gated; the grant waits.
        expect(fired.actions.map((a) => a.status)).toEqual([
            "APPLIED",
            "PENDING_APPROVAL",
        ]);
        expect(env.calls).toEqual([]);
        expect(deriveState(get()).pendingApprovals).toHaveLength(1);

        expectError(
            await exec({
                type: "RESOLVE_APPROVAL",
                store: aliceStore,
                itemId: "item1",
                milestoneEventId: fired.id,
                actionId: "reward",
                approved: true,
            }),
            "FORBIDDEN",
        );
        const resolved = await exec(
            {
                type: "RESOLVE_APPROVAL",
                store: aliceStore,
                itemId: "item1",
                milestoneEventId: fired.id,
                actionId: "reward",
                approved: true,
            },
            gmUser,
        );
        expect(resolved.ok).toBe(true);
        expect(get().history[2]).toMatchObject({
            kind: "APPROVAL",
            result: {
                status: "APPLIED",
                createdUuids: [`${ALICE}.Item.granted1`],
            },
        });
        expect(deriveState(get()).pendingApprovals).toEqual([]);
    });

    it("a GM triggering a gated action counts as approval", async () => {
        const { exec, get, env } = setup([
            item({ methods: [skillMethod()], milestones: [grant()] }),
        ]);
        env.approval = "GM";
        await exec(use(), gmUser);
        expect(
            (get().history[1] as MilestoneEventData).actions[1]!.status,
        ).toBe("APPLIED");
    });

    it("GM_PICKS always waits, and only grants to picked actors from the list", async () => {
        const { exec, get, env } = setup([
            item({ methods: [skillMethod()], milestones: [grant("GM_PICKS")] }),
        ]);
        await exec(use(), gmUser);
        const fired = get().history[1] as MilestoneEventData;
        expect(fired.actions[1]!.status).toBe("PENDING_APPROVAL");

        const resolve = (recipientUuids: string[]) =>
            exec(
                {
                    type: "RESOLVE_APPROVAL",
                    store: aliceStore,
                    itemId: "item1",
                    milestoneEventId: fired.id,
                    actionId: "reward",
                    approved: true,
                    recipientUuids,
                },
                gmUser,
            );
        expectError(await resolve(["Actor.stranger"]), "INVALID");
        await resolve(["Actor.bob", "Actor.stranger"]);
        expect(env.calls.map((c) => c.args[2])).toEqual(["Actor.bob"]);
    });

    it("rejected actions are recorded and never run", async () => {
        const { exec, get, env } = setup([
            item({ methods: [skillMethod()], milestones: [grant()] }),
        ]);
        env.approval = "GM";
        await exec(use());
        const fired = get().history[1] as MilestoneEventData;
        await exec(
            {
                type: "RESOLVE_APPROVAL",
                store: aliceStore,
                itemId: "item1",
                milestoneEventId: fired.id,
                actionId: "reward",
                approved: false,
            },
            gmUser,
        );
        expect(get().history[2]).toMatchObject({
            kind: "APPROVAL",
            approved: false,
            result: { status: "REJECTED" },
        });
        expect(env.calls).toEqual([]);
    });

    it("records failures without failing the command", async () => {
        const failing = milestone({
            at: 1,
            actions: [
                {
                    id: "reward",
                    kind: "GRANT_ITEM",
                    sourceUuid: "x",
                    quantity: 1,
                    recipient: { type: "OWNING_ACTOR" },
                },
            ],
        });
        const { exec, get } = setup(
            [item({ methods: [skillMethod()], milestones: [failing] })],
            WORLD_STORE,
        );
        const result = await exec(use({ store: WORLD_STORE }));
        expect(result.ok).toBe(true);
        const action = (
            get("item1", WORLD_STORE).history[1] as MilestoneEventData
        ).actions[0]!;
        expect(action.status).toBe("FAILED");
        // Kept as a key, so it reads in each viewer's language.
        expect(action.message).toEqual({
            key: "downtime-dnd5e.Error.WorldNoOwner",
        });
        expect(text(action.message)).toBe("World items have no owning actor");
    });

    it("chains ADJUST_PROGRESS into another item, firing its milestones, and stops loops", async () => {
        const source = item({
            methods: [skillMethod()],
            milestones: [
                milestone({
                    at: 1,
                    actions: [
                        {
                            id: "adj",
                            kind: "ADJUST_PROGRESS",
                            ref: { kind: "ITEM", id: "rep" },
                            delta: 2,
                        },
                    ],
                }),
            ],
        });
        const reputation = item({
            id: "rep",
            milestones: [
                milestone({
                    at: 2,
                    actions: [
                        {
                            id: "back",
                            kind: "ADJUST_PROGRESS",
                            ref: { kind: "ITEM", id: "item1" },
                            delta: 1,
                        },
                    ],
                }),
            ],
        });
        const { exec, get } = setup([source], aliceStore, [
            [WORLD_STORE, [reputation]],
        ]);
        await exec(use());

        const rep = get("rep", WORLD_STORE);
        expect(deriveState(rep).value).toBe(2);
        const back = (rep.history[1] as MilestoneEventData).actions[0]!;
        expect(back).toMatchObject({ status: "FAILED" });
        expect(text(back.message)).toMatch(/loop/);
        expect(
            (get().history[1] as MilestoneEventData).actions[0]!.adjustedEvent,
        ).toEqual({
            store: WORLD_STORE,
            itemId: "rep",
            eventId: rep.history[0]!.id,
        });
    });

    it("ADD_TRACKED_ITEM creates the next item", async () => {
        const next = item({ id: "ignored", name: "Advanced training" });
        const {
            id: _id,
            history: _h,
            quarantine: _q,
            schemaVersion: _s,
            ...template
        } = next;
        const ms = milestone({
            at: 1,
            actions: [
                {
                    id: "add",
                    kind: "ADD_TRACKED_ITEM",
                    template,
                    store: "WORLD",
                    recipient: null,
                },
            ],
        });
        const { exec, backend, get } = setup([
            item({ methods: [skillMethod()], milestones: [ms] }),
        ]);
        await exec(use());
        const created = (get().history[1] as MilestoneEventData).actions[0]!
            .createdItems[0]!;
        expect(created.store).toEqual(WORLD_STORE);
        expect(backend.item(WORLD_STORE, created.itemId)?.name).toBe(
            "Advanced training",
        );
    });
});

describe("REVERT_LATEST", () => {
    const rewarding = milestone({
        at: 1,
        actions: [
            { id: "done", kind: "COMPLETE" },
            {
                id: "reward",
                kind: "GRANT_ITEM",
                sourceUuid: "x",
                quantity: 1,
                recipient: { type: "TRIGGERING_ACTOR" },
            },
        ],
    });

    it("pops the latest event, its milestone and granted documents", async () => {
        const { exec, get, env } = setup([
            item({ methods: [skillMethod()], milestones: [rewarding] }),
        ]);
        await exec(use());
        expect(
            (
                await exec(
                    {
                        type: "REVERT_LATEST",
                        store: aliceStore,
                        itemId: "item1",
                    },
                    gmUser,
                )
            ).ok,
        ).toBe(true);
        expect(deriveState(get())).toMatchObject({
            value: 0,
            completed: false,
        });
        expect(env.calls.at(-1)).toEqual({
            kind: "deleteDocuments",
            args: [[`${ALICE}.Item.granted1`]],
        });
        expect(get().history.at(-1)).toMatchObject({ kind: "REVERT" });
    });

    it("is GM-only and needs something to revert", async () => {
        const { exec } = setup([item()]);
        expectError(
            await exec({
                type: "REVERT_LATEST",
                store: aliceStore,
                itemId: "item1",
            }),
            "FORBIDDEN",
        );
        expectError(
            await exec(
                { type: "REVERT_LATEST", store: aliceStore, itemId: "item1" },
                gmUser,
            ),
            "INVALID",
        );
    });

    it("is blocked by macros without an undo macro", async () => {
        const macro = milestone({
            at: 1,
            actions: [
                {
                    id: "m",
                    kind: "MACRO",
                    macroUuid: "Macro.a",
                    undoMacroUuid: null,
                },
            ],
        });
        const { exec, get } = setup([
            item({ methods: [skillMethod()], milestones: [macro] }),
        ]);
        await exec(use());
        const result = await exec(
            { type: "REVERT_LATEST", store: aliceStore, itemId: "item1" },
            gmUser,
        );
        expectError(result, "BLOCKED");
        expect(deriveState(get()).value).toBe(1);
    });

    it("cascades into chained adjustments", async () => {
        const source = item({
            methods: [skillMethod()],
            milestones: [
                milestone({
                    at: 1,
                    actions: [
                        {
                            id: "adj",
                            kind: "ADJUST_PROGRESS",
                            ref: { kind: "ITEM", id: "rep" },
                            delta: 2,
                        },
                    ],
                }),
            ],
        });
        const { exec, get } = setup([source], aliceStore, [
            [WORLD_STORE, [item({ id: "rep" })]],
        ]);
        await exec(use());
        await exec(
            { type: "REVERT_LATEST", store: aliceStore, itemId: "item1" },
            gmUser,
        );
        expect(deriveState(get("rep", WORLD_STORE)).value).toBe(0);
        expect(deriveState(get()).value).toBe(0);
    });
});

describe("GM commands", () => {
    it("ADJUST and SET (clamped) fire milestones", async () => {
        const { exec, get } = setup([
            item({ milestones: [milestone({ at: 10 })] }),
        ]);
        expectError(
            await exec({
                type: "ADJUST",
                store: aliceStore,
                itemId: "item1",
                delta: 1,
            }),
            "FORBIDDEN",
        );
        await exec(
            { type: "SET", store: aliceStore, itemId: "item1", value: 50 },
            gmUser,
        );
        const state = deriveState(get());
        expect(state.value).toBe(10);
        expect(state.completed).toBe(true);
    });

    it("lets owners set their own actor's progress through the API only", async () => {
        const { exec, get } = setup([item()]);
        const set = (reason: "API" | "MANUAL", user = player) =>
            exec(
                {
                    type: "SET",
                    store: aliceStore,
                    itemId: "item1",
                    value: 4,
                    reason,
                },
                user,
            );
        expectError(await set("MANUAL"), "FORBIDDEN");
        expectError(await set("API", otherPlayer), "FORBIDDEN");
        expect((await set("API")).ok).toBe(true);
        expect(deriveState(get()).value).toBe(4);
    });

    it("dismisses events and edits notes", async () => {
        const { exec, get } = setup([item()]);
        const adjusted = await exec(
            { type: "ADJUST", store: aliceStore, itemId: "item1", delta: 1 },
            gmUser,
        );
        const eventId = adjusted.ok ? adjusted.eventIds[0]! : "";
        await exec(
            {
                type: "SET_DISMISSED",
                store: aliceStore,
                itemId: "item1",
                eventIds: [eventId],
                dismissed: true,
            },
            gmUser,
        );
        await exec(
            {
                type: "SET_NOTE",
                store: aliceStore,
                itemId: "item1",
                eventId,
                note: "Bonus for roleplay",
            },
            gmUser,
        );
        expect(get().history[0]).toMatchObject({
            dismissed: true,
            note: "Bonus for roleplay",
        });
    });

    it("creates, updates (validated), reorders and deletes items", async () => {
        const { exec, backend } = setup([item()]);
        const created = await exec(
            {
                type: "CREATE_ITEM",
                store: aliceStore,
                data: { name: "New", progress: { target: 5, min: 0, max: 5 } },
            },
            gmUser,
        );
        const newId = created.ok ? created.itemId! : "";
        expect(backend.item(aliceStore, newId)?.name).toBe("New");

        expectError(
            await exec(
                {
                    type: "CREATE_ITEM",
                    store: aliceStore,
                    data: { methods: [{ kind: "SKILL" }] },
                },
                gmUser,
            ),
            "INVALID",
        );
        expectError(
            await exec(
                {
                    type: "UPDATE_ITEM",
                    store: aliceStore,
                    itemId: newId,
                    changes: { methods: [{ kind: "NOPE" } as never] },
                },
                gmUser,
            ),
            "INVALID",
        );
        await exec(
            {
                type: "UPDATE_ITEM",
                store: aliceStore,
                itemId: newId,
                changes: { name: "Renamed" },
            },
            gmUser,
        );
        expect(backend.item(aliceStore, newId)?.name).toBe("Renamed");

        await exec(
            {
                type: "REORDER_ITEMS",
                store: aliceStore,
                order: [newId, "item1", "unknown"],
            },
            gmUser,
        );
        expect(backend.stores.get(`actor:${ALICE}`)!.order).toEqual([
            newId,
            "item1",
        ]);

        await exec(
            { type: "DELETE_ITEM", store: aliceStore, itemId: newId },
            gmUser,
        );
        expect(backend.item(aliceStore, newId)).toBeUndefined();
        expect(backend.stores.get(`actor:${ALICE}`)!.order).toEqual(["item1"]);
    });

    it("sets categories", async () => {
        const { exec, backend } = setup([item()]);
        await exec(
            {
                type: "SET_CATEGORIES",
                store: aliceStore,
                categories: [{ id: "c1", name: "Crafting", description: "" }],
            },
            gmUser,
        );
        expect(backend.stores.get(`actor:${ALICE}`)!.categories).toEqual([
            { id: "c1", name: "Crafting", description: "" },
        ]);
    });

    it("does not commit anything when a command fails", async () => {
        const { exec, backend } = setup([item({ methods: [skillMethod()] })]);
        await exec(use(), otherPlayer);
        expect(backend.commits).toEqual([]);
    });
});

describe("repeating milestones and item requirements", () => {
    const fixed: FixedMethodData = {
        id: "m1",
        kind: "FIXED",
        name: "Work an hour",
        description: "",
        img: null,
        hidden: false,
        requirements: [],
        usage: null,
        effect: { delta: { kind: "STATIC", value: 1 } },
        countsAs: "SUCCESS",
    };
    const manual = {
        id: "m2",
        kind: "MANUAL" as const,
        name: "Log hours",
        description: "",
        img: null,
        hidden: false,
        requirements: [],
        usage: null,
        gmOnly: false,
    };
    const batch = milestone({
        id: "batch",
        at: 8,
        match: "EVERY",
        maxTimes: null,
        actions: [
            {
                id: "arrows",
                kind: "GRANT_ITEM",
                sourceUuid: "Compendium.items.Item.arrows",
                quantity: 1,
                recipient: { type: "TRIGGERING_ACTOR" },
            },
        ],
    });
    const repeating = () =>
        item({
            progress: { target: null, min: 0, max: null },
            methods: [fixed, manual],
            milestones: [batch],
        });

    it("fires one milestone event (and grant) per batch, carrying the remainder", async () => {
        const { exec, get, env } = setup([repeating()]);
        await exec(use({ methodId: "m2", roll: null, amount: 20 }));
        const fired = get().history.filter((e) => e.kind === "MILESTONE");
        expect(fired).toHaveLength(2);
        expect(env.calls.filter((c) => c.kind === "grantItem")).toHaveLength(2);
        const state = deriveState(get());
        expect(state.value).toBe(20);
        expect(state.milestoneFires.batch).toBe(2);

        await exec(use({ methodId: "m2", roll: null, amount: 4 }));
        expect(deriveState(get()).milestoneFires.batch).toBe(3);
    });

    it("reverting removes every batch the change made", async () => {
        const { exec, get, env } = setup([repeating()]);
        await exec(use({ methodId: "m2", roll: null, amount: 17 }));
        await exec(
            { type: "REVERT_LATEST", store: aliceStore, itemId: "item1" },
            gmUser,
        );
        expect(deriveState(get())).toMatchObject({
            value: 0,
            milestoneFires: {},
        });
        expect(
            env.calls.filter((c) => c.kind === "deleteDocuments"),
        ).toHaveLength(2);
    });

    it("enforces item-level requirements for players; GMs bypass", async () => {
        const gated = item({
            methods: [fixed],
            requirements: [
                {
                    id: "r1",
                    whenUnmet: "HIDE",
                    hint: null,
                    test: { kind: "TOOL_PROFICIENCY", tool: "woodcarver" },
                },
            ],
        });
        const { exec } = setup([gated]);
        expectError(await exec(use({ roll: null })), "UNAVAILABLE");
        expect((await exec(use({ roll: null }), gmUser)).ok).toBe(true);
    });
});

describe("TRANSFER", () => {
    const bobStore: StoreRef = { kind: "ACTOR", actorUuid: "Actor.bob" };
    const linked = () => [
        item({
            id: "a",
            name: "A",
            requirements: [
                {
                    id: "r",
                    whenUnmet: "HIDE",
                    hint: null,
                    test: {
                        kind: "PROGRESS",
                        ref: { kind: "ITEM", id: "b" },
                        op: "gte",
                        value: 1,
                    },
                },
            ],
        }),
        item({ id: "b", name: "B" }),
    ];

    it("is GM only", async () => {
        const { exec } = setup(linked(), aliceStore, [[bobStore, []]]);
        const result = await exec({
            type: "TRANSFER",
            store: aliceStore,
            dest: bobStore,
            mode: "COPY",
            itemIds: ["a"],
            choices: {},
        });
        expect(result).toMatchObject({
            ok: false,
            error: { code: "FORBIDDEN" },
        });
    });

    it("moves a linked set to another actor in one write", async () => {
        const { exec, backend } = setup(linked(), aliceStore, [[bobStore, []]]);
        const result = await exec(
            {
                type: "TRANSFER",
                store: aliceStore,
                dest: bobStore,
                mode: "MOVE",
                itemIds: ["a"],
                choices: {},
            },
            gmUser,
        );
        expect(result).toMatchObject({
            ok: true,
            transferred: { a: "a", b: "b" },
        });
        expect(backend.stores.get("actor:Actor.alice")!.items).toEqual([]);
        expect(
            backend.stores.get("actor:Actor.bob")!.items.map((i) => i.id),
        ).toEqual(["a", "b"]);
    });

    it("copies to the world, keeping the source", async () => {
        const { exec, backend } = setup(linked());
        const result = await exec(
            {
                type: "TRANSFER",
                store: aliceStore,
                dest: WORLD_STORE,
                mode: "COPY",
                itemIds: ["a"],
                choices: { references: { "a:req:r": "REMOVE" } },
            },
            gmUser,
        );
        expect(result.ok).toBe(true);
        expect(backend.stores.get("actor:Actor.alice")!.items).toHaveLength(2);
        const world = backend.stores.get("world")!.items;
        expect(world.map((i) => [i.id, i.requirements.length])).toEqual([
            ["a", 0],
        ]);
    });

    it("refuses a move to the same store", async () => {
        const { exec } = setup(linked());
        const result = await exec(
            {
                type: "TRANSFER",
                store: aliceStore,
                dest: aliceStore,
                mode: "MOVE",
                itemIds: ["a"],
                choices: {},
            },
            gmUser,
        );
        expect(result).toMatchObject({ ok: false, error: { code: "INVALID" } });
    });
});

describe("MOVE_METHOD", () => {
    it("moves a method to another item in another store", async () => {
        const bob: StoreRef = { kind: "ACTOR", actorUuid: "Actor.bob" };
        const { exec, backend } = setup(
            [
                item({
                    methods: [
                        skillMethod({ id: "m1" }),
                        skillMethod({ id: "m2" }),
                    ],
                }),
            ],
            aliceStore,
            [[bob, [item({ id: "target", methods: [] })]]],
        );
        const result = await exec(
            {
                type: "MOVE_METHOD",
                store: aliceStore,
                itemId: "item1",
                methodId: "m2",
                dest: bob,
                destItemId: "target",
                index: 0,
                copy: false,
            },
            gmUser,
        );
        expect(result.ok).toBe(true);
        expect(
            backend.item(aliceStore, "item1")!.methods.map((m) => m.id),
        ).toEqual(["m1"]);
        expect(backend.item(bob, "target")!.methods.map((m) => m.id)).toEqual([
            "m2",
        ]);
    });
});

describe("read-only stores", () => {
    it("refuses changes before anything is written (e.g. a locked compendium)", async () => {
        const backend = new MemoryBackend()
            .seed(aliceStore, [item()], {
                readOnly: {
                    key: "downtime-dnd5e.Error.LockedCompendium",
                    vars: { actor: "Alice" },
                },
            })
            .seed(WORLD_STORE, []);
        const result = await executeCommand(
            { type: "ADJUST", store: aliceStore, itemId: "item1", delta: 1 },
            gmUser,
            memoryEnv(backend, actors),
        );
        expectError(result, "LOCKED");
        expect(backend.commits).toEqual([]);
    });
});

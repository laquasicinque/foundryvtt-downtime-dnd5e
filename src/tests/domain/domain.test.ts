import { t } from "../helpers/i18n";
import { describe, expect, it } from "vite-plus/test";
import { executeCommand } from "../../model/commands/execute";
import type { CommandUser } from "../../types/commands";
import { item, milestone, skillMethod } from "../helpers/fixtures";
import { memoryEnv, player, type FakeActor } from "../helpers/memoryEnv";
import { MemoryBackend } from "../helpers/MemoryBackend";
import type {
    FixedMethodData,
    StoreRef,
    TrackedItemData,
} from "../../types/data";
import { storeKey } from "../../model/storage/stores";
import type { DomainContext } from "../../domain/context";
import { DowntimeError } from "../../domain/DowntimeError";
import { MethodEvent, MilestoneEvent } from "../../domain/HistoryEvent";
import { FixedMethod, SkillMethod } from "../../domain/Method";
import { TrackedItem } from "../../domain/TrackedItem";

const ALICE = "Actor.alice";
const store: StoreRef = { kind: "ACTOR", actorUuid: ALICE };

const fixed: FixedMethodData = {
    id: "m2",
    kind: "FIXED",
    name: "Study",
    description: "",
    img: null,
    hidden: false,
    requirements: [],
    usage: {
        count: { kind: "ATTEMPTS" },
        per: "ACTOR",
        tiers: [{ from: 2, kind: "DISABLE", hint: null }],
    },
    effect: { delta: { kind: "STATIC", value: 1 } },
    countsAs: "SUCCESS",
};

function setup(data: TrackedItemData, user: CommandUser = player) {
    const backend = new MemoryBackend()
        .seed(store, [data])
        .seed({ kind: "WORLD" }, []);
    const actors: Record<string, FakeActor> = {
        [ALICE]: {
            name: "Alice",
            owners: [player.id],
            view: {
                skills: { ath: { proficiency: 1, total: 5 } },
                abilities: {},
                toolProficiencies: new Set(),
                items: [],
            },
        },
    };
    const env = memoryEnv(backend, actors);
    const ctx: DomainContext = {
        dispatch: (command) => executeCommand(command, user, env),
        load: async (ref, id) => {
            const found = backend.item(ref, id);
            return found ? new TrackedItem(found, ref, ctx) : null;
        },
        storeTrackedItems: (ref) =>
            backend.stores.get(storeKey(ref))?.items ?? null,
        actorView: (uuid) => actors[uuid]?.view ?? null,
        names: {
            actorName: (uuid) => actors[uuid]?.name ?? null,
            userName: () => null,
            unknown: () => "Unknown",
        },
        currentUser: () => user,
        t,
    };
    return { backend, tracked: new TrackedItem(data, store, ctx) };
}

const roll = (total: number) => ({
    formula: "1d20+5",
    total,
    natural: total - 5,
    activityDc: null,
    rolled: { kind: "SKILL" as const, key: "ath", label: "Athletics" },
    rollMode: "publicroll",
    messageId: null,
});

describe("TrackedItem", () => {
    const data = item({
        methods: [skillMethod(), fixed],
        milestones: [milestone({ at: 2 })],
    });

    it("is read-only and isolated from the source data", () => {
        const source = structuredClone(data);
        const { tracked } = setup(source);
        expect(Object.isFrozen(tracked.data)).toBe(true);
        expect(Object.isFrozen(tracked.data.methods[0])).toBe(true);
        expect(() => {
            (tracked.data as TrackedItemData).name = "x";
        }).toThrow();
        source.name = "changed later";
        expect(tracked.name).toBe("Train Smith's Tools");
    });

    it("caches derived values per instance", () => {
        const { tracked } = setup(data);
        expect(tracked.state).toBe(tracked.state);
        expect(tracked.methods).toBe(tracked.methods);
    });

    it("wraps methods in per-kind subclasses", () => {
        const { tracked } = setup(data);
        expect(tracked.methods[0]).toBeInstanceOf(SkillMethod);
        expect(tracked.methods[1]).toBeInstanceOf(FixedMethod);
        expect((tracked.methods[0] as SkillMethod).skill).toBe("ath");
    });

    it("toJSON returns a mutable copy", () => {
        const { tracked } = setup(data);
        const copy = tracked.toJSON();
        copy.name = "edited";
        expect(tracked.name).toBe("Train Smith's Tools");
    });

    it("use() goes through the command pipeline and resolves to a new instance", async () => {
        const { tracked } = setup(data);
        const after = await tracked.method("m1")!.use({ roll: roll(12) });
        expect(after).not.toBe(tracked);
        expect(tracked.value).toBe(0);
        expect(after.value).toBe(1);
        expect(after.history[0]).toBeInstanceOf(MethodEvent);
        expect(after.history[0]!.contributorName).toBe("Alice");
    });

    it("exposes milestone fires and milestone events with current results", async () => {
        const { tracked } = setup(data);
        let current = await tracked.method("m1")!.use({ roll: roll(12) });
        current = await current.method("m1")!.use({ roll: roll(12) });
        expect(current.milestone("ms1")).toMatchObject({
            fires: 1,
            remaining: 0,
            reached: true,
        });
        expect(current.completed).toBe(true);
        const fired = current.history.find(
            (e) => e instanceof MilestoneEvent,
        ) as MilestoneEvent;
        expect(fired.actions[0]!.status).toBe("APPLIED");
        expect(fired.cause?.id).toBe(current.history[1]!.id);
    });

    it("reports usage and availability", async () => {
        const { tracked } = setup(data);
        const study = tracked.method("m2")!;
        expect(study.usageFor()).toMatchObject({ count: 0, index: null });
        const after = await (await study.use()).method("m2")!.use();
        expect(after.method("m2")!.usageFor()).toMatchObject({
            count: 2,
            tier: { kind: "DISABLE" },
        });
        expect(after.method("m1")!.availability().state).toBe("AVAILABLE");
    });

    it("throws DowntimeError when the GM rejects a write", async () => {
        const { tracked } = setup(data);
        await expect(tracked.adjust(1)).rejects.toBeInstanceOf(DowntimeError);
        await expect(tracked.adjust(1)).rejects.toMatchObject({
            code: "FORBIDDEN",
        });
    });

    it("plans reverts for display", async () => {
        const { tracked } = setup(data);
        const after = await tracked.method("m1")!.use({ roll: roll(12) });
        const plan = await after.planRevert();
        expect(plan?.target.id).toBe(after.history[0]!.id);
        expect(plan?.blockers).toEqual([]);
    });

    it("projects to the V1 shape", async () => {
        const { tracked } = setup(data);
        const after = await tracked.method("m1")!.use({ roll: roll(12) });
        expect(after.toV1()).toMatchObject({
            id: "item1",
            category: "",
            progress: 1,
            completionAt: 10,
            progressionStyle: "SKILL",
            skill: "ath",
            dc: 10,
            changes: [
                {
                    oldValue: 0,
                    newValue: 1,
                    actionName: "Practice",
                    // V1 recorded the user's name.
                    user: "Player A",
                },
            ],
        });
    });
});

describe("requirement hints", () => {
    it("falls back to a description when DISABLE_WITH_HINT has no hint", () => {
        const { tracked } = setup(
            item({
                requirements: [
                    {
                        id: "r1",
                        whenUnmet: "DISABLE_WITH_HINT",
                        hint: null,
                        test: { kind: "TOOL_PROFICIENCY", tool: "smith" },
                    },
                ],
                methods: [skillMethod()],
            }),
        );
        const availability = tracked.methods[0]!.availability(ALICE);
        expect(availability).toMatchObject({
            state: "DISABLE_WITH_HINT",
            hints: ["Requires proficiency with smith"],
        });
    });
});

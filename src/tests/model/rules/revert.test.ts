import { describe, expect, it } from "vite-plus/test";
import { deriveState } from "../../../model/rules/derive";
import {
    canRevert,
    hasOwnHistory,
    latestProgressEvent,
    planRevert,
    revertEventFor,
} from "../../../model/rules/revert";
import type { RevertContext } from "../../../types/revert";
import { gm, item, milestone } from "../../helpers/fixtures";
import { HistoryBuilder } from "../../helpers/HistoryBuilder";
import { WORLD_STORE } from "../../../model/storage/stores";

const ctx: RevertContext = {
    trackedItemHasHistory: async () => false,
    checkAdjustment: async () => ({ ok: true }),
};

describe("revert stack", () => {
    it("targets the latest non-reverted progress event", async () => {
        const builder = new HistoryBuilder()
            .method("e1", 2)
            .method("e2", 3)
            .milestone("ms-e2", "ms1", "e2");
        expect(latestProgressEvent(item({ history: builder.events }))?.id).toBe(
            "e2",
        );
        builder.revert("r1", "e2", ["ms-e2"]);
        expect(latestProgressEvent(item({ history: builder.events }))?.id).toBe(
            "e1",
        );
        builder.revert("r2", "e1");
        expect(
            latestProgressEvent(item({ history: builder.events })),
        ).toBeNull();
    });

    it("returns null when there is nothing to revert", async () => {
        expect(await planRevert(item(), ctx)).toBeNull();
    });
});

describe("planRevert", () => {
    it("reverts milestones caused by the target when revertWithCause", async () => {
        const history = new HistoryBuilder()
            .method("e1", 10)
            .milestone("ms-e1", "ms1", "e1", [
                { actionId: "a-complete" },
            ]).events;
        const tracked = item({ history, milestones: [milestone()] });
        const plan = (await planRevert(tracked, ctx))!;
        expect(plan.revertedMilestoneEventIds).toEqual(["ms-e1"]);
        expect(plan.undo).toEqual([
            {
                kind: "DERIVED",
                milestoneEventId: "ms-e1",
                actionId: "a-complete",
            },
        ]);
        expect(canRevert(plan)).toBe(true);

        const reverted = item({
            ...tracked,
            history: [
                ...history,
                revertEventFor(plan, {
                    id: "r1",
                    seq: 2,
                    timestamp: 0,
                    contributor: gm,
                }),
            ],
        });
        expect(deriveState(reverted)).toMatchObject({
            value: 0,
            completed: false,
        });
    });

    it("keeps milestones without revertWithCause, or whose definition was deleted", async () => {
        const history = new HistoryBuilder()
            .method("e1", 10)
            .milestone("ms-a", "keep", "e1")
            .milestone("ms-b", "deleted", "e1").events;
        const plan = (await planRevert(
            item({
                history,
                milestones: [milestone({ id: "keep", revertWithCause: false })],
            }),
            ctx,
        ))!;
        expect(plan.keptMilestoneEventIds).toEqual(["ms-a", "ms-b"]);
        expect(plan.revertedMilestoneEventIds).toEqual([]);
    });

    it("blocks on macros without an undo macro, and undoes those with one", async () => {
        const history = new HistoryBuilder()
            .method("e1", 10)
            .milestone("ms-e1", "ms1", "e1", [
                { actionId: "no-undo", kind: "MACRO" },
                { actionId: "with-undo", kind: "MACRO" },
            ]).events;
        const tracked = item({
            history,
            milestones: [
                milestone({
                    actions: [
                        {
                            id: "no-undo",
                            kind: "MACRO",
                            macroUuid: "Macro.a",
                            undoMacroUuid: null,
                        },
                        {
                            id: "with-undo",
                            kind: "MACRO",
                            macroUuid: "Macro.b",
                            undoMacroUuid: "Macro.b-undo",
                        },
                    ],
                }),
            ],
        });
        const plan = (await planRevert(tracked, ctx))!;
        expect(canRevert(plan)).toBe(false);
        expect(plan.blockers).toEqual([
            {
                kind: "MACRO_WITHOUT_UNDO",
                milestoneEventId: "ms-e1",
                actionId: "no-undo",
            },
        ]);
        expect(plan.undo).toContainEqual({
            kind: "RUN_UNDO_MACRO",
            milestoneEventId: "ms-e1",
            actionId: "with-undo",
            macroUuid: "Macro.b-undo",
        });
    });

    it("deletes granted documents and never blocks on announcements", async () => {
        const history = new HistoryBuilder()
            .method("e1", 10)
            .milestone("ms-e1", "ms1", "e1", [
                {
                    actionId: "grant",
                    kind: "GRANT_ITEM",
                    createdUuids: ["Actor.a.Item.x"],
                },
                { actionId: "say", kind: "ANNOUNCE" },
            ]).events;
        const plan = (await planRevert(
            item({ history, milestones: [milestone()] }),
            ctx,
        ))!;
        expect(canRevert(plan)).toBe(true);
        expect(plan.undo.map((s) => s.kind)).toEqual([
            "DELETE_DOCUMENTS",
            "NONE",
        ]);
    });

    it("blocks when a created tracked item has its own history", async () => {
        const history = new HistoryBuilder()
            .method("e1", 10)
            .milestone("ms-e1", "ms1", "e1", [
                {
                    actionId: "add",
                    kind: "ADD_TRACKED_ITEM",
                    createdItems: [{ store: WORLD_STORE, itemId: "new1" }],
                },
            ]).events;
        const plan = (await planRevert(
            item({ history, milestones: [milestone()] }),
            {
                ...ctx,
                trackedItemHasHistory: async (loc) => loc.itemId === "new1",
            },
        ))!;
        expect(plan.blockers.map((b) => b.kind)).toEqual([
            "TRACKED_ITEM_HAS_HISTORY",
        ]);
    });

    it("blocks cascading adjustments that are no longer latest on their item", async () => {
        const history = new HistoryBuilder()
            .method("e1", 10)
            .milestone("ms-e1", "ms1", "e1", [
                {
                    actionId: "adj",
                    kind: "ADJUST_PROGRESS",
                    adjustedEvent: {
                        store: WORLD_STORE,
                        itemId: "other",
                        eventId: "x1",
                    },
                },
            ]).events;
        const plan = (await planRevert(
            item({ history, milestones: [milestone()] }),
            {
                ...ctx,
                checkAdjustment: async () => ({
                    ok: false,
                    notLatest: true,
                    reason: "newer events",
                }),
            },
        ))!;
        expect(plan.blockers).toEqual([
            {
                kind: "ADJUSTMENT_NOT_LATEST",
                milestoneEventId: "ms-e1",
                actionId: "adj",
                target: { store: WORLD_STORE, itemId: "other" },
                eventId: "x1",
            },
        ]);
    });

    it("has nothing to undo for pending or rejected actions", async () => {
        const history = new HistoryBuilder()
            .method("e1", 10)
            .milestone("ms-e1", "ms1", "e1", [
                { actionId: "p", kind: "MACRO", status: "PENDING_APPROVAL" },
                { actionId: "r", kind: "MACRO", status: "PENDING_APPROVAL" },
            ])
            .approval("ap", "ms-e1", "r", false).events;
        const plan = (await planRevert(
            item({ history, milestones: [milestone()] }),
            ctx,
        ))!;
        expect(plan.undo).toEqual([]);
        expect(canRevert(plan)).toBe(true);
    });
});

describe("hasOwnHistory", () => {
    it("ignores reverted entries", () => {
        expect(hasOwnHistory(item())).toBe(false);
        expect(
            hasOwnHistory(
                item({ history: new HistoryBuilder().method("e1", 1).events }),
            ),
        ).toBe(true);
        expect(
            hasOwnHistory(
                item({
                    history: new HistoryBuilder()
                        .method("e1", 1)
                        .revert("r1", "e1").events,
                }),
            ),
        ).toBe(false);
    });
});

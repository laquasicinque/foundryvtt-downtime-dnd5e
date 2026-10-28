import { describe, expect, it } from "vite-plus/test";
import {
    deriveState,
    effectiveEvents,
    nextSeq,
} from "../../../model/rules/derive";
import { item } from "../../helpers/fixtures";
import { HistoryBuilder } from "../../helpers/HistoryBuilder";

describe("deriveState", () => {
    it("starts at zero with no history", () => {
        const state = deriveState(item());
        expect(state).toMatchObject({
            value: 0,
            percent: 0,
            completed: false,
            locked: false,
        });
    });

    it("folds applied deltas and SET values in seq order", () => {
        const history = new HistoryBuilder()
            .method("e1", 3)
            .adjust("e2", 2)
            .set("e3", 1)
            .method("e4", 4).events;
        const state = deriveState(item({ history }));
        expect(state.value).toBe(5);
        expect(state.percent).toBe(50);
    });

    it("uses applied (post-clamp) deltas, not requested", () => {
        const history = new HistoryBuilder()
            .method("e1", 8)
            .method("e2", 8).events;
        expect(deriveState(item({ history })).value).toBe(10);
    });

    it("clamps for display when bounds shrink later, keeping rawValue", () => {
        const history = new HistoryBuilder({
            target: null,
            min: null,
            max: null,
        }).method("e1", 15).events;
        const state = deriveState(
            item({ history, progress: { target: 10, min: 0, max: 10 } }),
        );
        expect(state.rawValue).toBe(15);
        expect(state.value).toBe(10);
    });

    it("supports negative progress when unbounded below", () => {
        const history = new HistoryBuilder({
            target: 10,
            min: -10,
            max: 10,
        }).method("e1", -4).events;
        const state = deriveState(
            item({ history, progress: { target: 10, min: -10, max: 10 } }),
        );
        expect(state.value).toBe(-4);
        expect(state.percent).toBe(-40);
    });

    it("is open-ended (no percent) without a target", () => {
        const history = new HistoryBuilder({
            target: null,
            min: 0,
            max: null,
        }).method("e1", 42).events;
        const state = deriveState(
            item({ history, progress: { target: null, min: 0, max: null } }),
        );
        expect(state.value).toBe(42);
        expect(state.percent).toBeNull();
    });

    it("completes and locks via milestone actions", () => {
        const history = new HistoryBuilder()
            .method("e1", 10)
            .milestone("ms-e1", "ms1", "e1", [
                { actionId: "a1", kind: "COMPLETE" },
                { actionId: "a2", kind: "LOCK" },
            ]).events;
        const state = deriveState(item({ history }));
        expect(state).toMatchObject({
            completed: true,
            everCompleted: true,
            locked: true,
        });
        expect(state.completedAt).toBe(history[1]!.timestamp);
        expect(state.milestoneFires).toEqual({ ms1: 1 });
    });

    it("holds pending actions until approved, and applies on approval", () => {
        const builder = new HistoryBuilder()
            .method("e1", 10)
            .milestone("ms-e1", "ms1", "e1", [
                {
                    actionId: "a1",
                    kind: "COMPLETE",
                    status: "PENDING_APPROVAL",
                },
            ]);
        const pending = deriveState(item({ history: builder.events }));
        expect(pending.completed).toBe(false);
        expect(pending.pendingApprovals).toEqual([
            { milestoneEventId: "ms-e1", actionId: "a1", kind: "COMPLETE" },
        ]);

        builder.approval("ap1", "ms-e1", "a1", true);
        const approved = deriveState(item({ history: builder.events }));
        expect(approved.completed).toBe(true);
        expect(approved.pendingApprovals).toEqual([]);
    });

    it("does not apply rejected actions", () => {
        const history = new HistoryBuilder()
            .method("e1", 10)
            .milestone("ms-e1", "ms1", "e1", [
                {
                    actionId: "a1",
                    kind: "COMPLETE",
                    status: "PENDING_APPROVAL",
                },
            ])
            .approval("ap1", "ms-e1", "a1", false).events;
        const state = deriveState(item({ history }));
        expect(state.completed).toBe(false);
        expect(state.pendingApprovals).toEqual([]);
    });

    it("lets STATE events override lock/completion", () => {
        const history = new HistoryBuilder()
            .method("e1", 10)
            .milestone("ms-e1", "ms1", "e1", [{ actionId: "a2", kind: "LOCK" }])
            .state("s1", { locked: false, completed: true }).events;
        const state = deriveState(item({ history }));
        expect(state.locked).toBe(false);
        expect(state.completed).toBe(true);
        expect(state.everCompleted).toBe(true);
    });

    it("keeps everCompleted after completion is undone by STATE", () => {
        const history = new HistoryBuilder()
            .method("e1", 10)
            .milestone("ms-e1", "ms1", "e1")
            .state("s1", { completed: false }).events;
        const state = deriveState(item({ history }));
        expect(state.completed).toBe(false);
        expect(state.everCompleted).toBe(true);
        expect(state.completedAt).toBeNull();
    });
});

describe("reverts", () => {
    it("removes the reverted event and its reverted milestones from the fold", () => {
        const history = new HistoryBuilder()
            .method("e1", 4)
            .method("e2", 6)
            .milestone("ms-e2", "ms1", "e2")
            .revert("r1", "e2", ["ms-e2"]).events;
        const state = deriveState(item({ history }));
        expect(state.value).toBe(4);
        expect(state.completed).toBe(false);
        expect(state.milestoneFires).toEqual({});
        expect(state.effectiveEvents.map((e) => e.id)).toEqual(["e1"]);
    });

    it("keeps milestones that were not reverted with their cause", () => {
        const history = new HistoryBuilder()
            .method("e1", 10)
            .milestone("ms-e1", "ms1", "e1")
            .revert("r1", "e1", []).events;
        const state = deriveState(item({ history }));
        expect(state.value).toBe(0);
        expect(state.completed).toBe(true);
    });

    it("drops approvals of reverted milestone events", () => {
        const history = new HistoryBuilder()
            .method("e1", 10)
            .milestone("ms-e1", "ms1", "e1", [
                { actionId: "a1", status: "PENDING_APPROVAL" },
            ])
            .approval("ap1", "ms-e1", "a1", true)
            .revert("r1", "e1", ["ms-e1"]).events;
        expect(effectiveEvents(history).map((e) => e.id)).toEqual([]);
    });
});

describe("nextSeq", () => {
    it("is one past the highest seq", () => {
        expect(nextSeq(item())).toBe(0);
        expect(
            nextSeq(
                item({
                    history: new HistoryBuilder()
                        .method("e1", 1)
                        .method("e2", 1).events,
                }),
            ),
        ).toBe(2);
    });
});

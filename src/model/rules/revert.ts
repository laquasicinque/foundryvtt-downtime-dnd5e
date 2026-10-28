import { actionResults, effectiveEvents } from "./derive";

import type {
    EventBaseData,
    MilestoneEventData,
    ProgressEventData,
    RevertEventData,
    TrackedItemData,
} from "../../types/data";
import { isProgressEvent } from "./events";

import type {
    MilestoneActionStep,
    RevertPlan,
    RevertContext,
} from "../../types/revert";

/**
 * History is a stack: only the latest non-reverted progress
 * event can be reverted, together with what it caused.
 */
export function latestProgressEvent(
    item: TrackedItemData,
): ProgressEventData | null {
    const events = effectiveEvents(item.history).filter(isProgressEvent);
    return events.at(-1) ?? null;
}

/**
 * Whether a tracked item has history that still counts: anything not
 * reverted. An item whose own changes were all reverted can be removed.
 */
export function hasOwnHistory(
    item: TrackedItemData | null | undefined,
): boolean {
    return !!item && effectiveEvents(item.history).length > 0;
}

export async function planRevert(
    item: TrackedItemData,
    ctx: RevertContext,
): Promise<RevertPlan | null> {
    const target = latestProgressEvent(item);
    if (!target) return null;

    const events = effectiveEvents(item.history);
    const results = actionResults(events);
    const caused = events.filter(
        (event): event is MilestoneEventData =>
            event.kind === "MILESTONE" && event.causeEventId === target.id,
    );

    const plan: RevertPlan = {
        target,
        revertedMilestoneEventIds: [],
        keptMilestoneEventIds: [],
        undo: [],
        blockers: [],
    };

    for (const milestoneEvent of caused) {
        const milestone = item.milestones.find(
            (m) => m.id === milestoneEvent.milestoneId,
        );
        if (!milestone || !milestone.revertWithCause) {
            plan.keptMilestoneEventIds.push(milestoneEvent.id);
            continue;
        }
        plan.revertedMilestoneEventIds.push(milestoneEvent.id);

        for (const original of milestoneEvent.actions) {
            const result =
                results.get(`${milestoneEvent.id}:${original.actionId}`) ??
                original;
            if (result.status !== "APPLIED") continue; // pending/rejected/failed: nothing to undo

            const ids: MilestoneActionStep = {
                milestoneEventId: milestoneEvent.id,
                actionId: result.actionId,
            };
            switch (result.kind) {
                case "COMPLETE":
                case "LOCK":
                    plan.undo.push({ kind: "DERIVED", ...ids });
                    break;
                case "ANNOUNCE":
                    plan.undo.push({
                        kind: "NONE",
                        action: result.kind,
                        ...ids,
                    });
                    break;
                case "GRANT_ITEM":
                case "APPLY_EFFECT":
                    plan.undo.push({
                        kind: "DELETE_DOCUMENTS",
                        uuids: result.createdUuids,
                        ...ids,
                    });
                    break;
                case "ADD_TRACKED_ITEM": {
                    for (const created of result.createdItems) {
                        if (await ctx.trackedItemHasHistory(created)) {
                            plan.blockers.push({
                                kind: "TRACKED_ITEM_HAS_HISTORY",
                                item: created,
                                ...ids,
                            });
                        }
                    }
                    plan.undo.push({
                        kind: "DELETE_TRACKED_ITEMS",
                        items: result.createdItems,
                        ...ids,
                    });
                    break;
                }
                case "ADJUST_PROGRESS": {
                    if (!result.adjustedEvent) break; // never wrote an event
                    const { eventId, ...location } = result.adjustedEvent;
                    const check = await ctx.checkAdjustment(location, eventId);
                    if (!check.ok) {
                        plan.blockers.push(
                            check.notLatest
                                ? {
                                      kind: "ADJUSTMENT_NOT_LATEST",
                                      target: location,
                                      eventId,
                                      ...ids,
                                  }
                                : {
                                      kind: "ADJUSTMENT_BLOCKED",
                                      target: location,
                                      reason: check.reason,
                                      ...ids,
                                  },
                        );
                    }
                    plan.undo.push({
                        kind: "REVERT_ADJUSTMENT",
                        target: location,
                        eventId,
                        ...ids,
                    });
                    break;
                }
                case "MACRO": {
                    const action = milestone.actions.find(
                        (a) => a.id === result.actionId,
                    );
                    const undoMacroUuid =
                        action?.kind === "MACRO" ? action.undoMacroUuid : null;
                    if (undoMacroUuid) {
                        plan.undo.push({
                            kind: "RUN_UNDO_MACRO",
                            macroUuid: undoMacroUuid,
                            ...ids,
                        });
                    } else {
                        plan.blockers.push({
                            kind: "MACRO_WITHOUT_UNDO",
                            ...ids,
                        });
                    }
                    break;
                }
            }
        }
    }
    return plan;
}

export function canRevert(plan: RevertPlan): boolean {
    return plan.blockers.length === 0;
}

/** The REVERT event to append once every undo step has succeeded. */
export function revertEventFor(
    plan: RevertPlan,
    base: Omit<EventBaseData, "dismissed" | "note"> &
        Partial<Pick<EventBaseData, "dismissed" | "note">>,
): RevertEventData {
    return {
        dismissed: false,
        note: null,
        ...base,
        kind: "REVERT",
        targetEventId: plan.target.id,
        revertedMilestoneEventIds: [...plan.revertedMilestoneEventIds],
    };
}

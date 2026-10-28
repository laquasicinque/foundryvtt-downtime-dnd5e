import { clampProgress, percentOf } from "./progress";
import type {
    HistoryEventData,
    Id,
    MilestoneActionKind,
    MilestoneActionResult,
    TrackedItemData,
} from "../../types/data";
import { Iter } from "it-al";

export interface PendingApproval {
    milestoneEventId: Id;
    actionId: Id;
    kind: MilestoneActionKind;
}

export interface TrackedItemState {
    /** Folded value, clamped into the item's current bounds for display. */
    value: number;
    /** Folded value before display clamping. Differs only if bounds changed later. */
    rawValue: number;
    percent: number | null;
    completed: boolean;
    everCompleted: boolean;
    /** When the item most recently became complete. null if not complete or unknown. */
    completedAt: number | null;
    locked: boolean;
    milestoneFires: Record<Id, number>;
    pendingApprovals: PendingApproval[];
    /** Non-reverted events in seq order. REVERT events themselves are excluded. */
    effectiveEvents: HistoryEventData[];
}

const actionKey = (milestoneEventId: Id, actionId: Id) =>
    `${milestoneEventId}:${actionId}`;

/** Ids removed from the fold by REVERT events. */
export function revertedEventIds(history: HistoryEventData[]): Set<Id> {
    const reverted = new Set<Id>();
    for (const event of history) {
        if (event.kind !== "REVERT") continue;
        reverted.add(event.targetEventId);
        for (const id of event.revertedMilestoneEventIds) reverted.add(id);
    }
    return reverted;
}

export function effectiveEvents(
    history: HistoryEventData[],
): HistoryEventData[] {
    const reverted = revertedEventIds(history);
    return history.filter((event) => {
        if (event.kind === "REVERT") return false;
        if (reverted.has(event.id)) return false;
        if (event.kind === "APPROVAL" && reverted.has(event.milestoneEventId))
            return false;
        return true;
    });
}

/**
 * Current result of every milestone action: the milestone event's result,
 * replaced by the approval's result once a pending action is resolved.
 * Keyed by `${milestoneEventId}:${actionId}`.
 */
export function actionResults(
    events: HistoryEventData[],
): Map<string, MilestoneActionResult> {
    const results = new Map<string, MilestoneActionResult>();
    for (const event of events) {
        if (event.kind === "MILESTONE") {
            for (const action of event.actions) {
                results.set(actionKey(event.id, action.actionId), action);
            }
        } else if (event.kind === "APPROVAL") {
            const key = actionKey(event.milestoneEventId, event.actionId);
            if (results.get(key)?.status === "PENDING_APPROVAL") {
                results.set(key, event.result);
            }
        }
    }
    return results;
}

export function deriveState(item: TrackedItemData): TrackedItemState {
    const events = effectiveEvents(item.history);

    let rawValue = 0;
    let completed = false;
    let everCompleted = false;
    let completedAt: number | null = null;
    let locked = false;
    const milestoneFires: Record<Id, number> = {};
    const pending = new Map<string, PendingApproval>();

    const applyAction = (
        kind: MilestoneActionKind,
        timestamp: number | null,
    ) => {
        if (kind === "COMPLETE") {
            if (!completed) completedAt = timestamp;
            completed = true;
            everCompleted = true;
        } else if (kind === "LOCK") {
            locked = true;
        }
    };

    for (const event of events) {
        switch (event.kind) {
            case "METHOD":
            case "ADJUST":
            case "LEGACY":
                rawValue += event.progress.applied;
                break;
            case "SET":
                rawValue = event.value;
                break;
            case "MILESTONE":
                milestoneFires[event.milestoneId] =
                    (milestoneFires[event.milestoneId] ?? 0) + 1;
                for (const action of event.actions) {
                    if (action.status === "APPLIED") {
                        applyAction(action.kind, event.timestamp);
                    } else if (action.status === "PENDING_APPROVAL") {
                        pending.set(actionKey(event.id, action.actionId), {
                            milestoneEventId: event.id,
                            actionId: action.actionId,
                            kind: action.kind,
                        });
                    }
                }
                break;
            case "APPROVAL": {
                const key = actionKey(event.milestoneEventId, event.actionId);
                const entry = pending.get(key);
                if (!entry) break;
                pending.delete(key);
                if (event.result.status === "APPLIED")
                    applyAction(entry.kind, event.timestamp);
                break;
            }
            case "STATE":
                if (event.locked !== undefined) locked = event.locked;
                if (event.completed !== undefined) {
                    if (event.completed && !completed)
                        completedAt = event.timestamp;
                    if (!event.completed) completedAt = null;
                    completed = event.completed;
                    if (completed) everCompleted = true;
                }
                break;
            case "REVERT":
                // Excluded by effectiveEvents.
                break;
        }
    }

    const value = clampProgress(rawValue, item.progress);
    return {
        value,
        rawValue,
        percent: percentOf(value, item.progress.target),
        completed,
        everCompleted,
        completedAt: completed ? completedAt : null,
        locked,
        milestoneFires,
        pendingApprovals: [...pending.values()],
        effectiveEvents: events,
    };
}

/** Next `seq` to assign when appending to this item's history. */
export function nextSeq(item: TrackedItemData): number {
    // max() is -Infinity for an empty history, so the first seq is 0.
    return Math.max(-1, Iter.from(item.history).pluck("seq").max()) + 1;
}

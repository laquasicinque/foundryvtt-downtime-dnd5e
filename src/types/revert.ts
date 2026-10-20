/** Revert planning: what undoing the latest change involves, and what can block it. */
import type {
    Id,
    ItemLocation,
    MilestoneActionKind,
    ProgressEventData,
} from "./data";

/** Which milestone action an undo step or blocker belongs to. */
export interface MilestoneActionStep {
    milestoneEventId: Id;
    actionId: Id;
}

/** COMPLETE / LOCK: derived state, removing the event is enough. */
export interface DerivedUndoStep extends MilestoneActionStep {
    kind: "DERIVED";
}

/** ANNOUNCE: the message stays. Non-blocking. */
export interface NoUndoStep extends MilestoneActionStep {
    kind: "NONE";
    action: MilestoneActionKind;
}

/** GRANT_ITEM / APPLY_EFFECT: delete what was created. */
export interface DeleteDocumentsStep extends MilestoneActionStep {
    kind: "DELETE_DOCUMENTS";
    uuids: string[];
}

/** ADD_TRACKED_ITEM: delete the tracked items it added. */
export interface DeleteTrackedItemsStep extends MilestoneActionStep {
    kind: "DELETE_TRACKED_ITEMS";
    items: ItemLocation[];
}

/** ADJUST_PROGRESS: revert the event it wrote on the other item. */
export interface RevertAdjustmentStep extends MilestoneActionStep {
    kind: "REVERT_ADJUSTMENT";
    target: ItemLocation;
    eventId: Id;
}

/** MACRO: run its undo macro. */
export interface RunUndoMacroStep extends MilestoneActionStep {
    kind: "RUN_UNDO_MACRO";
    macroUuid: string;
}

export type UndoStep =
    | DerivedUndoStep
    | NoUndoStep
    | DeleteDocumentsStep
    | DeleteTrackedItemsStep
    | RevertAdjustmentStep
    | RunUndoMacroStep;

export interface MacroWithoutUndoBlocker extends MilestoneActionStep {
    kind: "MACRO_WITHOUT_UNDO";
}

/** A tracked item it added has progress of its own. */
export interface TrackedItemHasHistoryBlocker extends MilestoneActionStep {
    kind: "TRACKED_ITEM_HAS_HISTORY";
    item: ItemLocation;
}

/** The item it adjusted has newer changes. */
export interface AdjustmentNotLatestBlocker extends MilestoneActionStep {
    kind: "ADJUSTMENT_NOT_LATEST";
    target: ItemLocation;
    eventId: Id;
}

/** Reverting the adjustment on the other item is itself blocked. */
export interface AdjustmentBlockedBlocker extends MilestoneActionStep {
    kind: "ADJUSTMENT_BLOCKED";
    target: ItemLocation;
    reason: string;
}

export type RevertBlocker =
    | MacroWithoutUndoBlocker
    | TrackedItemHasHistoryBlocker
    | AdjustmentNotLatestBlocker
    | AdjustmentBlockedBlocker;

export interface RevertPlan {
    target: ProgressEventData;
    /** Milestone events reverted along with the target (revertWithCause). */
    revertedMilestoneEventIds: Id[];
    /** Milestone events caused by the target that stay (revertWithCause false, or milestone deleted). */
    keptMilestoneEventIds: Id[];
    undo: UndoStep[];
    blockers: RevertBlocker[];
}

/** Lookups into other items, injected by the GM-side executor. */
export interface RevertContext {
    /** Whether a tracked item created by ADD_TRACKED_ITEM has history of its own (`hasOwnHistory`). Missing items: false. */
    trackedItemHasHistory(location: ItemLocation): Promise<boolean>;
    /**
     * Whether an ADJUST_PROGRESS event on another item can itself be reverted:
     * it must be the latest there, and its own plan must be unblocked.
     */
    checkAdjustment(
        target: ItemLocation,
        eventId: Id,
    ): Promise<
        { ok: true } | { ok: false; notLatest: boolean; reason: string }
    >;
}

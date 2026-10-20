/** Milestones, their actions and recipients. Stored data unless marked otherwise. */
import type { Id } from "./common";
import type { TrackedItemTemplate } from "./item";
import type { ItemRef } from "./requirements";

export interface MilestoneData {
    id: Id;
    label: string;
    at: number;
    /**
     * CROSS = moves from below to at/above. EXACT = lands on `at` after clamping.
     * EVERY = each positive multiple of `at` passed (repeating downtimes); can fire several times per change.
     */
    match: "CROSS" | "EXACT" | "EVERY";
    /** 1 = first time only. null = every time. */
    maxTimes: number | null;
    revertWithCause: boolean;
    actions: MilestoneAction[];
}

export interface MilestoneActionBase {
    id: Id;
}

export interface CompleteAction extends MilestoneActionBase {
    kind: "COMPLETE";
}

/** Methods can't be used until it's unlocked. */
export interface LockAction extends MilestoneActionBase {
    kind: "LOCK";
}

export interface AnnounceAction extends MilestoneActionBase {
    kind: "ANNOUNCE";
    /** null: a default message. */
    message: string | null;
    audience: "WORLD_DEFAULT" | "PUBLIC" | "GM";
}

/** Any Item type: equipment, feat, spell… */
export interface GrantItemAction extends MilestoneActionBase {
    kind: "GRANT_ITEM";
    sourceUuid: string;
    quantity: number;
    recipient: Recipient;
}

export interface ApplyEffectAction extends MilestoneActionBase {
    kind: "APPLY_EFFECT";
    sourceUuid: string;
    recipient: Recipient;
}

/** A fresh tracked item from `template`. */
export interface AddTrackedItemAction extends MilestoneActionBase {
    kind: "ADD_TRACKED_ITEM";
    template: TrackedItemTemplate;
    store: "SAME" | "RECIPIENT_ACTOR" | "WORLD";
    /** RECIPIENT_ACTOR only. */
    recipient: Recipient | null;
}

export interface AdjustProgressAction extends MilestoneActionBase {
    kind: "ADJUST_PROGRESS";
    ref: ItemRef;
    delta: number;
}

/** Runs on the GM; reverting needs `undoMacroUuid`. */
export interface MacroAction extends MilestoneActionBase {
    kind: "MACRO";
    macroUuid: string;
    undoMacroUuid: string | null;
}

export type MilestoneAction =
    | CompleteAction
    | LockAction
    | AnnounceAction
    | GrantItemAction
    | ApplyEffectAction
    | AddTrackedItemAction
    | AdjustProgressAction
    | MacroAction;

export type MilestoneActionKind = MilestoneAction["kind"];

export type RecipientSelection = "AUTO" | "GM_PICKS";

/** The actor whose change reached the milestone. */
export interface TriggeringActorRecipient {
    type: "TRIGGERING_ACTOR";
}

/** The actor the item belongs to (actor stores only). */
export interface OwningActorRecipient {
    type: "OWNING_ACTOR";
}

/** Listed actors (all, or those the GM picks). */
export interface ActorListRecipient {
    type: "ACTOR";
    actorUuids: string[];
    selection: RecipientSelection;
}

/** Contributors from the item's history passing `filter` (all, or those the GM picks). */
export interface ContributorsRecipient {
    type: "CONTRIBUTORS";
    filter: ContributorFilter;
    selection: RecipientSelection;
}

export type Recipient =
    | TriggeringActorRecipient
    | OwningActorRecipient
    | ActorListRecipient
    | ContributorsRecipient;

export interface ContributorFilter {
    window: "ALL_TIME" | "SINCE_LAST_FIRE";
    minNet: number | null;
    minAttempts: number | null;
    /** Empty = all methods. */
    methodIds: Id[];
}

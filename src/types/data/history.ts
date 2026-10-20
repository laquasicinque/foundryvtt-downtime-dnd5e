/** History events: the source of truth for progress. Stored data unless marked otherwise. */
import type { Id, ItemLocation } from "./common";
import type { MethodKind } from "./methods";
import type { MilestoneActionKind } from "./milestones";
import type { CountsAs } from "./results";
import type { LocalizedText } from "../i18n";

export interface Contributor {
    actorUuid: string | null;
    actorName: string | null;
    userId: string | null;
    userName: string | null;
    userWasGM: boolean;
}

export interface EventBaseData {
    id: Id;
    /** Monotonic per item; the canonical order. */
    seq: number;
    /** ms epoch. null = unknown ("Date unknown"), never an error. */
    timestamp: number | null;
    contributor: Contributor;
    /** GM has reviewed this entry. */
    dismissed: boolean;
    /** GM-only. */
    note: string | null;
}

export interface ProgressDelta {
    requested: number;
    /** After clamping. The fold uses this only. */
    applied: number;
    /** Display snapshots, never read by the fold. */
    before: number;
    after: number;
}

export interface BandSnapshot {
    id: Id;
    label: string;
    countsAs: CountsAs;
}

export interface RollSummary {
    formula: string;
    total: number;
    natural: number | null;
    /** Effective DC used for band resolution. */
    dc: number | null;
    dcSource: "METHOD" | "ACTIVITY" | null;
    rolled: {
        kind: "ABILITY" | "SKILL" | "TOOL" | "SAVE" | "CUSTOM";
        key: string;
        label: string;
        toolItemName?: string;
        activityName?: string;
    };
    rollMode: string;
    messageId: string | null;
}

export interface MethodEventData extends EventBaseData {
    kind: "METHOD";
    methodId: Id;
    method: { name: string; kind: MethodKind };
    band: BandSnapshot | null;
    roll: RollSummary | null;
    usageTier: number | null;
    progress: ProgressDelta;
}

export interface AdjustEventData extends EventBaseData {
    kind: "ADJUST";
    progress: ProgressDelta;
}

export interface SetEventData extends EventBaseData {
    kind: "SET";
    reason: "MIGRATION" | "API" | "MANUAL" | "IMPORT";
    value: number;
    before: number;
}

export interface LegacyEventData extends EventBaseData {
    kind: "LEGACY";
    actionName: string;
    methodId: Id | null;
    progress: ProgressDelta;
}

export type ActionStatus =
    | "APPLIED"
    | "PENDING_APPROVAL"
    | "REJECTED"
    | "FAILED"
    | "REVERTED";

export interface MilestoneActionResult {
    actionId: Id;
    /** Snapshot so history reads correctly if the action is edited/deleted. */
    kind: MilestoneActionKind;
    status: ActionStatus;
    /** Why it failed or similar: a key, so it reads in each viewer's language. Plain strings come from older data. */
    message: LocalizedText | string | null;
    /** Foundry documents created (GRANT_ITEM / APPLY_EFFECT), for reverting. */
    createdUuids: string[];
    /** Tracked items created by ADD_TRACKED_ITEM, for reverting. */
    createdItems: ItemLocation[];
    /** Event written by ADJUST_PROGRESS on the target item, for cascading reverts. */
    adjustedEvent: (ItemLocation & { eventId: Id }) | null;
    /** For GM_PICKS recipients: the actors the GM chose. */
    recipientUuids: string[];
}

export interface MilestoneEventData extends EventBaseData {
    kind: "MILESTONE";
    milestoneId: Id;
    causeEventId: Id;
    actions: MilestoneActionResult[];
}

export interface ApprovalEventData extends EventBaseData {
    kind: "APPROVAL";
    milestoneEventId: Id;
    actionId: Id;
    approved: boolean;
    /**
     * Outcome of running the action once approved (status APPLIED or FAILED,
     * created documents, chosen recipients), or REJECTED. Milestone events are
     * immutable, so this is where a delayed action's result lives.
     */
    result: MilestoneActionResult;
}

export interface RevertEventData extends EventBaseData {
    kind: "REVERT";
    /** The progress event popped off the stack. */
    targetEventId: Id;
    /** Milestone events reverted along with it (those with revertWithCause). */
    revertedMilestoneEventIds: Id[];
}

export interface StateEventData extends EventBaseData {
    kind: "STATE";
    locked?: boolean;
    completed?: boolean;
}

export type HistoryEventData =
    | MethodEventData
    | AdjustEventData
    | SetEventData
    | LegacyEventData
    | MilestoneEventData
    | ApprovalEventData
    | RevertEventData
    | StateEventData;

export type HistoryEventKind = HistoryEventData["kind"];

/** Events that change progress, i.e. the entries of the revert stack. */
export type ProgressEventData =
    | MethodEventData
    | AdjustEventData
    | SetEventData
    | LegacyEventData;

import { contributorDisplayName } from "../model/rules/contributor";
import { actionResults } from "../model/rules/derive";
import type {
    AdjustEventData,
    ApprovalEventData,
    BandSnapshot,
    Contributor,
    HistoryEventData,
    HistoryEventKind,
    Id,
    LegacyEventData,
    MethodEventData,
    MethodKind,
    MilestoneActionResult,
    MilestoneEventData,
    ProgressDelta,
    RevertEventData,
    RollSummary,
    SetEventData,
    StateEventData,
} from "../types/data";
import { dispatchOrThrow, type DomainContext } from "./context";
import type { AnyMethod } from "./Method";
import type { Milestone } from "./Milestone";
import type { TrackedItem } from "./TrackedItem";

/** One immutable history entry. Read-only; see subclasses per kind. */
export class HistoryEvent<D extends HistoryEventData = HistoryEventData> {
    readonly item: TrackedItem;
    readonly data: Readonly<D>;
    protected readonly ctx: DomainContext;

    constructor(item: TrackedItem, data: Readonly<D>, ctx: DomainContext) {
        this.item = item;
        this.data = data;
        this.ctx = ctx;
    }

    get id(): Id {
        return this.data.id;
    }
    get kind(): HistoryEventKind {
        return this.data.kind;
    }
    get seq(): number {
        return this.data.seq;
    }
    /** ms epoch, or null when unknown ("Date unknown"). */
    get timestamp(): number | null {
        return this.data.timestamp;
    }
    get date(): Date | null {
        return this.data.timestamp === null
            ? null
            : new Date(this.data.timestamp);
    }
    get contributor(): Contributor {
        return this.data.contributor;
    }
    /** Display name per the contributor rule (live names first). */
    get contributorName(): string {
        return contributorDisplayName(this.data.contributor, this.ctx.names);
    }
    get dismissed(): boolean {
        return this.data.dismissed;
    }
    /** GM-only note. */
    get note(): string | null {
        return this.data.note;
    }
    get isReverted(): boolean {
        return this.item.revertedIds.has(this.id);
    }

    /** GM: mark as reviewed (or not). */
    async dismiss(dismissed = true): Promise<TrackedItem> {
        await dispatchOrThrow(this.ctx, {
            type: "SET_DISMISSED",
            store: this.item.store,
            itemId: this.item.id,
            eventIds: [this.id],
            dismissed,
        });
        return this.item.reload();
    }

    /** GM: set or clear the note. */
    async setNote(note: string | null): Promise<TrackedItem> {
        await dispatchOrThrow(this.ctx, {
            type: "SET_NOTE",
            store: this.item.store,
            itemId: this.item.id,
            eventId: this.id,
            note,
        });
        return this.item.reload();
    }

    toJSON(): D {
        return structuredClone(this.data) as D;
    }
}

abstract class ProgressHistoryEvent<
    D extends MethodEventData | AdjustEventData | LegacyEventData,
> extends HistoryEvent<D> {
    get progress(): ProgressDelta {
        return this.data.progress;
    }
    get delta(): number {
        return this.data.progress.applied;
    }
    get clamped(): boolean {
        return this.data.progress.requested !== this.data.progress.applied;
    }
}

export class MethodEvent extends ProgressHistoryEvent<MethodEventData> {
    get methodId(): Id {
        return this.data.methodId;
    }
    /** The live method, if it still exists. */
    get method(): AnyMethod | null {
        return this.item.method(this.data.methodId) ?? null;
    }
    /** Name/kind at the time of the event. */
    get methodSnapshot(): { name: string; kind: MethodKind } {
        return this.data.method;
    }
    get band(): BandSnapshot | null {
        return this.data.band;
    }
    get roll(): RollSummary | null {
        return this.data.roll;
    }
    get usageTier(): number | null {
        return this.data.usageTier;
    }
}

export class AdjustEvent extends ProgressHistoryEvent<AdjustEventData> {}

export class LegacyEvent extends ProgressHistoryEvent<LegacyEventData> {
    get actionName(): string {
        return this.data.actionName;
    }
}

export class SetEvent extends HistoryEvent<SetEventData> {
    get reason(): SetEventData["reason"] {
        return this.data.reason;
    }
    get value(): number {
        return this.data.value;
    }
    get before(): number {
        return this.data.before;
    }
}

export class MilestoneEvent extends HistoryEvent<MilestoneEventData> {
    get milestone(): Milestone | null {
        return this.item.milestone(this.data.milestoneId) ?? null;
    }
    get milestoneId(): Id {
        return this.data.milestoneId;
    }
    get cause(): AnyHistoryEvent | null {
        return this.item.event(this.data.causeEventId) ?? null;
    }
    /** Current result of each action (approvals applied). */
    get actions(): MilestoneActionResult[] {
        const results = actionResults(this.item.data.history);
        return this.data.actions.map(
            (a) => results.get(`${this.id}:${a.actionId}`) ?? a,
        );
    }
    /** GM: approve or reject a pending action. */
    async resolve(
        actionId: Id,
        approved: boolean,
        recipientUuids?: string[],
    ): Promise<TrackedItem> {
        await dispatchOrThrow(this.ctx, {
            type: "RESOLVE_APPROVAL",
            store: this.item.store,
            itemId: this.item.id,
            milestoneEventId: this.id,
            actionId,
            approved,
            ...(recipientUuids && { recipientUuids }),
        });
        return this.item.reload();
    }
}

export class ApprovalEvent extends HistoryEvent<ApprovalEventData> {
    get approved(): boolean {
        return this.data.approved;
    }
    get result(): MilestoneActionResult {
        return this.data.result;
    }
}

export class RevertEvent extends HistoryEvent<RevertEventData> {
    get target(): AnyHistoryEvent | null {
        return this.item.event(this.data.targetEventId) ?? null;
    }
}

export class StateEvent extends HistoryEvent<StateEventData> {
    get locked(): boolean | undefined {
        return this.data.locked;
    }
    get completed(): boolean | undefined {
        return this.data.completed;
    }
}

export type AnyHistoryEvent =
    | MethodEvent
    | AdjustEvent
    | LegacyEvent
    | SetEvent
    | MilestoneEvent
    | ApprovalEvent
    | RevertEvent
    | StateEvent;

export function createHistoryEvent(
    item: TrackedItem,
    data: Readonly<HistoryEventData>,
    ctx: DomainContext,
): AnyHistoryEvent {
    switch (data.kind) {
        case "METHOD":
            return new MethodEvent(item, data, ctx);
        case "ADJUST":
            return new AdjustEvent(item, data, ctx);
        case "LEGACY":
            return new LegacyEvent(item, data, ctx);
        case "SET":
            return new SetEvent(item, data, ctx);
        case "MILESTONE":
            return new MilestoneEvent(item, data, ctx);
        case "APPROVAL":
            return new ApprovalEvent(item, data, ctx);
        case "REVERT":
            return new RevertEvent(item, data, ctx);
        case "STATE":
            return new StateEvent(item, data, ctx);
    }
}

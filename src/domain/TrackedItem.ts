import type { ItemChanges } from "../types/commands";
import {
    contributions,
    type ContributionOptions,
    type Contributions,
} from "../model/rules/contributions";
import {
    deriveState,
    revertedEventIds,
    type TrackedItemState,
} from "../model/rules/derive";
import {
    describeRequirement,
    evaluateRequirements,
    type RequirementLabels,
    type MethodAvailability,
    type RequirementContext,
} from "../model/rules/requirements";
import {
    canRevert,
    hasOwnHistory,
    latestProgressEvent,
    planRevert,
} from "../model/rules/revert";
import type { RevertContext, RevertPlan } from "../types/revert";
import type {
    ApprovalPolicy,
    Requirement,
    Id,
    ProgressConfig,
    QuarantinedRecord,
    StoreRef,
    TrackedItemData,
} from "../types/data";
import {
    deepFreeze,
    dispatchOrThrow,
    memo,
    type DomainContext,
} from "./context";
import { DowntimeError } from "./DowntimeError";
import { toV1, type LegacyTrackedItemView } from "../model/storage/legacy";
import { createHistoryEvent, type AnyHistoryEvent } from "./HistoryEvent";
import { createMethod, type AnyMethod } from "./Method";
import { Milestone } from "./Milestone";

const RAW_LABELS: Omit<RequirementLabels, "t"> = {
    skill: (key) => key,
    ability: (key) => key,
    tool: (key) => key,
};

/**
 * A tracked item: read-only view over stored data, with derived state and
 * write methods that go through the GM command pipeline.
 *
 * Instances are immutable. Every write resolves to a *new* instance, so
 * memoised derived values can never go stale.
 */
export class TrackedItem {
    readonly data: Readonly<TrackedItemData>;
    readonly store: StoreRef;
    private readonly ctx: DomainContext;
    readonly #cache = new Map<string, unknown>();

    constructor(data: TrackedItemData, store: StoreRef, ctx: DomainContext) {
        this.data = deepFreeze(structuredClone(data));
        this.store = deepFreeze(store);
        this.ctx = ctx;
    }

    get id(): Id {
        return this.data.id;
    }
    get name(): string {
        return this.data.name;
    }
    get img(): string {
        return this.data.img;
    }
    get description(): string {
        return this.data.description;
    }
    get categoryId(): Id | null {
        return this.data.categoryId;
    }
    get hidden(): boolean {
        return this.data.hidden;
    }
    get preset(): string | null {
        return this.data.preset;
    }
    get progress(): ProgressConfig {
        return this.data.progress;
    }
    get approval(): ApprovalPolicy {
        return this.data.approval;
    }
    /** Requirements on the item itself (checked together with each method's). */
    get requirements(): readonly Requirement[] {
        return this.data.requirements;
    }
    /** Records the normaliser couldn't parse (for the GM repair view). */
    get quarantine(): readonly QuarantinedRecord[] {
        return this.data.quarantine;
    }

    /** Derived state, calculated once per instance. */
    get state(): TrackedItemState {
        return memo(this.#cache, "state", () => deriveState(this.data));
    }
    get value(): number {
        return this.state.value;
    }
    get percent(): number | null {
        return this.state.percent;
    }
    get completed(): boolean {
        return this.state.completed;
    }
    get locked(): boolean {
        return this.state.locked;
    }

    get methods(): readonly AnyMethod[] {
        return memo(this.#cache, "methods", () =>
            Object.freeze(
                this.data.methods.map((m) => createMethod(this, m, this.ctx)),
            ),
        );
    }
    get milestones(): readonly Milestone[] {
        return memo(this.#cache, "milestones", () =>
            Object.freeze(
                this.data.milestones.map((m) => new Milestone(this, m)),
            ),
        );
    }
    /** Full history in seq order, reverted events included (see `isReverted`). */
    get history(): readonly AnyHistoryEvent[] {
        return memo(this.#cache, "history", () =>
            Object.freeze(
                this.data.history.map((e) =>
                    createHistoryEvent(this, e, this.ctx),
                ),
            ),
        );
    }
    /** @internal */
    get revertedIds(): ReadonlySet<Id> {
        return memo(this.#cache, "reverted", () =>
            revertedEventIds(this.data.history),
        );
    }

    method(id: Id): AnyMethod | undefined {
        return this.methods.find((m) => m.id === id);
    }
    milestone(id: Id): Milestone | undefined {
        return this.milestones.find((m) => m.id === id);
    }
    event(id: Id): AnyHistoryEvent | undefined {
        return this.history.find((e) => e.id === id);
    }

    /** Context for evaluating requirements against an acting actor. */
    requirementContext(
        actorUuid: string | null,
        macroRequirements: Record<Id, boolean> = {},
    ): RequirementContext {
        const store = this.store;
        return {
            actor: actorUuid ? this.ctx.actorView(actorUuid) : null,
            refs: {
                self: this.data,
                sameStore: this.ctx.storeTrackedItems(store) ?? [this.data],
                worldStore:
                    store.kind === "WORLD"
                        ? null
                        : this.ctx.storeTrackedItems({ kind: "WORLD" }),
                actingActorStore:
                    actorUuid &&
                    !(store.kind === "ACTOR" && store.actorUuid === actorUuid)
                        ? this.ctx.storeTrackedItems({
                              kind: "ACTOR",
                              actorUuid,
                          })
                        : null,
            },
            macroResults: new Map(Object.entries(macroRequirements)),
        };
    }

    /**
     * Whether the item itself is available to the actor (item-level
     * requirements only). For actor-stored items the actor is always the owner.
     */
    availability(
        actor?: string | null,
        macroRequirements: Record<Id, boolean> = {},
    ): MethodAvailability {
        const actorUuid =
            this.store.kind === "ACTOR"
                ? this.store.actorUuid
                : (actor ?? null);
        const ctx = this.requirementContext(actorUuid, macroRequirements);
        return evaluateRequirements(this.data, ctx, (requirement) =>
            this.describeRequirement(requirement, ctx),
        );
    }

    /**
     * Plain-English description of a requirement on this item or one of its
     * methods ("Requires proficiency in Athletics").
     */
    describeRequirement(
        requirement: Requirement,
        ctx: RequirementContext = this.requirementContext(null),
    ): string {
        return describeRequirement(
            requirement,
            { ...(this.ctx.requirementLabels ?? RAW_LABELS), t: this.ctx.t },
            ctx.refs,
        );
    }

    contributions(options?: ContributionOptions): Contributions {
        if (!options)
            return memo(this.#cache, "contributions", () =>
                contributions(this.data.history),
            );
        return contributions(this.data.history, options);
    }

    /** Only the current user's contributions (what a non-GM history view shows). */
    ownContributions(ownedActorUuids: ReadonlySet<string>): Contributions {
        return contributions(this.data.history, {
            viewer: { userId: this.ctx.currentUser().id, ownedActorUuids },
        });
    }

    /** What reverting the latest change would do, and what blocks it. */
    async planRevert(): Promise<RevertPlan | null> {
        const find = (store: StoreRef, itemId: Id) =>
            this.ctx.storeTrackedItems(store)?.find((i) => i.id === itemId) ??
            null;
        const ctx: RevertContext = {
            trackedItemHasHistory: async ({ store, itemId }) =>
                hasOwnHistory(find(store, itemId)),
            checkAdjustment: async ({ store, itemId }, eventId) => {
                const target = find(store, itemId);
                if (!target) return { ok: true };
                if (latestProgressEvent(target)?.id !== eventId)
                    return {
                        ok: false,
                        notLatest: true,
                        reason: `${target.name} has newer changes`,
                    };
                const plan = await planRevert(target, ctx);
                return plan && !canRevert(plan)
                    ? {
                          ok: false,
                          notLatest: false,
                          reason: `${target.name} can't be reverted`,
                      }
                    : { ok: true };
            },
        };
        return planRevert(this.data, ctx);
    }

    // ── Writes (GM-validated) ───────────────────────────────────────────────

    async adjust(
        delta: number,
        options: { note?: string | null; actor?: string | null } = {},
    ): Promise<TrackedItem> {
        await dispatchOrThrow(this.ctx, {
            type: "ADJUST",
            store: this.store,
            itemId: this.id,
            delta,
            actorUuid: options.actor ?? null,
            note: options.note ?? null,
        });
        return this.reload();
    }

    async set(
        value: number,
        options: { note?: string | null; reason?: "MANUAL" | "API" } = {},
    ): Promise<TrackedItem> {
        await dispatchOrThrow(this.ctx, {
            type: "SET",
            store: this.store,
            itemId: this.id,
            value,
            reason: options.reason ?? "MANUAL",
            note: options.note ?? null,
        });
        return this.reload();
    }

    async revertLatest(): Promise<TrackedItem> {
        await dispatchOrThrow(this.ctx, {
            type: "REVERT_LATEST",
            store: this.store,
            itemId: this.id,
        });
        return this.reload();
    }

    /** GM: mark several entries as reviewed (or not) in one write. */
    async dismissEvents(
        eventIds: readonly Id[],
        dismissed = true,
    ): Promise<TrackedItem> {
        await dispatchOrThrow(this.ctx, {
            type: "SET_DISMISSED",
            store: this.store,
            itemId: this.id,
            eventIds: [...eventIds],
            dismissed,
        });
        return this.reload();
    }

    async setState(state: {
        locked?: boolean;
        completed?: boolean;
        note?: string | null;
    }): Promise<TrackedItem> {
        await dispatchOrThrow(this.ctx, {
            type: "SET_STATE",
            store: this.store,
            itemId: this.id,
            ...state,
        });
        return this.reload();
    }

    async update(changes: ItemChanges): Promise<TrackedItem> {
        await dispatchOrThrow(this.ctx, {
            type: "UPDATE_ITEM",
            store: this.store,
            itemId: this.id,
            changes,
        });
        return this.reload();
    }

    async delete(): Promise<void> {
        await dispatchOrThrow(this.ctx, {
            type: "DELETE_ITEM",
            store: this.store,
            itemId: this.id,
        });
    }

    /** A fresh instance from the store. */
    async reload(): Promise<TrackedItem> {
        const fresh = await this.ctx.load(this.store, this.id);
        if (!fresh)
            throw new DowntimeError(
                "NOT_FOUND",
                `${this.name} no longer exists`,
            );
        return fresh;
    }

    // ── Serialisation ───────────────────────────────────────────────────────

    /** V1-shaped projection, for the deprecated V1 API getters. */
    toV1(): LegacyTrackedItemView {
        return toV1(this.data as TrackedItemData);
    }

    /** A mutable copy of the stored data. */
    toJSON(): TrackedItemData {
        return structuredClone(this.data) as TrackedItemData;
    }
}

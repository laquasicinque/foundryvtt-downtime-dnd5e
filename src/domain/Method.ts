import type { ClientRoll, MacroMethodResult } from "../types/commands";
import {
    evaluateRequirements,
    type MethodAvailability,
} from "../model/rules/requirements";
import type {
    AbilityKey,
    AbilityMethodData,
    BandEffect,
    CountsAs,
    FixedMethodData,
    Id,
    MacroMethodData,
    ManualMethodData,
    MethodData,
    MethodKind,
    Requirement,
    ResultTable,
    SkillKey,
    SkillMethodData,
    ToolFallback,
    ToolMethodData,
    UsageRule,
    UsageTier,
} from "../types/data";
import { currentTier } from "../model/rules/usage";
import { contributorFor, dispatchOrThrow, type DomainContext } from "./context";
import type { TrackedItem } from "./TrackedItem";

export interface MethodUsage {
    /** Prior uses that count towards the rule. */
    count: number;
    /** Tier that applies to the next use. */
    tier: UsageTier;
    /** Index into `usage.tiers`, or null for the implicit NORMAL tier. */
    index: number | null;
}

export interface UseOptions {
    /** Acting actor (uuid). Ignored for actor-stored items, which always act as their actor. */
    actor?: string | null;
    roll?: ClientRoll;
    amount?: number;
    macroResult?: MacroMethodResult;
    macroRequirements?: Record<Id, boolean>;
}

/** A way to change a tracked item's progress. Read-only; see subclasses per kind. */
export class Method<D extends MethodData = MethodData> {
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
    get kind(): MethodKind {
        return this.data.kind;
    }
    get name(): string {
        return this.data.name;
    }
    get description(): string {
        return this.data.description;
    }
    get img(): string | null {
        return this.data.img;
    }
    get hidden(): boolean {
        return this.data.hidden;
    }
    get requirements(): readonly Requirement[] {
        return this.data.requirements;
    }
    get usage(): UsageRule | null {
        return this.data.usage;
    }

    private actingActor(actor: string | null | undefined): string | null {
        return this.item.store.kind === "ACTOR"
            ? this.item.store.actorUuid
            : (actor ?? null);
    }

    /** Usage count and tier for the given actor (or the current user), or null without a usage rule. */
    usageFor(actor?: string | null): MethodUsage | null {
        return currentTier(
            this.item.data,
            this.id,
            contributorFor(this.ctx, this.actingActor(actor)),
        );
    }

    /** Whether this method is available to the actor. MACRO requirements need client-side results. */
    /**
     * Whether this method is available to the actor: the item's requirements
     * and the method's own (AND-ed). MACRO requirements need client-side results.
     */
    availability(
        actor?: string | null,
        macroRequirements: Record<Id, boolean> = {},
    ): MethodAvailability {
        const ctx = this.item.requirementContext(
            this.actingActor(actor),
            macroRequirements,
        );
        return evaluateRequirements(
            {
                requirements: [
                    ...this.item.requirements,
                    ...this.data.requirements,
                ],
            },
            ctx,
            (requirement) => this.item.describeRequirement(requirement, ctx),
        );
    }

    /**
     * Use the method with an already-made roll / amount / macro result.
     * Resolves to the updated item. Throws DowntimeError if the GM rejects it.
     */
    async use(options: UseOptions = {}): Promise<TrackedItem> {
        return (await this.useWithEvent(options)).item;
    }

    /** As `use()`, plus the id of the METHOD event it recorded (for the chat card). */
    async useWithEvent(
        options: UseOptions = {},
    ): Promise<{ item: TrackedItem; eventId: Id | null }> {
        const result = await dispatchOrThrow(this.ctx, {
            type: "USE_METHOD",
            store: this.item.store,
            itemId: this.item.id,
            methodId: this.id,
            actorUuid: this.actingActor(options.actor),
            roll: options.roll ?? null,
            amount: options.amount ?? null,
            macroResult: options.macroResult ?? null,
            macroRequirements: options.macroRequirements ?? {},
        });
        return {
            item: await this.item.reload(),
            eventId: result.ok ? (result.eventIds[0] ?? null) : null,
        };
    }

    toJSON(): D {
        return structuredClone(this.data) as D;
    }
}

abstract class CheckMethod<
    D extends AbilityMethodData | SkillMethodData | ToolMethodData,
> extends Method<D> {
    get dc(): number | null {
        return this.data.dc;
    }
    get results(): ResultTable {
        return this.data.results;
    }
}

export class AbilityMethod extends CheckMethod<AbilityMethodData> {
    override get kind(): "ABILITY" {
        return "ABILITY";
    }
    get ability(): AbilityKey {
        return this.data.ability;
    }
}

export class SkillMethod extends CheckMethod<SkillMethodData> {
    override get kind(): "SKILL" {
        return "SKILL";
    }
    get skill(): SkillKey {
        return this.data.skill;
    }
}

export class ToolMethod extends CheckMethod<ToolMethodData> {
    override get kind(): "TOOL" {
        return "TOOL";
    }
    get tool(): string {
        return this.data.tool;
    }
    get fallback(): ToolFallback | null {
        return this.data.fallback;
    }
}

export class FixedMethod extends Method<FixedMethodData> {
    override get kind(): "FIXED" {
        return "FIXED";
    }
    get effect(): BandEffect {
        return this.data.effect;
    }
    get countsAs(): CountsAs {
        return this.data.countsAs;
    }
}

export class ManualMethod extends Method<ManualMethodData> {
    override get kind(): "MANUAL" {
        return "MANUAL";
    }
    get gmOnly(): boolean {
        return this.data.gmOnly;
    }
}

export class MacroMethod extends Method<MacroMethodData> {
    override get kind(): "MACRO" {
        return "MACRO";
    }
    get macroUuid(): string {
        return this.data.macroUuid;
    }
    get macroName(): string | null {
        return this.data.macroName;
    }
    get results(): ResultTable | null {
        return this.data.results;
    }
}

export type AnyMethod =
    | AbilityMethod
    | SkillMethod
    | ToolMethod
    | FixedMethod
    | ManualMethod
    | MacroMethod;

export function createMethod(
    item: TrackedItem,
    data: Readonly<MethodData>,
    ctx: DomainContext,
): AnyMethod {
    switch (data.kind) {
        case "ABILITY":
            return new AbilityMethod(item, data, ctx);
        case "SKILL":
            return new SkillMethod(item, data, ctx);
        case "TOOL":
            return new ToolMethod(item, data, ctx);
        case "FIXED":
            return new FixedMethod(item, data, ctx);
        case "MANUAL":
            return new ManualMethod(item, data, ctx);
        case "MACRO":
            return new MacroMethod(item, data, ctx);
    }
}

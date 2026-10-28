/** What the command executor needs from its host: effects, actor lookups, formulas, the clock. */
import type { Id, MilestoneAction, StoreRef, TrackedItemData } from "../data";
import type { ActorView } from "../actors";
import type { FormulaEvaluator } from "../rolls";
import type { Translate } from "../i18n";
import type { StoreBackend } from "./backend";

/** The verified sender (from the query context, never from the payload). */
export interface CommandUser {
    id: string;
    name: string;
    isGM: boolean;
}

export interface ActionExecutionContext {
    store: StoreRef;
    item: TrackedItemData;
    milestoneId: Id;
    action: MilestoneAction;
    /** Acting actor of the progress change that fired the milestone. */
    triggeringActorUuid: string | null;
}

/** Foundry side effects of milestone actions and reverts. */
export interface ActionEffects {
    /** Returns the uuids of created documents. */
    grantItem(
        sourceUuid: string,
        quantity: number,
        actorUuid: string,
    ): Promise<string[]>;
    applyEffect(sourceUuid: string, actorUuid: string): Promise<string[]>;
    announce(
        message: string | null,
        audience: "WORLD_DEFAULT" | "PUBLIC" | "GM",
        ctx: ActionExecutionContext,
    ): Promise<void>;
    runMacro(
        macroUuid: string,
        ctx: ActionExecutionContext & { undo: boolean },
    ): Promise<void>;
    deleteDocuments(uuids: string[]): Promise<void>;
}

/** Async: actors may have to be loaded from a compendium. */
export interface ActorLookup {
    exists(uuid: string): Promise<boolean>;
    name(uuid: string): Promise<string | null>;
    isOwner(uuid: string, userId: string): Promise<boolean>;
    view(uuid: string): Promise<ActorView | null>;
    rollData(uuid: string): Promise<Record<string, unknown>>;
}

export interface CommandEnv {
    stores: StoreBackend;
    effects: ActionEffects;
    actors: ActorLookup;
    evaluateFormula: FormulaEvaluator;
    /** World setting `milestoneApprovalDefault`. */
    approvalDefault: () => "AUTO" | "GM";
    now: () => number;
    randomId: () => string;
    t: Translate;
}

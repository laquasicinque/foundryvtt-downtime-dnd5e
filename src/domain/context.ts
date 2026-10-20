import type { Command, CommandResult } from "../types/commands";
import type { NameLookup } from "../model/rules/contributor";
import type { RequirementLabels } from "../model/rules/requirements";
import type { ActorView } from "../types/actors";
import type { Contributor, Id, StoreRef, TrackedItemData } from "../types/data";
import type { Translate } from "../types/i18n";
import { resolveText } from "../lib/text";
import { DowntimeError } from "./DowntimeError";
import type { TrackedItem } from "./TrackedItem";
import { getOrInsertComputed } from "../lib/collections";

/**
 * What the domain classes need from the runtime. Injected so the classes stay
 * testable; the Foundry implementation lives in the runtime layer.
 */
export interface DomainContext {
    /** Send a command to the GM (or run it locally when this client is the GM). */
    dispatch: (command: Command) => Promise<CommandResult>;
    /** A fresh instance from the store, after a write. */
    load: (store: StoreRef, itemId: Id) => Promise<TrackedItem | null>;
    /** Items of another store, for resolving references. null when unavailable. */
    storeTrackedItems: (store: StoreRef) => readonly TrackedItemData[] | null;
    actorView: (actorUuid: string) => ActorView | null;
    names: NameLookup;
    currentUser: () => { id: string; name: string; isGM: boolean };
    t: Translate;
    /** Labels for requirement descriptions (default hints). Raw keys when absent. */
    requirementLabels?: Omit<RequirementLabels, "t">;
}

export async function dispatchOrThrow(ctx: DomainContext, command: Command) {
    const result = await ctx.dispatch(command);
    if (!result.ok)
        throw new DowntimeError(
            result.error.code,
            resolveText(result.error.message, ctx.t) ?? "",
            result.error.details,
        );
    return result;
}

export function contributorFor(
    ctx: DomainContext,
    actorUuid: string | null,
): Contributor {
    const user = ctx.currentUser();
    return {
        actorUuid,
        actorName: actorUuid ? (ctx.names.actorName(actorUuid) ?? null) : null,
        userId: user.id,
        userName: user.name,
        userWasGM: user.isGM,
    };
}

/** Deep-freeze plain data in place. */
export function deepFreeze<T>(value: T): Readonly<T> {
    if (
        typeof value === "object" &&
        value !== null &&
        !Object.isFrozen(value)
    ) {
        Object.freeze(value);
        for (const child of Object.values(value)) deepFreeze(child);
    }
    return value;
}

/** Memoise a getter's result per instance. */
export function memo<T>(
    cache: Map<string, unknown>,
    key: string,
    compute: () => T,
): T {
    return getOrInsertComputed(cache, key, compute) as T;
}

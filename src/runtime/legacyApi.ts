/**
 * The deprecated, name-based V1 API, on top of V3. Writes are
 * `SET { reason: "API" }` (the V1 functions set an absolute value); getters
 * return the V1-shaped projection. Each logs a one-time deprecation warning.
 */
import { Logger } from "../foundry/Logger";
import type { LegacyTrackedItemView } from "../model/storage/legacy";
import type { CategoryData, StoreRef } from "../types/data";
import { WORLD_STORE } from "../model/storage/stores";
import { findActorSync } from "../foundry/actors";
import { localize } from "../foundry/i18n";
import { parseFinite } from "../lib/values";
import { getCategoriesSync, getTrackedItemsSync } from "./api";

const warned = new Set<string>();
/** For module and macro authors, so in English like the rest of the console. */
function deprecated(name: string, replacement: string) {
    if (warned.has(name)) return;
    warned.add(name);
    Logger.warn(
        `api.${name} is deprecated; use api.${replacement} (items are found by id there, not name).`,
    );
}

/*
 * V1's getters were synchronous, so these read from memory: a compendium
 * actor's items are only found while it's loaded.
 */

/** V1 took an Actor, a uuid, an id or (discouraged) a name. */
function actorStore(actor: Downtime.ActorResolvable): StoreRef | null {
    const found = typeof actor === "string" ? findActorSync(actor) : actor;
    if (!found?.uuid) {
        Logger.warn(
            localize("downtime-dnd5e.Effect.ActorNotFound", {
                uuid: typeof actor === "string" ? actor : (actor.name ?? ""),
            }),
            true,
        );
        return null;
    }
    return { kind: "ACTOR", actorUuid: found.uuid };
}

function byName(store: StoreRef, name: string) {
    const item = getTrackedItemsSync(store).find((i) => i.name === name);
    if (!item)
        Logger.warn(
            localize("downtime-dnd5e.Legacy.ItemNotFound", { name }),
            true,
        );
    return item ?? null;
}

async function setByName(
    store: StoreRef | null,
    name: string,
    progress: number | string,
) {
    if (!store) return;
    const value = parseFinite(progress);
    if (value === null) {
        Logger.warn(localize("downtime-dnd5e.Legacy.ProgressNotNumber"), true);
        return;
    }
    const item = byName(store, name);
    if (!item) return;
    try {
        await item.set(value, { reason: "API" });
    } catch (error) {
        Logger.warn(
            localize("downtime-dnd5e.Notify.ItemError", {
                item: name,
                error: error instanceof Error ? error.message : String(error),
            }),
            true,
        );
    }
}

const getActivities = (
    actor: Downtime.ActorResolvable,
): LegacyTrackedItemView[] => {
    const store = actorStore(actor);
    return store ? getTrackedItemsSync(store).map((i) => i.toV1()) : [];
};

const updateActivity = (
    actor: Downtime.ActorResolvable,
    name: string,
    progress: number | string,
) => setByName(actorStore(actor), name, progress);

const updateWorldActivity = (name: string, progress: number | string) =>
    setByName(WORLD_STORE, name, progress);

export const legacyApi = {
    /** @deprecated Use `set(store, itemId, value, { reason: "API" })`. */
    updateActivity(
        actor: Downtime.ActorResolvable,
        name: string,
        progress: number | string,
    ) {
        deprecated("updateActivity", "set(store, itemId, value)");
        return updateActivity(actor, name, progress);
    },
    /** @deprecated Use `set(store, itemId, value, { reason: "API" })`. */
    updateActivityProgress(
        actor: Downtime.ActorResolvable,
        name: string,
        progress: number | string,
    ) {
        deprecated("updateActivityProgress", "set(store, itemId, value)");
        return updateActivity(actor, name, progress);
    },
    /** @deprecated Use `getItems(actor)`. */
    getActivities(actor: Downtime.ActorResolvable) {
        deprecated("getActivities", "getItems(store)");
        return getActivities(actor);
    },
    /** @deprecated Use `getItems(actor)`. */
    getActivitiesForActor(actor: Downtime.ActorResolvable) {
        deprecated("getActivitiesForActor", "getItems(store)");
        return getActivities(actor);
    },
    /** @deprecated Use `getItem(actor, itemId)`. */
    getActivity(actor: Downtime.ActorResolvable, name: string) {
        deprecated("getActivity", "getItem(store, itemId)");
        const store = actorStore(actor);
        return store ? byName(store, name)?.toV1() : undefined;
    },
    /** @deprecated Use `set("world", itemId, value)`. */
    updateWorldActivity(name: string, progress: number | string) {
        deprecated("updateWorldActivity", 'set("world", itemId, value)');
        return updateWorldActivity(name, progress);
    },
    /** @deprecated Use `set("world", itemId, value)`. */
    updateWorldActivityProgress(name: string, progress: number | string) {
        deprecated(
            "updateWorldActivityProgress",
            'set("world", itemId, value)',
        );
        return updateWorldActivity(name, progress);
    },
    /** @deprecated Use `getItems("world")`. */
    getWorldActivities(): LegacyTrackedItemView[] {
        deprecated("getWorldActivities", 'getItems("world")');
        return getTrackedItemsSync(WORLD_STORE).map((i) => i.toV1());
    },
    /** @deprecated Use `getItem("world", itemId)`. */
    getWorldActivity(name: string) {
        deprecated("getWorldActivity", 'getItem("world", itemId)');
        return byName(WORLD_STORE, name)?.toV1();
    },
    /** @deprecated Use `getCategories("world")`. */
    getWorldCategories(): CategoryData[] {
        deprecated("getWorldCategories", 'getCategories("world")');
        return getCategoriesSync(WORLD_STORE).map((c) => c.toJSON());
    },
};

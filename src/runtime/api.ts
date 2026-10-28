/**
 * V3 public API, exposed as `game.modules.get("downtime-dnd5e").api.v3`.
 */
import * as domain from "../domain";
import { Category } from "../domain/Category";
import type { DomainContext } from "../domain/context";
import type { NameLookup } from "../model/rules/contributor";
import { TrackedItem } from "../domain/TrackedItem";
import type { Command, CommandResult, StoreSnapshot } from "../types/commands";
import type { CategoryData, Id, StoreRef } from "../types/data";
import { WORLD_STORE } from "../model/storage/stores";
import { activityAdapters } from "../dnd5e/activityAdapters";
import { actorView } from "../dnd5e/actors";
import { abilityLabel, skillLabel, toolLabel } from "../dnd5e/config";
import {
    type Actor,
    actorById,
    actorFromUuid,
    actorFromUuidSync,
    isActor,
} from "../foundry/actors";
import {
    currentUserId,
    currentUserName,
    isGM,
    userName,
} from "../foundry/users";
import { localize, localizeText } from "../foundry/i18n";
import { randomId } from "../foundry/utils";
import { runMigration } from "./migration";
import { dispatch } from "./relay";
import { readStore, readStoreSync } from "./stores";
import { downloadExport, exportStore, importIntoStore } from "./exchange";
import { planTransfer, type TransferPlan } from "../model/storage/transfer";
import type { TransferChoices, TransferMode } from "../types/transfer";

/** A StoreRef, an Actor, an actor uuid/id, or "world". */
export type StoreResolvable = StoreRef | Actor | string;

function storeRef(
    store: StoreResolvable,
    actorFromString: (key: string) => Actor | null,
): StoreRef {
    if (store === "world") return WORLD_STORE;
    if (typeof store === "string") {
        const actor = actorFromString(store);
        if (!actor)
            throw new Error(
                localize("downtime-dnd5e.Effect.ActorNotFound", {
                    uuid: store,
                }),
            );
        return { kind: "ACTOR", actorUuid: actor.uuid! };
    }
    if (isActor(store)) return { kind: "ACTOR", actorUuid: store.uuid! };
    return store as StoreRef;
}

/** Accepts a StoreRef, "world", an Actor, or an actor uuid/id (loading a compendium actor if needed). */
export async function resolveStore(store: StoreResolvable): Promise<StoreRef> {
    const actor =
        typeof store === "string" && store !== "world"
            ? ((await actorFromUuid(store)) ?? actorById(store))
            : null;
    return storeRef(store, () => actor);
}

/** `resolveStore` from memory only (see `actorFromUuidSync`). */
export function resolveStoreSync(store: StoreResolvable): StoreRef {
    return storeRef(store, (key) => actorFromUuidSync(key) ?? actorById(key));
}

/** Contributors' current names; the name stored with an event is the fallback. */
export const contributorNames: NameLookup = {
    actorName: (uuid) => actorFromUuidSync(uuid)?.name ?? null,
    userName,
    unknown: () => localize("COMMON.Unknown"),
};

/**
 * The domain classes read synchronously. Their own store was read just
 * before they were created, so its actor is in memory; other stores they
 * reference resolve the same way, or read as unavailable.
 */
export const domainContext: DomainContext = {
    dispatch,
    load: async (store, itemId) => getTrackedItem(store, itemId),
    storeTrackedItems: (store) => readStoreSync(store)?.items ?? null,
    actorView: (uuid) => {
        const actor = actorFromUuidSync(uuid);
        return actor ? actorView(actor) : null;
    },
    names: contributorNames,
    currentUser: () => ({
        id: currentUserId(),
        name: currentUserName(),
        isGM: isGM(),
    }),
    t: localize,
    requirementLabels: {
        skill: skillLabel,
        ability: abilityLabel,
        tool: toolLabel,
    },
};

const trackedItems = (ref: StoreRef, snapshot: StoreSnapshot | null) =>
    (snapshot?.items ?? []).map(
        (data) => new TrackedItem(data, ref, domainContext),
    );

const trackedItem = (
    ref: StoreRef,
    snapshot: StoreSnapshot | null,
    itemId: Id,
) => {
    const data = snapshot?.items.find((item) => item.id === itemId);
    return data ? new TrackedItem(data, ref, domainContext) : null;
};

const categories = (ref: StoreRef, snapshot: StoreSnapshot | null) =>
    (snapshot?.categories ?? []).map((data) => new Category(data, ref));

export async function getTrackedItems(
    store: StoreResolvable,
): Promise<TrackedItem[]> {
    const ref = await resolveStore(store);
    return trackedItems(ref, await readStore(ref));
}

/** `getTrackedItems` from memory only (see `readStoreSync`). */
export function getTrackedItemsSync(store: StoreResolvable): TrackedItem[] {
    const ref = resolveStoreSync(store);
    return trackedItems(ref, readStoreSync(ref));
}

export async function getTrackedItem(
    store: StoreResolvable,
    itemId: Id,
): Promise<TrackedItem | null> {
    const ref = await resolveStore(store);
    return trackedItem(ref, await readStore(ref), itemId);
}

/** `getTrackedItem` from memory only (see `readStoreSync`). */
export function getTrackedItemSync(
    store: StoreResolvable,
    itemId: Id,
): TrackedItem | null {
    const ref = resolveStoreSync(store);
    return trackedItem(ref, readStoreSync(ref), itemId);
}

export async function getCategories(
    store: StoreResolvable,
): Promise<Category[]> {
    const ref = await resolveStore(store);
    return categories(ref, await readStore(ref));
}

/** `getCategories` from memory only (see `readStoreSync`). */
export function getCategoriesSync(store: StoreResolvable): Category[] {
    const ref = resolveStoreSync(store);
    return categories(ref, readStoreSync(ref));
}

async function send(command: Command): Promise<CommandResult> {
    const result = await dispatch(command);
    if (!result.ok)
        throw new domain.DowntimeError(
            result.error.code,
            localizeText(result.error.message),
            result.error.details,
        );
    return result;
}

interface ReadStore {
    ref: StoreRef;
    snapshot: StoreSnapshot | null;
}

function transferPlan(
    source: ReadStore,
    dest: ReadStore,
    itemIds: Id[],
    mode: TransferMode,
    choices: TransferChoices,
): TransferPlan {
    return planTransfer(
        {
            mode,
            source: source.ref,
            dest: dest.ref,
            sourceItems: source.snapshot?.items ?? [],
            sourceCategories: source.snapshot?.categories ?? [],
            destItems: dest.snapshot?.items ?? [],
            destCategories: dest.snapshot?.categories ?? [],
            worldItems:
                source.ref.kind === "WORLD" || dest.ref.kind === "WORLD"
                    ? null
                    : (readStoreSync(WORLD_STORE)?.items ?? null),
            itemIds,
        },
        choices,
        randomId,
    );
}

/** The item, or a NOT_FOUND error. */
async function requireTrackedItem(
    store: StoreResolvable,
    itemId: Id,
): Promise<TrackedItem> {
    const item = await getTrackedItem(store, itemId);
    if (!item)
        throw new domain.DowntimeError(
            "NOT_FOUND",
            localize("downtime-dnd5e.Error.ItemNotFound", { id: itemId }),
        );
    return item;
}

export const v3Api = {
    getItems: getTrackedItems,
    /** `getItems` without loading: only actors already in memory (world and token actors always; compendium actors only while loaded). */
    getItemsSync: getTrackedItemsSync,
    getItem: getTrackedItem,
    /** `getItem` without loading (see `getItemsSync`). */
    getItemSync: getTrackedItemSync,
    /**
     * Use a method with an already-made roll / amount / macro result (no
     * dialogs). `actor` is the acting actor for world items.
     */
    async useMethod(
        store: StoreResolvable,
        itemId: Id,
        methodId: Id,
        options: Parameters<domain.AnyMethod["use"]>[0] = {},
    ): Promise<TrackedItem> {
        const method = (await requireTrackedItem(store, itemId)).method(
            methodId,
        );
        if (!method)
            throw new domain.DowntimeError(
                "NOT_FOUND",
                localize("downtime-dnd5e.Error.MethodNotFound", {
                    id: methodId,
                }),
            );
        const { item, eventId } = await method.useWithEvent(options);
        if (eventId) {
            const { announceMethodUsed } = await import("./methodUse");
            announceMethodUsed(item, eventId);
        }
        return item;
    },
    /** GM: change progress by `delta`. */
    adjust: async (
        store: StoreResolvable,
        itemId: Id,
        delta: number,
        options?: { note?: string | null },
    ) => (await requireTrackedItem(store, itemId)).adjust(delta, options),
    /** GM (or the owner, for reason "API"): set progress to `value`. */
    set: async (
        store: StoreResolvable,
        itemId: Id,
        value: number,
        options?: { note?: string | null; reason?: "MANUAL" | "API" },
    ) => (await requireTrackedItem(store, itemId)).set(value, options),
    /** GM: revert the latest change (history is a stack). */
    revert: async (store: StoreResolvable, itemId: Id) =>
        (await requireTrackedItem(store, itemId)).revertLatest(),
    /** Contribution breakdown. */
    getContributions: async (
        store: StoreResolvable,
        itemId: Id,
        options?: Parameters<TrackedItem["contributions"]>[0],
    ) => (await requireTrackedItem(store, itemId)).contributions(options),
    /** The world's items. Always in memory, so this one is synchronous. */
    getWorldItems: () => getTrackedItemsSync("world"),
    getCategories,
    /** `getCategories` without loading (see `getItemsSync`). */
    getCategoriesSync,

    /** GM: create a tracked item from (partial) data. Resolves to the new item. */
    async createItem(
        store: StoreResolvable,
        data: unknown,
    ): Promise<TrackedItem | null> {
        const ref = await resolveStore(store);
        const result = await send({ type: "CREATE_ITEM", store: ref, data });
        return result.ok && result.itemId
            ? getTrackedItem(ref, result.itemId)
            : null;
    },
    /** GM: replace a store's categories. */
    async setCategories(
        store: StoreResolvable,
        categories: CategoryData[],
    ): Promise<void> {
        await send({
            type: "SET_CATEGORIES",
            store: await resolveStore(store),
            categories,
        });
    },
    /** GM: reorder a store's items. */
    async reorderItems(store: StoreResolvable, order: Id[]): Promise<void> {
        await send({
            type: "REORDER_ITEMS",
            store: await resolveStore(store),
            order,
        });
    },

    /**
     * What moving/copying `itemIds` from `source` to `dest` would do:
     * the items that go along, reference problems and their choices,
     * categories. Pure preview; nothing is written.
     */
    async previewTransfer(
        source: StoreResolvable,
        itemIds: Id[],
        dest: StoreResolvable,
        mode: TransferMode,
        choices: TransferChoices = {},
    ): Promise<TransferPlan> {
        const from = await resolveStore(source);
        const to = await resolveStore(dest);
        return transferPlan(
            { ref: from, snapshot: await readStore(from) },
            { ref: to, snapshot: await readStore(to) },
            itemIds,
            mode,
            choices,
        );
    },
    /** `previewTransfer` without loading (see `getItemsSync`). */
    previewTransferSync(
        source: StoreResolvable,
        itemIds: Id[],
        dest: StoreResolvable,
        mode: TransferMode,
        choices: TransferChoices = {},
    ): TransferPlan {
        const from = resolveStoreSync(source);
        const to = resolveStoreSync(dest);
        return transferPlan(
            { ref: from, snapshot: readStoreSync(from) },
            { ref: to, snapshot: readStoreSync(to) },
            itemIds,
            mode,
            choices,
        );
    },
    /**
     * GM: move or copy items between stores, applying `choices` to the
     * plan's issues (defaults: take dependencies along, switch owning-actor
     * recipients, create missing categories). Resolves to source id →
     * destination id.
     */
    async transfer(
        source: StoreResolvable,
        itemIds: Id[],
        dest: StoreResolvable,
        mode: TransferMode,
        choices: TransferChoices = {},
    ): Promise<Record<Id, Id>> {
        const result = await send({
            type: "TRANSFER",
            store: await resolveStore(source),
            dest: await resolveStore(dest),
            mode,
            itemIds,
            choices,
        });
        return result.ok ? (result.transferred ?? {}) : {};
    },

    /** The store as a V3 export file (data only; see `downloadExport`). */
    exportStore: async (store: StoreResolvable) =>
        exportStore(await resolveStore(store)),
    /** Download the store as a V3 export file. */
    downloadExport: async (store: StoreResolvable) =>
        downloadExport(await resolveStore(store)),
    /** GM: add items from an export file's parsed JSON (V3 or V1). */
    importData: async (store: StoreResolvable, data: unknown) =>
        importIntoStore(await resolveStore(store), data),

    /** Low-level: send a raw command. */
    dispatch,
    /** GM: add sample downtimes covering each feature to an actor and the world (idempotent). */
    async createSampleDowntimes(actor: StoreResolvable) {
        const { createSampleDowntimes } = await import("./samples");
        return createSampleDowntimes(actor);
    },
    /** GM: re-run the (idempotent) V1 → V3 migration. */
    migrate: runMigration,
    /** Activity roll adapters: register(adapter), unregister(type), get(type). */
    activityAdapters,
    /** Classes, for `instanceof` checks. */
    classes: { ...domain },
};

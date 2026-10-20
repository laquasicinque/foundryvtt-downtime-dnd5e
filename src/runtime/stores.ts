/**
 * Foundry store backends.
 *
 * - Actor store: `flags["downtime-dnd5e"].store` (items keyed by id, history keyed by event id).
 * - World store: a module-owned JournalEntry, one page per tracked item.
 *
 * Reads are cached per document modification time. `readStore` loads a
 * compendium actor first; `readStoreSync` only sees actors already in memory. Writes translate `diffTrackedItem` ops into dotted update paths
 * (deletions through `deleteInUpdate`).
 */
import { CONSTANTS } from "../constants";
import type {
    StoreBackend,
    StoreCommit,
    StoreSnapshot,
} from "../types/commands";
import {
    decodeActorCollection,
    decodeCategories,
    decodeTrackedItems,
    diffTrackedItem,
    encodeTrackedItem,
    orderTrackedItems,
    type StorageOp,
} from "../model/storage/storage";
import type { CategoryData, StoreRef, TrackedItemData } from "../types/data";
import { CommandError, localized } from "../model/commands/CommandError";
import { SCHEMA_VERSION } from "../model/storage/schema";
import {
    type Actor,
    actorFlags,
    actorFromUuid,
    actorFromUuidSync,
    baseActor,
    isTokenActor,
} from "../foundry/actors";
import {
    createEmbedded,
    deleteEmbedded,
    deleteInUpdate,
    inLockedCompendium,
    modifiedTime,
    updateDocument,
    updateEmbedded,
} from "../foundry/documents";
import {
    createJournal,
    findJournal,
    journalById,
    journalFlag,
    journalPages,
    ownership,
    type JournalEntry,
    type JournalEntryPage,
} from "../foundry/journals";
import { localize } from "../foundry/i18n";
import { getSetting, setSetting } from "../foundry/settings";
import { getProperty, randomId } from "../foundry/utils";
import {
    actorCollection,
    hasOwnV3Store,
    legacyActorData,
    migrateV1Data,
    ownModuleFlags,
    storeFlagKey,
} from "./migration";
import { getOrInsertComputed } from "../lib/collections";

const MODULE_ID = CONSTANTS.MODULE_ID;
const PAGE_ITEM_PATH = `flags.${MODULE_ID}.${CONSTANTS.FLAGS.item}` as const;
const JOURNAL_STORE_PATH =
    `flags.${MODULE_ID}.${CONSTANTS.FLAGS.worldStore}` as const;

function applyOps(
    update: Record<string, unknown>,
    prefix: string,
    ops: StorageOp[],
) {
    for (const op of ops) {
        const key =
            op.path.length > 0 ? `${prefix}.${op.path.join(".")}` : prefix;
        if (op.kind === "set") update[key] = op.value;
        else deleteInUpdate(update, key);
    }
}

const cache = new Map<string, { stamp: string; snapshot: StoreSnapshot }>();

function cached(
    key: string,
    stamp: string,
    compute: () => StoreSnapshot,
): StoreSnapshot {
    const hit = cache.get(key);
    if (hit?.stamp === stamp) return hit.snapshot;
    const snapshot = compute();
    cache.set(key, { stamp, snapshot });
    return snapshot;
}

// ── Actor store ──────────────────────────────────────────────────────────────

/** FNV-1a; only used to detect changes to a token's own flags. */
function quickHash(text: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
}

/**
 * Cache stamp for an actor's store. Token actors don't get a new modifiedTime
 * when their delta changes, so for them the stamp combines the base actor's
 * modifiedTime (inherited data) with a hash of the token's own module flags.
 */

function actorStamp(actor: Actor): string {
    const own = String(modifiedTime(actor));
    if (!isTokenActor(actor)) return own;
    const base = baseActor(actor);
    return `${base ? modifiedTime(base) : 0}|${quickHash(JSON.stringify(ownModuleFlags(actor) ?? null))}`;
}

function readActorStore(actor: Actor | null): StoreSnapshot | null {
    if (!actor) return null;
    const stamp = actorStamp(actor);
    return cached(`actor:${actor.uuid}`, stamp, () => {
        // V1 data of the actor's own that isn't migrated yet (e.g. an unlinked token's delta):
        // migrate in memory; the first write persists it. Checked before the merged store,
        // which a token inherits from its base actor.
        const legacy = legacyActorData(actor);
        if (legacy) {
            const report = migrateV1Data(
                legacy.items,
                legacy.categories,
                actor,
            );
            return {
                items: report.items,
                categories: report.categories,
                order: report.items.map((i) => i.id),
            };
        }
        const flags = actorFlags(actor, MODULE_ID);
        // A token without a store of its own inherits its base actor's.
        const raw =
            flags?.[storeFlagKey(actor)] ??
            (isTokenActor(actor) ? flags?.[CONSTANTS.FLAGS.store] : undefined);
        if (raw) {
            const decoded = decodeActorCollection(raw, randomId, localize);
            return {
                items: decoded.items,
                categories: decoded.categories,
                order: decoded.items.map((i) => i.id),
            };
        }
        return { items: [], categories: [], order: [] };
    });
}

async function commitActorStore(
    actor: Actor,
    commit: StoreCommit,
    snapshot: StoreSnapshot,
) {
    const ACTOR_STORE_PATH = `flags.${MODULE_ID}.${storeFlagKey(actor)}`;
    if (!hasOwnV3Store(actor)) {
        // First V3 write for this actor (or token delta): persist the whole collection.
        const items = new Map(snapshot.items.map((i) => [i.id, i]));
        for (const { before, after } of commit.items) {
            if (after) items.set(after.id, after);
            else if (before) items.delete(before.id);
        }
        const ordered = orderTrackedItems(
            [...items.values()],
            commit.order ?? snapshot.order,
        );
        await updateDocument(actor, {
            [ACTOR_STORE_PATH]: actorCollection({
                items: ordered,
                categories: commit.categories ?? snapshot.categories,
                issues: [],
            }),
        });
        return;
    }

    const update: Record<string, unknown> = {};
    for (const { before, after } of commit.items) {
        const id = (after ?? before)!.id;
        const prefix = `${ACTOR_STORE_PATH}.items.${id}`;
        if (!after) deleteInUpdate(update, prefix);
        else applyOps(update, prefix, diffTrackedItem(before, after));
    }
    if (commit.order) update[`${ACTOR_STORE_PATH}.order`] = commit.order;
    if (commit.categories)
        update[`${ACTOR_STORE_PATH}.categories`] = commit.categories;
    if (Object.keys(update).length > 0) {
        update[`${ACTOR_STORE_PATH}.schemaVersion`] = SCHEMA_VERSION;
        await updateDocument(actor, update);
    }
}

// ── World store (journal) ────────────────────────────────────────────────────

function isWorldJournal(
    journal: JournalEntry | undefined | null,
): journal is JournalEntry {
    return (
        !!journal &&
        journalFlag(journal, MODULE_ID, CONSTANTS.FLAGS.worldStore) !==
            undefined
    );
}

export function getWorldJournal(): JournalEntry | null {
    const id = getSetting(CONSTANTS.SETTINGS.worldJournalId);
    const byId = id ? journalById(id) : null;
    if (isWorldJournal(byId)) return byId;
    return findJournal(isWorldJournal);
}

function pageTrackedItemData(page: JournalEntryPage): unknown {
    return getProperty(page, PAGE_ITEM_PATH);
}

function pageFor(item: TrackedItemData, sort: number) {
    return {
        name: item.name,
        type: "text",
        text: { content: "" },
        sort,
        ownership: ownership(item.hidden ? "NONE" : "INHERIT"),
        flags: {
            [MODULE_ID]: { [CONSTANTS.FLAGS.item]: encodeTrackedItem(item) },
        },
    };
}

/** GM only. Creates the world journal, optionally seeded (migration). */
export async function createWorldJournal(
    items: TrackedItemData[] = [],
    categories: CategoryData[] = [],
): Promise<JournalEntry> {
    const journal = await createJournal({
        name: localize("downtime-dnd5e.Tab.Title"),
        ownership: ownership("OBSERVER"),
        flags: {
            [MODULE_ID]: {
                [CONSTANTS.FLAGS.worldStore]: {
                    schemaVersion: SCHEMA_VERSION,
                    categories,
                },
            },
        },
        pages: items.map((item, index) => pageFor(item, (index + 1) * 100)),
    });
    await setSetting(CONSTANTS.SETTINGS.worldJournalId, journal.id);
    return journal;
}

function readWorldStore(): StoreSnapshot | null {
    const journal = getWorldJournal();
    if (!journal) return null;
    const pages = journalPages(journal).sort((a, b) => a.sort - b.sort);
    const stamp = [
        String(modifiedTime(journal)),
        ...pages.map((p) => `${p.id}@${modifiedTime(p)}`),
    ].join("|");
    return cached("world", stamp, () => {
        const entries: [string, unknown][] = pages.flatMap((page) => {
            const data = pageTrackedItemData(page);
            if (!data) return [];
            const id =
                typeof (data as { id?: unknown }).id === "string"
                    ? (data as { id: string }).id
                    : page.id;
            return [[id, data]];
        });
        const decoded = decodeTrackedItems(entries, randomId, localize);
        const store = getProperty(journal, JOURNAL_STORE_PATH) as
            | { categories?: unknown }
            | undefined;
        return {
            items: decoded.items,
            categories: decodeCategories(store?.categories, randomId, localize),
            order: decoded.items.map((i) => i.id),
        };
    });
}

async function commitWorldStore(commit: StoreCommit) {
    const journal = getWorldJournal() ?? (await createWorldJournal());
    const pages = journalPages(journal);
    const pageByItem = new Map<string, JournalEntryPage>();
    for (const page of pages) {
        const data = pageTrackedItemData(page) as { id?: string } | undefined;
        if (data?.id) pageByItem.set(data.id, page);
    }
    const sortFor = (id: string, fallback: number) => {
        const index = commit.order?.indexOf(id) ?? -1;
        return index >= 0 ? (index + 1) * 100 : fallback;
    };

    const creates: object[] = [];
    const updates = new Map<string, Record<string, unknown>>();
    const deletes: string[] = [];
    const updateFor = (page: JournalEntryPage) =>
        getOrInsertComputed(updates, page.id, (id) => ({ _id: id }));
    const maxSort = pages.reduce((max, p) => Math.max(max, p.sort), 0);

    for (const { before, after } of commit.items) {
        const id = (after ?? before)!.id;
        const page = pageByItem.get(id);
        if (!after) {
            if (page) deletes.push(page.id);
            continue;
        }
        if (!page) {
            creates.push(
                pageFor(
                    after,
                    sortFor(id, maxSort + (creates.length + 1) * 100),
                ),
            );
            continue;
        }
        const update = updateFor(page);
        applyOps(update, PAGE_ITEM_PATH, diffTrackedItem(before, after));
        if (before?.name !== after.name) update.name = after.name;
        if (before?.hidden !== after.hidden) {
            update.ownership = ownership(after.hidden ? "NONE" : "INHERIT");
        }
    }
    if (commit.order) {
        for (const [itemId, page] of pageByItem) {
            const sort = sortFor(itemId, page.sort);
            if (sort !== page.sort) updateFor(page).sort = sort;
        }
    }

    if (deletes.length)
        await deleteEmbedded(journal, "JournalEntryPage", deletes);
    if (updates.size)
        await updateEmbedded(journal, "JournalEntryPage", [
            ...updates.values(),
        ]);
    if (creates.length)
        await createEmbedded(journal, "JournalEntryPage", creates);
    if (commit.categories)
        await updateDocument(journal, {
            [`${JOURNAL_STORE_PATH}.categories`]: commit.categories,
        });
}

// ── Public ───────────────────────────────────────────────────────────────────

/** A store's contents (loading a compendium actor if needed). null when the store doesn't exist. */
export async function readStore(
    store: StoreRef,
): Promise<StoreSnapshot | null> {
    return store.kind === "WORLD"
        ? readWorldStore()
        : readActorStore(await actorFromUuid(store.actorUuid));
}

/**
 * `readStore` from memory only: null for a compendium actor that isn't
 * loaded (see `actorFromUuidSync`). The world store is always in memory.
 */
export function readStoreSync(store: StoreRef): StoreSnapshot | null {
    return store.kind === "WORLD"
        ? readWorldStore()
        : readActorStore(actorFromUuidSync(store.actorUuid));
}

/** Backend used by the GM command executor. */
export const foundryStores: StoreBackend = {
    async load(store) {
        if (store.kind === "WORLD")
            return readWorldStore() ?? { items: [], categories: [], order: [] };
        const actor = await actorFromUuid(store.actorUuid);
        const snapshot = readActorStore(actor);
        return snapshot && actor && inLockedCompendium(actor)
            ? {
                  ...snapshot,
                  readOnly: localized("downtime-dnd5e.Error.LockedCompendium", {
                      actor: actor.name ?? "",
                  }),
              }
            : snapshot;
    },
    async commit(store, commit) {
        if (store.kind === "WORLD") await commitWorldStore(commit);
        else {
            const actor = await actorFromUuid(store.actorUuid);
            if (!actor)
                throw new CommandError(
                    "NOT_FOUND",
                    localized("downtime-dnd5e.Effect.ActorNotFound", {
                        uuid: store.actorUuid,
                    }),
                );
            const snapshot = readActorStore(actor) ?? {
                items: [],
                categories: [],
                order: [],
            };
            await commitActorStore(actor, commit, snapshot);
        }
        cache.delete(
            store.kind === "WORLD" ? "world" : `actor:${store.actorUuid}`,
        );
    },
};

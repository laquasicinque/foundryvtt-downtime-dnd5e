/**
 * GM repair tool backend: what the normaliser had to
 * repair or set aside in each store, and admin writes that work on the raw
 * stored data (so they can fix what the command pipeline can't load).
 * GM client only; these bypass the command queue on purpose.
 */
import { Iter } from "it-al";
import { CONSTANTS } from "../constants";
import {
    decodeActorCollection,
    decodeTrackedItems,
    encodeTrackedItem,
} from "../model/storage/storage";
import type {
    QuarantinedRecord,
    StoreRef,
    TrackedItemData,
} from "../types/data";
import { type Actor, actorFromUuid, worldActors } from "../foundry/actors";
import { deleteAt, deleteDocument, updateDocument } from "../foundry/documents";
import { journalPages, type JournalEntryPage } from "../foundry/journals";
import { localize, localizeText } from "../foundry/i18n";
import { getSetting, setSetting } from "../foundry/settings";
import { isActiveGM, isGM } from "../foundry/users";
import { getProperty, randomId } from "../foundry/utils";
import {
    legacyActorData,
    ownModuleFlags,
    runMigration,
    storeFlagKey,
} from "./migration";
import { getWorldJournal } from "./stores";

const MODULE_ID = CONSTANTS.MODULE_ID;

export interface StoreDiagnosis {
    store: StoreRef;
    label: string;
    /** Has V3 data of its own. */
    hasV3: boolean;
    /** Untouched V1 data exists to restore from. */
    hasV1Backup: boolean;
    items: number;
    /** Items that couldn't be read at all (not shown anywhere else). */
    broken: {
        key: string;
        name: string | null;
        reasons: string[];
        raw: unknown;
    }[];
    /** Parts of readable items that were set aside. */
    quarantined: {
        itemId: string;
        itemName: string;
        records: QuarantinedRecord[];
    }[];
    /** Fields the normaliser fixed on read (not yet saved back). */
    repaired: { itemId: string; itemName: string; messages: string[] }[];
}

function pageEntries(): {
    key: string;
    page: JournalEntryPage;
    raw: unknown;
}[] {
    const journal = getWorldJournal();
    if (!journal) return [];
    return journalPages(journal).flatMap((page) => {
        const raw = getProperty(
            page,
            `flags.${MODULE_ID}.${CONSTANTS.FLAGS.item}`,
        );
        if (!raw) return [];
        const id =
            typeof (raw as { id?: unknown }).id === "string"
                ? (raw as { id: string }).id
                : page.id;
        return [{ key: id, page, raw }];
    });
}

function rawActorStore(actor: Actor): unknown {
    return ownModuleFlags(actor)?.[storeFlagKey(actor)];
}

function worldHasV1Backup(): boolean {
    const v1 = getSetting(CONSTANTS.SETTINGS.worldActivities);
    return Array.isArray(v1) && v1.length > 0;
}

function actorHasV1Backup(actor: Actor): boolean {
    const own = ownModuleFlags(actor);
    return Array.isArray(own?.[CONSTANTS.FLAGS.trainingItems]);
}

function summarize(
    store: StoreRef,
    label: string,
    hasV3: boolean,
    hasV1Backup: boolean,
    decoded: ReturnType<typeof decodeTrackedItems>,
): StoreDiagnosis {
    const names = new Map(decoded.items.map((i) => [i.id, i.name]));
    const repaired = Iter.from(decoded.issues)
        .flatMap(({ itemId, issue }) =>
            issue.severity === "repaired" && itemId
                ? [
                      {
                          itemId,
                          message: localize("downtime-dnd5e.Data.AtPath", {
                              path: issue.path,
                              problem: localizeText(issue.message),
                          }),
                      },
                  ]
                : [],
        )
        .groupBy((entry) => entry.itemId);
    return {
        store,
        label,
        hasV3,
        hasV1Backup,
        items: decoded.items.length,
        broken: decoded.broken.map(({ key, result }) => ({
            key,
            name:
                typeof (result.raw as { name?: unknown } | null)?.name ===
                "string"
                    ? (result.raw as { name: string }).name
                    : null,
            reasons: result.issues.map((i) =>
                i.path
                    ? localize("downtime-dnd5e.Data.AtPath", {
                          path: i.path,
                          problem: localizeText(i.message),
                      })
                    : localizeText(i.message),
            ),
            raw: result.raw,
        })),
        quarantined: decoded.items
            .filter((i) => i.quarantine.length)
            .map((i) => ({
                itemId: i.id,
                itemName: i.name,
                records: i.quarantine,
            })),
        repaired: Array.from(repaired, ([itemId, entries]) => ({
            itemId,
            itemName: names.get(itemId) ?? itemId,
            messages: entries.map((entry) => entry.message),
        })),
    };
}

/** Diagnose the world and every actor with downtime data. */
export function diagnoseAll(): StoreDiagnosis[] {
    const results: StoreDiagnosis[] = [];
    const world = pageEntries();
    results.push(
        summarize(
            { kind: "WORLD" },
            localize("downtime-dnd5e.Review.World"),
            !!getWorldJournal(),
            worldHasV1Backup(),
            decodeTrackedItems(
                world.map((e) => [e.key, e.raw]),
                randomId,
                localize,
            ),
        ),
    );
    for (const actor of worldActors()) {
        const raw = rawActorStore(actor);
        const hasV1Backup = actorHasV1Backup(actor);
        if (!raw && !hasV1Backup) continue;
        const decoded = raw
            ? decodeActorCollection(raw, randomId, localize)
            : { items: [], broken: [], issues: [], categories: [] };
        results.push(
            summarize(
                { kind: "ACTOR", actorUuid: actor.uuid! },
                actor.name ?? actor.uuid!,
                !!raw,
                hasV1Backup,
                decoded,
            ),
        );
    }
    return results;
}

function requireGM() {
    if (!isGM()) throw new Error(localize("downtime-dnd5e.Repair.GMOnly"));
}

async function requireActor(uuid: string): Promise<Actor> {
    const actor = await actorFromUuid(uuid);
    if (!actor)
        throw new Error(
            localize("downtime-dnd5e.Effect.ActorNotFound", { uuid }),
        );
    return actor;
}

/** Delete one stored item by its storage key (for items that can't be read). */
export async function deleteRawTrackedItem(
    store: StoreRef,
    key: string,
): Promise<void> {
    requireGM();
    if (store.kind === "WORLD") {
        const entry = pageEntries().find((e) => e.key === key);
        await deleteDocument(entry?.page);
        return;
    }
    const actor = await requireActor(store.actorUuid);
    await deleteAt(
        actor,
        `flags.${MODULE_ID}.${storeFlagKey(actor)}.items.${key}`,
    );
}

/** Write an item back exactly as it reads now (saves the normaliser's repairs, or discards quarantined parts). */
export async function rewriteTrackedItem(
    store: StoreRef,
    item: TrackedItemData,
): Promise<void> {
    requireGM();
    const stored = encodeTrackedItem(item);
    // Delete, then write: an update merges objects, so writing over the old item would keep keys it no longer has.
    if (store.kind === "WORLD") {
        const entry = pageEntries().find((e) => e.key === item.id);
        if (!entry)
            throw new Error(
                localize("downtime-dnd5e.Repair.NotFound", { name: item.name }),
            );
        const path = `flags.${MODULE_ID}.${CONSTANTS.FLAGS.item}`;
        await deleteAt(entry.page, path);
        await updateDocument(entry.page, { [path]: stored });
        return;
    }
    const actor = await requireActor(store.actorUuid);
    const path = `flags.${MODULE_ID}.${storeFlagKey(actor)}.items.${item.id}`;
    await deleteAt(actor, path);
    await updateDocument(actor, { [path]: stored });
}

/** Read the parsed item from the raw store (works for items with quarantine). */
async function parsedTrackedItem(
    store: StoreRef,
    itemId: string,
): Promise<TrackedItemData | null> {
    const decoded =
        store.kind === "WORLD"
            ? decodeTrackedItems(
                  pageEntries().map((e) => [e.key, e.raw]),
                  randomId,
                  localize,
              )
            : decodeActorCollection(
                  rawActorStore(await requireActor(store.actorUuid)),
                  randomId,
                  localize,
              );
    return decoded.items.find((i) => i.id === itemId) ?? null;
}

/** Save the normaliser's repairs to an item. */
export async function saveRepairs(
    store: StoreRef,
    itemId: string,
): Promise<void> {
    const item = await parsedTrackedItem(store, itemId);
    if (!item) throw new Error(localize("downtime-dnd5e.Repair.ItemNotFound"));
    await rewriteTrackedItem(store, item);
}

/** Drop the quarantined parts of an item (after copying them out if needed). */
export async function discardQuarantine(
    store: StoreRef,
    itemId: string,
): Promise<void> {
    const item = await parsedTrackedItem(store, itemId);
    if (!item) throw new Error(localize("downtime-dnd5e.Repair.ItemNotFound"));
    await rewriteTrackedItem(store, { ...item, quarantine: [] });
}

/**
 * Throw away the store's V3 data and migrate again from its untouched V1
 * data. Everything done in V3 for this store since the migration is lost.
 */
export async function restoreFromV1(store: StoreRef): Promise<void> {
    // The migration runs on the active GM only; restoring anywhere else would just delete.
    if (!isActiveGM())
        throw new Error(localize("downtime-dnd5e.Repair.ActiveGMOnly"));
    if (store.kind === "WORLD") {
        if (!worldHasV1Backup())
            throw new Error(localize("downtime-dnd5e.Repair.NoWorldV1"));
        const journal = getWorldJournal();
        await deleteDocument(journal);
        await setSetting(CONSTANTS.SETTINGS.worldJournalId, "");
    } else {
        const actor = await requireActor(store.actorUuid);
        if (!actorHasV1Backup(actor))
            throw new Error(
                localize("downtime-dnd5e.Repair.NoActorV1", {
                    actor: actor.name ?? "",
                }),
            );
        await deleteAt(actor, `flags.${MODULE_ID}.${storeFlagKey(actor)}`);
        if (!legacyActorData(actor))
            throw new Error(localize("downtime-dnd5e.Repair.V1Unreadable"));
    }
    await runMigration();
}

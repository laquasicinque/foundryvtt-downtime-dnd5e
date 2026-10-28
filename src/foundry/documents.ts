/**
 * Document reads and writes. Update data is passed as plain objects with
 * dotted keys, so it's typed loosely here.
 */

import { Iter } from "it-al";

interface Updatable {
    update(data: Record<string, unknown>): Promise<unknown>;
}

interface Deletable {
    delete(): Promise<unknown>;
}

interface HasStats {
    _stats?: { modifiedTime?: number | null };
}

interface WithEmbedded {
    createEmbeddedDocuments(
        type: string,
        data: object[],
    ): Promise<{ uuid?: string | null }[]>;
    updateEmbeddedDocuments(type: string, updates: object[]): Promise<unknown>;
    deleteEmbeddedDocuments(type: string, ids: string[]): Promise<unknown>;
}

export function updateDocument(
    document: unknown,
    data: Record<string, unknown>,
): Promise<unknown> {
    return (document as Updatable).update(data);
}

export async function deleteDocument(document: unknown): Promise<void> {
    await (document as Deletable | null)?.delete();
}

/**
 * Delete `path` in an update. v14 marks it with a ForcedDeletion value;
 * earlier versions use a `-=key` key instead.
 */
export function deleteInUpdate(
    update: Record<string, unknown>,
    path: string,
): void {
    update[path] = new foundry.data.operators.ForcedDeletion();
}

/** Delete one (dotted) key of a document. */
export async function deleteAt(document: unknown, path: string): Promise<void> {
    const update: Record<string, unknown> = {};
    deleteInUpdate(update, path);
    await updateDocument(document, update);
}

/** Create embedded documents; resolves to their uuids. */
export async function createEmbedded(
    parent: unknown,
    type: string,
    data: object[],
): Promise<string[]> {
    const created = await (parent as WithEmbedded).createEmbeddedDocuments(
        type,
        data,
    );
    return created.flatMap((doc) => (doc.uuid ? [doc.uuid] : []));
}

export async function updateEmbedded(
    parent: unknown,
    type: string,
    updates: Iterable<object>,
): Promise<void> {
    await (parent as WithEmbedded).updateEmbeddedDocuments(
        type,
        Array.isArray(updates) ? updates : [...updates],
    );
}

export async function deleteEmbedded(
    parent: unknown,
    type: string,
    ids: Iterable<string>,
): Promise<void> {
    await (parent as WithEmbedded).deleteEmbeddedDocuments(
        type,
        Array.isArray(ids) ? ids : [...ids],
    );
}

/** When the document was last modified (0 if unknown). */
export function modifiedTime(document: unknown): number {
    return (document as HasStats)?._stats?.modifiedTime ?? 0;
}

/** The plain parts of a document every lookup can show. */
export interface DocumentSummary {
    uuid: string;
    name: string | null;
    /** "Actor", "Item", … ("" if unknown). */
    documentName: string;
}

const summarize = (uuid: string, doc: unknown): DocumentSummary | null => {
    if (!doc) return null;
    const { name, documentName } = doc as {
        name?: string | null;
        documentName?: string;
    };
    return { uuid, name: name ?? null, documentName: documentName ?? "" };
};

/** A document by uuid, loading it from its compendium if needed. */
export async function documentSummary(
    uuid: string,
): Promise<DocumentSummary | null> {
    try {
        return summarize(uuid, await fromUuid(uuid));
    } catch {
        return null;
    }
}

/**
 * `documentSummary` from memory only. Finds world documents and what's
 * embedded in them; for compendium content, the index entry (no
 * `documentName`) or null until the document is loaded.
 */
export function documentSummarySync(uuid: string): DocumentSummary | null {
    try {
        return summarize(uuid, fromUuidSync(uuid));
    } catch {
        return null;
    }
}

/** Whether the document is in a locked compendium (so it can't be updated). */
export function inLockedCompendium(document: unknown): boolean {
    const { pack } = document as { pack?: string | null };
    return !!pack && !!game.packs.get(pack)?.locked;
}

/** A document by uuid (loading it from a compendium if needed). */
export async function documentByUuid(uuid: string): Promise<unknown> {
    const doc = await fromUuid(uuid);
    return doc ?? null;
}

/** A document's data as a plain object (for copying), with its type. */
export async function documentData(
    uuid: string,
): Promise<{ documentName: string; data: Record<string, unknown> } | null> {
    const doc = (await fromUuid(uuid)) as {
        documentName: string;
        toObject(): Record<string, unknown>;
    } | null;
    return doc
        ? { documentName: doc.documentName, data: doc.toObject() }
        : null;
}

/** An Item's fields used to match it on an actor. */
export interface ItemMatchFields {
    name: string | null;
    identifier: string | null;
    /** Its compendium source: the item itself if it's in a pack. */
    sourceUuid: string | null;
}

export async function itemMatchFields(
    uuid: string,
): Promise<ItemMatchFields | null> {
    const doc = (await fromUuid(uuid)) as {
        name?: string;
        system?: { identifier?: string };
        _stats?: { compendiumSource?: string | null };
        pack?: string | null;
    } | null;
    if (!doc) return null;
    return {
        name: doc.name ?? null,
        identifier: doc.system?.identifier || null,
        sourceUuid: doc.pack ? uuid : (doc._stats?.compendiumSource ?? null),
    };
}

/**
 * Delete documents by uuid, skipping any that no longer exist. Embedded
 * documents are deleted with one request per parent and type; the rest one
 * at a time, all in parallel. Documents inside another listed document go
 * with it.
 */
export async function deleteByUuids(uuids: string[]): Promise<void> {
    const documents = Iter.from(
        await Promise.all(uuids.map((uuid) => fromUuid(uuid))),
    )
        .filterNullish()
        .toArray();
    const listed = Iter.from(documents).pluck("uuid").toSet();
    const insideListed = (document: Foundry.latest.Document) => {
        for (let p = document.parent; p; p = p.parent)
            if (listed.has(p.uuid)) return true;
        return false;
    };
    const [embedded, standalone] = Iter.from(documents)
        .filter((document) => !insideListed(document))
        .partition((document) => !!document.parent);
    const groups = Iter.from(embedded).groupBy(
        (document) => `${document.parent?.uuid}:${document.documentName}`,
    );
    await Promise.all([
        // Every document in a group has the same parent and type.
        ...Iter.from(groups.values()).map((group) =>
            group[0].parent?.deleteEmbeddedDocuments(
                group[0].documentName,
                group.map((document) => document.id),
            ),
        ),
        ...standalone.map((document) => document.delete()),
    ]);
}

/** A document from a create/update/delete hook is this journal entry or one of its pages. */
export function touchesJournal(document: unknown, journalId: string): boolean {
    const d = document as { id?: string; parent?: { id?: string } };
    return d.id === journalId || d.parent?.id === journalId;
}

/**
 * A document from a create/update/delete hook is this actor, its token or
 * delta, the base actor of a token actor, or embedded in the actor (items,
 * effects).
 */
export function touchesActor(document: unknown, actorUuid: string): boolean {
    const d = document as {
        uuid?: string;
        id?: string;
        actor?: { uuid?: string };
        parent?: { uuid?: string; actor?: { uuid?: string } };
    };
    if (d.uuid === actorUuid) return true;
    if (d.actor?.uuid === actorUuid || d.parent?.actor?.uuid === actorUuid)
        return true;
    if (d.parent?.uuid === actorUuid) return true;
    return !!d.id && actorUuid.endsWith(`Actor.${d.id}`);
}

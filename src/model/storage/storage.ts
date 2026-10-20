/**
 * Storage shapes and the pure encode/decode around them.
 *
 * Both stores persist history keyed by event id so appending an event is a
 * small diff. Items are keyed by id; order is store-level.
 */
import {
    parseCategory,
    parseTrackedItem,
    type ParseResult,
} from "./normalize/item";
import type { Issue } from "./normalize/fields";
import type {
    CategoryData,
    HistoryEventData,
    Id,
    TrackedItemData,
} from "../../types/data";
import { SCHEMA_VERSION } from "./schema";
import { compareText, localized } from "../../lib/text";
import { isRecord } from "../../lib/values";
import type { Translate } from "../../types/i18n";

/** A tracked item as persisted: history keyed by event id. */
export type StoredItemData = Omit<TrackedItemData, "history"> & {
    history: Record<Id, HistoryEventData>;
};

/** Actor store: `flags["downtime-dnd5e"].store`. */
export interface StoredActorCollection {
    schemaVersion: typeof SCHEMA_VERSION;
    items: Record<Id, StoredItemData>;
    /** Store-level item order. */
    order: Id[];
    categories: CategoryData[];
}

/** World store: the journal entry's `flags["downtime-dnd5e"].store`. Items live on pages. */
export interface StoredWorldCollection {
    schemaVersion: typeof SCHEMA_VERSION;
    categories: CategoryData[];
}

export function encodeTrackedItem(item: TrackedItemData): StoredItemData {
    const history: Record<Id, HistoryEventData> = {};
    for (const event of item.history) history[event.id] = event;
    return { ...item, history };
}

/** Item config without history, for edits that must not rewrite history. */
export function itemConfig(
    item: TrackedItemData,
): Omit<TrackedItemData, "history"> {
    const { history: _history, ...config } = item;
    return config;
}

/** Abstract update operations; stores translate them to Foundry update data. */
export interface StorageSetOperation {
    kind: "set";
    path: string[];
    value: unknown;
}

export interface StorageDeleteOperation {
    kind: "delete";
    path: string[];
}

export type StorageOp = StorageSetOperation | StorageDeleteOperation;

/**
 * Operations to go from `before` to `after` for one item: appended/changed
 * events are written individually, config fields are written when changed.
 * Events are immutable, except `dismissed` and `note`, which are rewritten.
 */
export function diffTrackedItem(
    before: TrackedItemData | null,
    after: TrackedItemData,
): StorageOp[] {
    if (!before)
        return [{ kind: "set", path: [], value: encodeTrackedItem(after) }];

    const ops: StorageOp[] = [];
    const beforeConfig = itemConfig(before) as Record<string, unknown>;
    const afterConfig = itemConfig(after) as Record<string, unknown>;
    for (const key of new Set([
        ...Object.keys(beforeConfig),
        ...Object.keys(afterConfig),
    ])) {
        if (!(key in afterConfig)) ops.push({ kind: "delete", path: [key] });
        else if (!sameJson(beforeConfig[key], afterConfig[key]))
            ops.push({ kind: "set", path: [key], value: afterConfig[key] });
    }

    const beforeEvents = new Map(before.history.map((e) => [e.id, e]));
    const afterIds = new Set<Id>();
    for (const event of after.history) {
        afterIds.add(event.id);
        const previous = beforeEvents.get(event.id);
        if (!previous || !sameJson(previous, event))
            ops.push({
                kind: "set",
                path: ["history", event.id],
                value: event,
            });
    }
    for (const id of beforeEvents.keys()) {
        if (!afterIds.has(id))
            ops.push({ kind: "delete", path: ["history", id] });
    }
    return ops;
}

function sameJson(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

/** Order ids: known order first, then the rest by name. Unknown ids in `order` are dropped. */
export function orderTrackedItems<T extends { id: Id; name: string }>(
    items: T[],
    order: readonly Id[],
): T[] {
    const byId = new Map(items.map((item) => [item.id, item]));
    const ordered: T[] = [];
    for (const id of order) {
        const item = byId.get(id);
        if (item) {
            ordered.push(item);
            byId.delete(id);
        }
    }
    const rest = [...byId.values()].sort((a, b) => compareText(a.name, b.name));
    return [...ordered, ...rest];
}

export interface DecodedCollection {
    items: TrackedItemData[];
    /** Unrecoverable items, for the GM's "broken item" rows. */
    broken: { key: string; result: ParseResult<TrackedItemData> }[];
    categories: CategoryData[];
    issues: { itemId: string | null; issue: Issue }[];
}

/** Decode a stored actor collection (or anything that looks like one). Never throws. */
export function decodeActorCollection(
    raw: unknown,
    randomId: () => string,
    t: Translate,
): DecodedCollection {
    const record = isRecord(raw) ? raw : {};
    const itemsRaw = isRecord(record.items) ? record.items : {};
    const order = Array.isArray(record.order)
        ? record.order.filter((id): id is string => typeof id === "string")
        : [];

    const decoded = decodeTrackedItems(Object.entries(itemsRaw), randomId, t);
    const categories = decodeCategories(
        record.categories,
        randomId,
        t,
        decoded.issues,
    );
    return {
        ...decoded,
        items: orderTrackedItems(decoded.items, order),
        categories,
    };
}

export function decodeTrackedItems(
    entries: [string, unknown][],
    randomId: () => string,
    t: Translate,
) {
    const items: TrackedItemData[] = [];
    const broken: DecodedCollection["broken"] = [];
    const issues: DecodedCollection["issues"] = [];
    const seen = new Set<Id>();
    for (const [key, raw] of entries) {
        const result = parseTrackedItem(raw, { randomId, t });
        const itemId = result.value?.id ?? key;
        for (const issue of result.issues) issues.push({ itemId, issue });
        if (!result.value) {
            broken.push({ key, result });
            continue;
        }
        // The storage key is authoritative for the id.
        if (result.value.id !== key) {
            issues.push({
                itemId: key,
                issue: {
                    severity: "repaired",
                    path: "id",
                    message: localized("downtime-dnd5e.Data.IdMismatch", {
                        key,
                    }),
                },
            });
            result.value.id = key;
        }
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(result.value);
    }
    return { items, broken, issues };
}

export function decodeCategories(
    raw: unknown,
    randomId: () => string,
    t: Translate,
    issues: DecodedCollection["issues"] = [],
): CategoryData[] {
    if (!Array.isArray(raw)) return [];
    const categories: CategoryData[] = [];
    const seen = new Set<Id>();
    for (const entry of raw) {
        const result = parseCategory(entry, { randomId, t });
        for (const issue of result.issues) issues.push({ itemId: null, issue });
        if (result.value && !seen.has(result.value.id)) {
            seen.add(result.value.id);
            categories.push(result.value);
        }
    }
    return categories;
}

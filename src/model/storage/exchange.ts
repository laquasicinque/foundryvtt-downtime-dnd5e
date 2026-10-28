/**
 * Import / export. Exports are always V3, wrapped with the module
 * id and schema version. Imports accept V3 exports and the V1 formats (actor
 * exports `{ items, categories }`, world exports as a bare array, and that
 * array wrapped as an exported setting `{ value: "<json>" }`). V1 data goes
 * through the migration, reconciled with a SET { reason: "IMPORT" }; then
 * everything goes through the normaliser like any other load.
 */
import {
    migrateV1Category,
    migrateV1Item,
    type V1MigrationContext,
} from "./migrate/v1";
import { upgradePreV1 } from "./migrate/preV1";
import { parseCategory, parseTrackedItem } from "./normalize/item";
import { remapRefs } from "../rules/refs";
import type { CategoryData, Id, TrackedItemData } from "../../types/data";
import { SCHEMA_VERSION } from "./schema";
import { localized } from "../../lib/text";
import { isRecord } from "../../lib/values";
import type { LocalizedText } from "../../types/i18n";

export const EXPORT_MODULE = "downtime-dnd5e";

export interface ExportFile {
    module: typeof EXPORT_MODULE;
    schemaVersion: typeof SCHEMA_VERSION;
    /** ISO timestamp. */
    exportedAt: string;
    items: TrackedItemData[];
    categories: CategoryData[];
}

export function buildExport(
    items: readonly TrackedItemData[],
    categories: readonly CategoryData[],
    now: Date = new Date(),
): ExportFile {
    return {
        module: EXPORT_MODULE,
        schemaVersion: SCHEMA_VERSION,
        exportedAt: now.toISOString(),
        items: structuredClone([...items]),
        categories: structuredClone([...categories]),
    };
}

export type ImportFormat = "V3" | "V1";

export interface ImportedData {
    format: ImportFormat;
    items: TrackedItemData[];
    categories: CategoryData[];
    /** Records that couldn't be read at all, and why. */
    skipped: { index: number; reason: LocalizedText | string }[];
    /** Items with parts set aside (quarantined) or repaired, by name. */
    notes: LocalizedText[];
}

/** The file's format and its raw item / category lists, or null if it isn't a downtime file. */
export function detectImport(
    raw: unknown,
): { format: ImportFormat; items: unknown[]; categories: unknown[] } | null {
    if (isRecord(raw) && typeof raw.value === "string") {
        try {
            return detectImport(JSON.parse(raw.value));
        } catch {
            return null;
        }
    }
    if (isRecord(raw) && raw.module === EXPORT_MODULE) {
        if (
            typeof raw.schemaVersion !== "number" ||
            raw.schemaVersion > SCHEMA_VERSION
        )
            return null;
        if (!Array.isArray(raw.items)) return null;
        return {
            format: raw.schemaVersion >= SCHEMA_VERSION ? "V3" : "V1",
            items: raw.items,
            categories: Array.isArray(raw.categories) ? raw.categories : [],
        };
    }
    const looksLikeTrackedItem = (e: unknown) =>
        isRecord(e) && typeof e.name === "string";
    if (isRecord(raw) && Array.isArray(raw.items)) {
        if (!raw.items.every(looksLikeTrackedItem)) return null;
        return {
            format: "V1",
            items: raw.items,
            categories: Array.isArray(raw.categories) ? raw.categories : [],
        };
    }
    if (Array.isArray(raw) && raw.every(looksLikeTrackedItem))
        return { format: "V1", items: raw, categories: [] };
    return null;
}

/** Parse an import file into V3 data. null if it isn't a downtime file. */
export function parseImport(
    raw: unknown,
    ctx: { randomId: () => string; v1: V1MigrationContext },
): ImportedData | null {
    const detected = detectImport(raw);
    if (!detected) return null;
    const result: ImportedData = {
        format: detected.format,
        items: [],
        categories: [],
        skipped: [],
        notes: [],
    };
    const v1 = { ...ctx.v1, reconcileReason: "IMPORT" as const };
    detected.items.forEach((entry, index) => {
        const parsed =
            detected.format === "V3"
                ? parseTrackedItem(entry, {
                      randomId: ctx.randomId,
                      t: ctx.v1.t,
                  })
                : migrateV1Item(upgradePreV1(entry, ctx.randomId), v1);
        if (!parsed.value) {
            result.skipped.push({
                index,
                reason:
                    parsed.issues[0]?.message ??
                    localized("downtime-dnd5e.Import.Unreadable"),
            });
            return;
        }
        if (parsed.value.quarantine.length)
            result.notes.push(
                localized("downtime-dnd5e.Import.SetAside", {
                    item: parsed.value.name,
                    count: parsed.value.quarantine.length,
                }),
            );
        result.items.push(parsed.value);
    });
    for (const entry of detected.categories) {
        const parsed =
            detected.format === "V3"
                ? parseCategory(entry, { randomId: ctx.randomId, t: ctx.v1.t })
                : migrateV1Category(entry, ctx.randomId, ctx.v1.t);
        if (parsed.value) result.categories.push(parsed.value);
    }
    return result;
}

export interface ImportPlan {
    /** Items to add, with ids made unique in the destination. */
    create: TrackedItemData[];
    /** The destination's categories after the import, or null if unchanged. */
    destCategories: CategoryData[] | null;
    /** Imported id → id in the destination (only the renamed ones). */
    renamed: Record<Id, Id>;
}

/**
 * Fit imported items into a store: ids are kept unless taken (references
 * inside the imported set follow renamed ids), categories are matched by
 * name or added. Imports add; nothing in the store is replaced.
 */
export function planImport(
    imported: Pick<ImportedData, "items" | "categories">,
    destItems: readonly TrackedItemData[],
    destCategories: readonly CategoryData[],
    randomId: () => string,
): ImportPlan {
    const taken = new Set(destItems.map((i) => i.id));
    const idMap = new Map<Id, Id>();
    for (const item of imported.items) {
        let id = item.id;
        while (taken.has(id)) id = randomId();
        taken.add(id);
        if (id !== item.id) idMap.set(item.id, id);
    }

    const categories = [...destCategories];
    const categoryMap = new Map<Id, Id | null>();
    for (const category of imported.categories) {
        const existing = categories.find((c) => c.name === category.name);
        if (existing) {
            categoryMap.set(category.id, existing.id);
            continue;
        }
        const id = categories.some((c) => c.id === category.id)
            ? randomId()
            : category.id;
        categories.push({ ...category, id });
        categoryMap.set(category.id, id);
    }

    const create = imported.items.map((item) => ({
        ...remapRefs(item, idMap),
        id: idMap.get(item.id) ?? item.id,
        categoryId: item.categoryId
            ? (categoryMap.get(item.categoryId) ?? null)
            : null,
    }));
    return {
        create,
        destCategories:
            categories.length !== destCategories.length ? categories : null,
        renamed: Object.fromEntries(idMap),
    };
}

/**
 * Import / export for a store: V3 export files, and imports of
 * V3 or V1 files (migrated on this client, applied by the GM).
 */
import {
    buildExport,
    parseImport,
    type ExportFile,
} from "../model/storage/exchange";
import type { StoreRef } from "../types/data";
import { actorFromUuid } from "../foundry/actors";
import { localize, localizeText } from "../foundry/i18n";
import { notifyError, notifyInfo, notifyWarn } from "../foundry/notifications";
import { randomId, readTextFromFile, saveDataToFile } from "../foundry/utils";
import { dispatch } from "./relay";
import { migrationContext } from "./migration";
import { readStore } from "./stores";

export async function exportStore(store: StoreRef): Promise<ExportFile> {
    const snapshot = await readStore(store);
    return buildExport(snapshot?.items ?? [], snapshot?.categories ?? []);
}

async function storeLabel(store: StoreRef): Promise<string> {
    if (store.kind === "WORLD") return "world";
    const actor = await actorFromUuid(store.actorUuid);
    return (actor?.name ?? "actor").replace(/[^\w-]+/g, "-").slice(0, 30);
}

/** Download the store as a V3 export file. */
export async function downloadExport(store: StoreRef): Promise<void> {
    const file = await exportStore(store);
    saveDataToFile(
        JSON.stringify(file, null, 2),
        "application/json",
        `downtime-${await storeLabel(store)}-${file.exportedAt.slice(0, 10)}.json`,
    );
}

export interface ImportReport {
    format: "V3" | "V1";
    imported: number;
    skipped: number;
    notes: string[];
}

/** GM: add the items of an import file (parsed JSON) to `store`. */
export async function importIntoStore(
    store: StoreRef,
    raw: unknown,
): Promise<ImportReport> {
    const actor =
        store.kind === "ACTOR" ? await actorFromUuid(store.actorUuid) : null;
    const parsed = parseImport(raw, {
        randomId,
        v1: migrationContext(actor),
    });
    if (!parsed) throw new Error(localize("downtime-dnd5e.Import.NotAnExport"));
    const result = await dispatch({
        type: "IMPORT_ITEMS",
        store,
        items: parsed.items,
        categories: parsed.categories,
    });
    if (!result.ok) throw new Error(localizeText(result.error.message));
    return {
        format: parsed.format,
        imported: result.imported ?? 0,
        skipped: parsed.skipped.length,
        notes: parsed.notes.map(localizeText),
    };
}

/** GM: pick a JSON file and import it into `store`, reporting the outcome. */
export function pickAndImport(store: StoreRef): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
            const raw: unknown = JSON.parse(await readTextFromFile(file));
            const report = await importIntoStore(store, raw);
            const imported = localize(
                report.format === "V1"
                    ? "downtime-dnd5e.Import.DoneFromV1"
                    : "downtime-dnd5e.Import.Done",
                { count: report.imported },
            );
            notifyInfo(
                report.skipped
                    ? localize("downtime-dnd5e.Import.DoneSkipped", {
                          imported,
                          skipped: report.skipped,
                      })
                    : imported,
            );
            for (const note of report.notes) notifyWarn(note);
        } catch (error) {
            notifyError(
                localize("downtime-dnd5e.Import.Failed", {
                    error:
                        error instanceof Error ? error.message : String(error),
                }),
            );
        }
    });
    input.click();
}

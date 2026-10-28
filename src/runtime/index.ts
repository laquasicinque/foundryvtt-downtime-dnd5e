/**
 * Module wiring: settings, the GM command relay, chat cards and the sheet
 * tabs on `init`; the public API and the V1 → V3 migration on `ready`.
 */
import { announceActivityAdapters } from "../dnd5e/activityAdapters";
import { onHook } from "../foundry/hooks";
import { setModuleApi } from "../foundry/modules";
import { registerSettings } from "../settings";
import { registerChatCards } from "../ui/chat";
import { registerSheetTabs } from "../ui/sheets";
import { v3Api } from "./api";
import { legacyApi } from "./legacyApi";
import { runMigration } from "./migration";
import { registerQueries } from "./relay";
import { getWorldJournal } from "./stores";

/**
 * `game.modules.get("downtime-dnd5e").api`: the id-based API, the deprecated
 * V1 names, and `v3` (the same API, where the V3 preview had it).
 */
export const moduleApi = { ...legacyApi, ...v3Api, v3: v3Api };

export function init() {
    registerSettings();
    registerQueries();
    registerChatCards();
    registerSheetTabs();

    // The world journal is managed through the module only.
    onHook("renderJournalDirectory", (_app, html) => {
        const journal = getWorldJournal();
        if (!journal) return;
        html.querySelector(`[data-entry-id="${journal.id}"]`)?.remove();
    });
}

export async function ready() {
    setModuleApi(moduleApi);
    announceActivityAdapters();
    await runMigration();
}

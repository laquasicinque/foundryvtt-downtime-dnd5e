import { localize } from "../../foundry/i18n";
import { CONSTANTS } from "../../constants";
import type { TrackedItem } from "../../domain/TrackedItem";
import type { Id, StoreRef } from "../../types/data";
import type { DeepPartial } from "../../types/utility";
import {
    type Configuration,
    SvelteApplication,
} from "../../foundry/SvelteApplication";
import { showApplication } from "../../foundry/applications";
import History from "./History.svelte";

type HistoryContext = { store: StoreRef; itemId: Id; itemName: string };

/** A tracked item's history in its own window (follows the item live). */
export class HistoryApp extends SvelteApplication<HistoryContext> {
    static DEFAULT_OPTIONS = {
        classes: ["downtime-dnd5e-history"],
        svelte: { component: History },
        window: { title: "downtime-dnd5e.History.Title", resizable: true },
        position: { width: 620, height: 520 },
    } satisfies DeepPartial<Configuration<HistoryContext>>;

    constructor(options: DeepPartial<Configuration<HistoryContext>> = {}) {
        super(options);
    }

    override get title() {
        return localize("downtime-dnd5e.History.TitleNamed", {
            item: String(this.options.itemName),
        });
    }

    override async _prepareContext() {
        return {
            store: this.options.store as StoreRef,
            itemId: this.options.itemId as Id,
        };
    }
}

export function openHistory(item: TrackedItem) {
    const key =
        item.store.kind === "WORLD"
            ? "world"
            : item.store.actorUuid.replaceAll(".", "-");
    const id = `${CONSTANTS.MODULE_ID}-history-${key}-${item.id}`;
    showApplication(
        id,
        () =>
            new HistoryApp({
                id,
                store: item.store,
                itemId: item.id,
                itemName: item.name,
            } as never),
    );
}

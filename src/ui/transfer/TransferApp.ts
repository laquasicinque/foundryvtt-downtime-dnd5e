import { localize } from "../../foundry/i18n";
import { CONSTANTS } from "../../constants";
import type { TrackedItem } from "../../domain/TrackedItem";
import type { TransferMode } from "../../types/transfer";
import type { Id, StoreRef } from "../../types/data";
import type { DeepPartial } from "../../types/utility";
import {
    type Configuration,
    SvelteApplication,
} from "../../foundry/SvelteApplication";
import Transfer from "./Transfer.svelte";

type TransferContext = {
    store: StoreRef;
    itemIds: Id[];
    itemName: string;
    /** Fixed destination (a drop); otherwise the GM picks one. */
    dest: StoreRef | null;
    mode: TransferMode;
};

/** GM: move or copy tracked items to another store. */
export class TransferApp extends SvelteApplication<TransferContext> {
    static DEFAULT_OPTIONS = {
        classes: ["downtime-dnd5e-transfer"],
        svelte: { component: Transfer },
        window: { title: "downtime-dnd5e.Transfer.Move", resizable: true },
        position: { width: 520, height: 480 },
    } satisfies DeepPartial<Configuration<TransferContext>>;

    constructor(options: DeepPartial<Configuration<TransferContext>> = {}) {
        super(options);
    }

    override get title() {
        return localize(
            this.options.mode === "COPY"
                ? "downtime-dnd5e.Transfer.CopyNamed"
                : "downtime-dnd5e.Transfer.MoveNamed",
            { item: String(this.options.itemName) },
        );
    }

    override async _prepareContext() {
        return {
            store: this.options.store as StoreRef,
            itemIds: [...(this.options.itemIds as Id[])],
            dest: (this.options.dest as StoreRef | null) ?? null,
            mode: (this.options.mode as TransferMode) ?? "MOVE",
        };
    }
}

/**
 * GM: move an item to another store (or, with `mode: "COPY"`, put a fresh
 * copy there), after reviewing links and categories. `dest` fixes the
 * destination (a drop).
 */
export function openTransfer(
    item: TrackedItem,
    options: { dest?: StoreRef; mode?: TransferMode } = {},
) {
    void new TransferApp({
        id: `${CONSTANTS.MODULE_ID}-transfer-${item.id}`,
        store: item.store,
        itemIds: [item.id],
        itemName: item.name,
        dest: options.dest ?? null,
        mode: options.mode ?? "MOVE",
    } as never).render({ force: true });
}

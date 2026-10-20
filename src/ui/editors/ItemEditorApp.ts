import { localize } from "../../foundry/i18n";
import { CONSTANTS } from "../../constants";
import type { TrackedItem } from "../../domain/TrackedItem";
import type { Id, StoreRef } from "../../types/data";
import type { DeepPartial } from "../../types/utility";
import {
    type Configuration,
    SvelteApplication,
} from "../../foundry/SvelteApplication";
import { randomId } from "../../foundry/utils";
import ItemEditor from "./ItemEditor.svelte";

type ItemEditorContext = {
    /** null: a new item for `store`. */
    item: TrackedItem | null;
    store: StoreRef;
    categoryId: Id | null;
};

/** GM editor for one tracked item, new or existing: a tabbed, step-by-step form. */
export class ItemEditorApp extends SvelteApplication<ItemEditorContext> {
    static DEFAULT_OPTIONS = {
        classes: ["downtime-dnd5e-editor"],
        svelte: { component: ItemEditor },
        window: { title: "downtime-dnd5e.Item.EditTitle", resizable: true },
        position: { width: 660, height: 720 },
    } satisfies DeepPartial<Configuration<ItemEditorContext>>;

    constructor(options: DeepPartial<Configuration<ItemEditorContext>> = {}) {
        super(options);
    }

    get item(): TrackedItem | null {
        return (this.options.item as TrackedItem | null) ?? null;
    }

    override get title() {
        return this.item
            ? localize("downtime-dnd5e.Item.EditNamed", {
                  item: this.item.name,
              })
            : localize("downtime-dnd5e.Item.NewTitle");
    }

    override async _prepareContext() {
        return {
            item: this.item,
            store: (this.item?.store ?? this.options.store) as StoreRef,
            categoryId: (this.options.categoryId as Id | null) ?? null,
        };
    }
}

export function openTrackedItemEditor(item: TrackedItem) {
    void new ItemEditorApp({
        id: `${CONSTANTS.MODULE_ID}-item-editor-${item.id}`,
        item,
        store: item.store,
        categoryId: null,
    } as never).render({ force: true });
}

/** The form for a new item in `store`; nothing is created until it's saved. */
export function openNewTrackedItemEditor(
    store: StoreRef,
    categoryId: Id | null = null,
) {
    void new ItemEditorApp({
        id: `${CONSTANTS.MODULE_ID}-item-editor-new-${randomId()}`,
        item: null,
        store,
        categoryId,
    } as never).render({ force: true });
}

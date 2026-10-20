import { CONSTANTS } from "../../constants";
import type { CategoryData, StoreRef } from "../../types/data";
import type { DeepPartial } from "../../types/utility";
import {
    type Configuration,
    SvelteApplication,
} from "../../foundry/SvelteApplication";
import CategoriesEditor from "./CategoriesEditor.svelte";

type CategoriesContext = { store: StoreRef; categories: CategoryData[] };

export class CategoriesEditorApp extends SvelteApplication<CategoriesContext> {
    static DEFAULT_OPTIONS = {
        classes: ["downtime-dnd5e-editor"],
        svelte: { component: CategoriesEditor },
        window: {
            title: "downtime-dnd5e.Category.WindowTitle",
            resizable: true,
        },
        position: { width: 480, height: "auto" as const },
    } satisfies DeepPartial<Configuration<CategoriesContext>>;

    constructor(options: DeepPartial<Configuration<CategoriesContext>> = {}) {
        super(options);
    }

    override async _prepareContext() {
        return {
            store: this.options.store as StoreRef,
            categories: this.options.categories as CategoryData[],
        };
    }
}

export function openCategoriesEditor(
    store: StoreRef,
    categories: CategoryData[],
) {
    const key =
        store.kind === "WORLD" ? "world" : store.actorUuid.replaceAll(".", "-");
    void new CategoriesEditorApp({
        id: `${CONSTANTS.MODULE_ID}-categories-${key}`,
        store,
        categories,
    } as never).render({ force: true });
}

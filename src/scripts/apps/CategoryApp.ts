import { createCategory } from "../Category";
import CONSTANTS from "../constants";
import type { DeepPartial } from "../types";
import { getActorCategories, getWorldCategories, setActorCategories, setWorldCategories } from "../utils/categories";
import { localize } from "../utils/localize";
import { SvelteApplicationMixin, type Configuration } from "../utils/SvelteApplicationMixin";
import CategoryAppComponent from "./CategoryApp.svelte";

type CategoryAppContext = {
    category?: Downtime.Category;
    actor: dnd5e.documents.Actor5e;
    editing?: boolean;
    world?: boolean;
    sheet?: any;
};

export class CategoryApp extends SvelteApplicationMixin(
    foundry.applications.api.ApplicationV2<any, Configuration<CategoryAppContext>, any>,
) {
    resolveOnClose: Promise<void>
    #resolve: () => void

    static DEFAULT_OPTIONS = {
        id: `${CONSTANTS.MODULE_ID}-category-app`,
        svelte: {
            component: CategoryAppComponent,
        },
        window: {
            title: "downtime-dnd5e.CreateEditCategoryAppTitle",
            resizable: true,
        },
        form: {
            handler: this.#onSubmit,
            closeOnSubmit: true,
        },
        buttons: [
            {
                action: "submit",
                label: "Submit",
                type: "submit",
                icon: "fas fa-list",
            },
        ],
        position: {
            width: 400,
        },
    } satisfies DeepPartial<Configuration<CategoryAppContext>>;

    get category() {
        return this.options.category;
    }

    get actor() {
        return this.options.actor;
    }

    get editing() {
        return this.options.editing;
    }

    get world() {
        return !!this.options.world;
    }

    get sheet() {
        return this.options.sheet;
    }

    constructor(...args) {
        super(...args)
        const { promise, resolve } = Promise.withResolvers<void>()
        this.resolveOnClose = promise
        this.#resolve = resolve
    }

    async _prepareContext() {
        return {
            category: this.category ?? createCategory(),
            onSubmit: CategoryApp.#onSubmit.bind(this),
        };
    }

    protected _onClose(options: unknown): void {
        super._onClose(options)
        this.#resolve()
    }


    static async #onSubmit(
        this: CategoryApp,
        event: SubmitEvent | Event,
        form: HTMLFormElement,
        formData: FormDataExtended,
    ) {
        const newCategory = createCategory({
            id: formData.object.id as string,
            name: (formData.object.name || localize("downtime-dnd5e.UnnamedCategory")) as string,
            description: formData.object.description as string,
        });
        const categories = this.world ? getWorldCategories() : getActorCategories(this.actor);
        const byId = new Map(categories.map((x) => [x.id, x]));

        byId.set(newCategory.id, newCategory);
        if (this.world) {
            await setWorldCategories([...byId.values()]);
        } else {
            await setActorCategories(this.actor, [...byId.values()]);
        }

        if ((this.actor?.sheet as any)?.state > 0) {
            this.actor.sheet?.render(true);
        }
    }
}

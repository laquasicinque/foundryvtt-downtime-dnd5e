import { DeepPartial } from "fvtt-types/utils";
import CONSTANTS from "../constants.js";
import { createCategory } from "../Category.js";
import { VueApplicationMixin } from "../utils/VueApplicationMixin.js";
import CategoryAppComponent from "./CategoryApp.vue";
import { localize } from "../utils/localize.js";
import { getActorCategories, getWorldCategories, setActorCategories, setWorldCategories } from "../utils/categories.js";

const { ApplicationV2 } = foundry.applications.api;

type CategoryAppContext = {
    category?: Downtime.Category;
    actor: dnd5e.documents.Actor5e | foundry.documents.Actor.Stored;
    editing?: boolean;
    world?: boolean;
    sheet?: any;
};

type CategoryAppOptions = foundry.applications.api.DialogV2.Configuration & CategoryAppContext;

const { fields, elements, ux, ui, sidebar, sheets } = foundry.applications;

export default class CategoryApp extends VueApplicationMixin(
    ApplicationV2<CategoryAppOptions, CategoryAppOptions>,
) {

    static DEFAULT_OPTIONS = {
        id: `${CONSTANTS.MODULE_ID}-category-app`,
        wrapper: {
            tag: "form",
            class: "standard-form dialog-form",
        },
        window: {
            title: "downtime-dnd5e.CreateEditCategoryAppTitle",
            resizable: true,
        },
        form: {
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
    } satisfies DeepPartial<foundry.applications.api.DialogV2.Configuration> & {
        wrapper?: { tag?: string; class?: string };
    };

    static PARTS = {
        form: {
            template: CategoryAppComponent,
            forms: {
                form: {
                    closeOnSubmit: true,
                    handler: CategoryApp.#onSubmit,
                },
            },
        },
    };

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

    async _prepareContext() {
        return {
            category: this.category ?? createCategory(),
        } as foundry.applications.api.HandlebarsApplicationMixin.RenderContext;
    }

    static async #onSubmit(this: CategoryApp, event: SubmitEvent, form: HTMLFormElement, formData: FormDataExtended) {
        const newCategory = createCategory({
            id: formData.object.id as string,
            name: (formData.object.name || localize("downtime-dnd5e.UnnamedCategory")) as string,
            description: formData.object.description as string
        });
        const categories = this.world ? getWorldCategories() : getActorCategories(this.actor);
        const byId = new Map(categories.map((x) => [x.id, x]));

        byId.set(newCategory.id, newCategory);
        if (this.world) {
            await setWorldCategories([...byId.values()]);
        } else {
            await setActorCategories(this.actor, [...byId.values()]);
        }

        if (this.actor.sheet.state > 0) {
            this.actor.sheet?.render(true);
        }
    }
}

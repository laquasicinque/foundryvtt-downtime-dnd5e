import { DeepPartial } from "fvtt-types/utils";
import { createTrackedItem } from "../TrackedItem.js";
import TrackingAndTraining from "../TrackingAndTraining.js";
import CONSTANTS from "../constants.js";
import { VueApplicationMixin } from "../utils/VueApplicationMixin.js";
import TrackedItemAppComponent from "./TrackedItemApp.vue";
import { localize } from "../utils/localize.js";
import { getActorActivities, getWorldActivities, setActorActivities, setWorldActivities } from "../utils/activities.js";

const { ApplicationV2 } = foundry.applications.api;

type TrackedItemAppContext = {
    activity?: Downtime.TrackedItem;
    actor: dnd5e.documents.Actor5e | foundry.documents.Actor.Stored;
    editing?: boolean;
    image?: string;
    world?: boolean;
    sheet?: any;
    alreadyCompleted?: boolean;
    categories: Downtime.Category[];
    dropdownOptions: { abilities: unknown[]; skills: unknown[]; tools: unknown[] };
};

type TrackedItemAppOptions = foundry.applications.api.DialogV2.Configuration & TrackedItemAppContext;

const { fields, elements, ux, ui, sidebar, sheets } = foundry.applications;

export default class TrackedItemApp extends VueApplicationMixin(
    ApplicationV2<TrackedItemAppOptions, TrackedItemAppOptions>,
) {
    static DEFAULT_OPTIONS = {
        id: `${CONSTANTS.MODULE_ID}-item-app`,
        wrapper: {
            tag: "form",
            class: "standard-form dialog-form",
        },
        window: {
            title: "downtime-dnd5e.CreateEditItemAppTitle",
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
                icon: "fas fa-clock",
            },
        ],
        position: {
            width: 600,
        },
    } satisfies DeepPartial<foundry.applications.api.DialogV2.Configuration> & {
        wrapper?: { tag?: string; class?: string };
    };

    static PARTS = {
        form: {
            template: TrackedItemAppComponent,
            forms: {
                form: {
                    closeOnSubmit: true,
                    handler: TrackedItemApp.#onSubmit,
                },
            },
        },
    };

    get activity() {
        return this.options.activity;
    }

    get actor() {
        return this.options.actor;
    }

    get editing() {
        return this.options.editing;
    }
    get image() {
        return this.activity?.img ?? this.activity?.chat_icon ?? "";
    }
    get world() {
        return !!this.options.world;
    }
    get sheet() {
        return this.options.sheet;
    }
    get alreadyCompleted() {
        return !!this.options.alreadyCompleted;
    }
    get categories() {
        return this.options.categories;
    }
    get dropdownOptions() {
        return this.options.dropdownOptions;
    }

    async _prepareContext() {
        return {
            item: this.activity ?? createTrackedItem({ progressionStyle: "ABILITY", ability: "int" }),
            categories: this.categories,
            dropdownOptions: this.dropdownOptions,
        } as foundry.applications.api.HandlebarsApplicationMixin.RenderContext;
    }

    static async #onSubmit(this: TrackedItemApp, event: SubmitEvent, form: HTMLFormElement, formData: FormDataExtended) {
        const newItem = createTrackedItem(formData.object);
        const activities = this.world ? getWorldActivities() : getActorActivities(this.actor)
        const byId = new Map(activities.map((x) => [x.id, x]));

        byId.set(newItem.id, newItem);
        if (this.world) {
            await setWorldActivities([...byId.values()])
        } else {
            await setActorActivities(this.actor, [...byId.values()])
        }

        if (this.actor.sheet.state > 0) {
            this.actor.sheet?.render(true);
        }
    }

}

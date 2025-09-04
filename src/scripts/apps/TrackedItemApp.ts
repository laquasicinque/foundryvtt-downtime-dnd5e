import type { DeepPartial } from "../types";
import { createTrackedItem } from "../TrackedItem.js";
import { TrackingAndTraining } from "../TrackingAndTraining.js";
import CONSTANTS from "../constants.js";
import TrackedItemAppComponent from "./TrackedItemApp.svelte";
import { localize } from "../utils/localize.js";
import { getActorActivities, getWorldActivities, setActorActivities, setWorldActivities } from "../utils/activities.js";
import { SvelteApplicationMixin, type Configuration } from "../utils/SvelteApplicationMixin";

const { ApplicationV2 } = foundry.applications.api;

type TrackedItemAppContext = {
    activity?: Downtime.TrackedItem;
    actor: dnd5e.documents.Actor5e;
    editing?: boolean;
    image?: string;
    world?: boolean;
    sheet?: any;
    alreadyCompleted?: boolean;
    categories: Downtime.Category[];
    dropdownOptions: Downtime.DropdownOptions;
};

type TrackedItemAppOptions = foundry.applications.api.DialogV2.Configuration & TrackedItemAppContext;

export default class TrackedItemApp extends SvelteApplicationMixin(
    ApplicationV2<any, Configuration<TrackedItemAppContext>>,
) {
    resolveOnClose: Promise<void>
    #resolve: () => void

    static DEFAULT_OPTIONS = {
        id: `${CONSTANTS.MODULE_ID}-item-app`,
        svelte: {
            component: TrackedItemAppComponent,
        },
        window: {
            title: "downtime-dnd5e.CreateEditItemAppTitle",
            resizable: true,
        },
        form: {
            handler: TrackedItemApp.#onSubmit,
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
    } satisfies DeepPartial<Configuration<TrackedItemAppContext>>;

    constructor(...args) {
        super(...args)
        const { promise, resolve } = Promise.withResolvers<void>()
        this.resolveOnClose = promise
        this.#resolve = resolve
    }

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

    protected _onClose(options: unknown): void {
        super._onClose(options)
        this.#resolve()
    }

    static async #onSubmit(
        this: TrackedItemApp,
        event: Event | SubmitEvent,
        form: HTMLFormElement,
        formData: FormDataExtended,
    ) {
        const newItem = createTrackedItem(formData.object as any);
        const activities = this.world ? getWorldActivities() : getActorActivities(this.actor);
        const byId = new Map(activities.map((x) => [x.id, x]));

        byId.set(newItem.id, newItem);

        if (this.world) {
            await setWorldActivities([...byId.values()]);
        } else {
            await setActorActivities(this.actor, [...byId.values()]);
        }

        if ((this.actor.sheet as any).state > 0) {
            this.actor.sheet?.render(true);
        }
        console.log("Resolve!")

    }
}

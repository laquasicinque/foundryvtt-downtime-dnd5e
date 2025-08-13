import { DeepPartial } from "fvtt-types/utils";
import CONSTANTS from "../constants.js";
import { getActorActivities, setActorActivities } from "../utils/activities.js";
import { getActor } from "../utils/getActor.js";
import { VueApplicationMixin } from "../utils/VueApplicationMixin.js";
import AuditLogAppComponent from "./AuditLogApp.vue";
import { localize } from "../utils/localize.js";
import { apply } from "../utils/pipe.js";
import { Iter } from "../utils/index.js";

export default class AuditLogApp extends VueApplicationMixin(foundry.applications.api.ApplicationV2) {
    public actor: dnd5e.documents.Actor5e;
    public changes: Array<{
        timestamp: number;
        user: string;
        activityName: string;
        actionName: string;
        valueChanged: string;
        oldValue: number;
        newValue: number;
        diff: string
    }> = [];

    static DEFAULT_OPTIONS = {
        id: "downtime-audit-log-app",
        wrapper: {
            tag: 'form',
            class: 'standard-form'
        },
        form: {
            closeOnSubmit: true,
        },
        window: {
            title: "downtime-dnd5e.ChangeLog",
            resizable: true,
        },
        position: {
            width: 1200,
            height: "auto"
        },
    } satisfies DeepPartial<foundry.applications.api.ApplicationV2.Configuration<foundry.applications.api.ApplicationV2.Any>>

    static PARTS = {
        form: {
            template: AuditLogAppComponent,
            forms: {
                form: {
                    handler: this.#submitForm,
                    closeOnSubmit: true
                }
            }
        }
    }

    get title() {
        return localize(this.options.window.title)
    }

    constructor(actor: dnd5e.documents.Actor5e, options = {}) {
        super(options);
        this.actor = actor;
    }

    async _prepareContext(options = {}) {

        const activities = getActorActivities(this.actor);
        const changes = Iter.from(activities)
            .flatMap((act): [string, Downtime.AuditLogV1][] => act.changes.map(change => [act.name, change]))
            .filter(([, change]) => !change.dismissed)
            .map(([activityName, change]) => {
                let difference = change.newValue - change.oldValue;
                const diffString = difference > 0 ? `+${difference}` : difference.toString();

                // Set up our display object
                return {
                    timestamp: new Date(change.timestamp).getTime(),
                    timestampFormat: new Intl.DateTimeFormat(undefined, { timeStyle: 'medium', dateStyle: 'short' }).format(new Date(change.timestamp)),
                    user: change.user,
                    activityName,
                    actionName: change.actionName,
                    valueChanged: change.valueChanged,
                    oldValue: change.oldValue,
                    newValue: change.newValue,
                    diff: diffString,
                };
            }).collect()
        // Loop through each activity. If it's got no changes array, move on to the next one.
        //  If it DOES have a change array, loop through each entry and set up the info we need
        //  for display in the application. Most of it's one-to one, but we need to pull the activity name
        //  from the activity itself, and we do some math for the change. Once that's done,
        //   push the change into the array.


        // Sort by time, oldest to newest
        changes.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));

        this.changes = changes;

        return {
            actor: this.actor,
            changes: this.changes,
            isGM: game.user?.isGM,
            activities: activities,
        } as foundry.applications.api.ApplicationV2.RenderContext
    }

    // Called on submission, handle doing stuff.
    static async #submitForm(this: AuditLogApp, _event: SubmitEvent, form: HTMLFormElement, formData: FormDataExtended) {
        const actorId = formData.object.actorId as string;
        const actor = getActor(actorId);
        const activities = getActorActivities(actor);

        const dismissed = new Set(formData.object.dismiss as string[]).filter(x => !!x)
        if (!dismissed.size) return

        for (const activity of activities) {
            if (!activity.changes?.length) continue

            for (const change of activity.changes) {
                if (dismissed.has(change.id)) {
                    change.dismissed = true
                }
            }
        }

        // Update actor and flags
        await setActorActivities(actor, activities);
    }

}

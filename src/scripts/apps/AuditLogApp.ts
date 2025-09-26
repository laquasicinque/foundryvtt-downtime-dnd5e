import type { DeepPartial } from "../types";
import { getActorActivities, setActorActivities } from "../utils/activities";
import { getActor } from "../utils/getActor";
import { Iter } from "it-al";
import {
  SvelteApplicationMixin,
  type Configuration,
} from "../utils/SvelteApplicationMixin";
import AuditLogAppComponent from "./AuditLogApp.svelte";

export default class AuditLogApp extends SvelteApplicationMixin(
  foundry.applications.api.ApplicationV2<
    any,
    Configuration<{ actor: dnd5e.documents.Actor5e }>,
    any
  >,
) {
  public get actor(): dnd5e.documents.Actor5e<"character"> {
    return this.options.actor;
  }

  static DEFAULT_OPTIONS = {
    id: "downtime-audit-log-app",
    svelte: {
      component: AuditLogAppComponent,
    },
    form: {
      handler: this.#submitForm,
      closeOnSubmit: true,
    },
    window: {
      title: "downtime-dnd5e.ChangeLog",
      resizable: true,
    },
    buttons: [
      {
        action: "submit",
        label: "downtime-dnd5e.DismissSelected",
        type: "submit",
        icon: "fas fa-check",
        disabled: () => !game.users.current?.isGM,
      },
    ],
    position: {
      width: 1200,
      height: "auto",
    },
  } satisfies DeepPartial<Configuration>;

  static async #submitForm(
    this: AuditLogApp,
    _event: SubmitEvent | Event,
    form: HTMLFormElement,
    formData: FormDataExtended,
  ) {
    const actorId = formData.object.actorId as string;
    const actor = getActor(actorId);
    const activities = getActorActivities(actor);

    const dismissed = new Set(formData.object.dismiss as string[]).filter(
      (x) => !!x,
    );
    if (!dismissed.size) return;

    for (const activity of activities) {
      if (!activity.changes?.length) continue;

      for (const change of activity.changes) {
        if (dismissed.has(change.id)) {
          change.dismissed = true;
        }
      }
    }

    // Update actor and flags
    await setActorActivities(actor, activities);
  }

  async _prepareContext(options: SvelteApplicationMixin.RenderOptions) {
    await super._prepareContext(options);

    const activities = getActorActivities(this.actor);
    const changes = Iter.from(activities)
      .flatMap((act): [string, Downtime.AuditLogV1][] =>
        act.changes.map((change) => [act.name, change]),
      )
      .filter(([, change]) => !change.dismissed)
      .map(([activityName, change]) => {
        let difference = change.newValue - change.oldValue;
        const diffString =
          difference > 0 ? `+${difference}` : difference.toString();
        const timestamp = new Date(change.timestamp);
        // Set up our display object
        return {
          timestamp: timestamp.getTime(),
          timestampFormat: new Intl.DateTimeFormat(undefined, {
            timeStyle: "medium",
            dateStyle: "short",
          }).format(new Date(timestamp)),
          user: change.user,
          activityName,
          actionName: change.actionName,
          valueChanged: change.valueChanged,
          oldValue: change.oldValue,
          newValue: change.newValue,
          result: change.newValue,
          diff: diffString,
        };
      })
      .toArray()
      .sort((a, b) => a.timestamp - b.timestamp);

    return {
      actor: this.actor,
      changes: changes,
      isGM: game.user?.isGM,
      activities: activities,
      user: game.user?.id,
    };
  }
}

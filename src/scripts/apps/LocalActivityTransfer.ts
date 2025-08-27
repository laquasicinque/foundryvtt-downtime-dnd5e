import CONSTANTS from "../constants";
import Logger from "../lib/Logger";
import type { DeepPartial } from "../types";
import {
  getActorActivitiesMap,
  getWorldActivities,
  setActorActivities,
} from "../utils/activities";
import { getActor } from "../utils/getActor";
import {
  SvelteApplicationMixin,
  type Configuration,
} from "../utils/SvelteApplicationMixin";
import LocalActivityTransferComponent from "./LocalActivityTransfer.svelte";

export class LocalActivityTransferApplication extends SvelteApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: `${CONSTANTS.MODULE_ID}-local-activity-transfer`,
    svelte: {
      component: LocalActivityTransferComponent,
    },
    window: {
      title: "Copy Activities Between Actors",
    },
    form: {
      handler: this.#onSubmit,
      closeOnSubmit: false,
    },
    buttons: [
      {
        label: "Submit",
        type: "submit",
        icon: "fas fa-dice",
        action: "submit",
      },
    ],
  } satisfies DeepPartial<Configuration>;

  async _prepareContext(
    options: DeepPartial<foundry.applications.api.HandlebarsApplicationMixin.RenderOptions> & {
      isFirstRender: boolean;
    },
  ) {
    await super._prepareContext(options);
    const actors = game.actors.filter(
      (a) => !foundry.utils.getProperty(a, `flags.item-piles.data.enabled`),
    );
    return {
      actors: actors,
    } as foundry.applications.api.HandlebarsApplicationMixin.RenderContext;
  }

  static async #onSubmit(
    this: LocalActivityTransferApplication,
    _event: SubmitEvent | Event,
    form: HTMLFormElement,
    formData: FormDataExtended,
  ) {
    console.log(formData.object);
    const srcActorId = formData.object.srcActor as string;
    const srcActor = getActor(srcActorId);
    const srcActs = getActorActivitiesMap(srcActorId);

    const destActorId = formData.object.destActor as string;
    const destActor = getActor(destActorId);
    const destActs = getActorActivitiesMap(destActorId);

    const transferId = formData.object.activity as string;
    const activityToTransfer = srcActs.get(transferId);

    if (srcActorId === destActorId)
      throw Logger.error(
        "Source Actor and Destination Actor are the same.",
        true,
      );

    if (!activityToTransfer)
      throw Logger.error("No activity chosen to transfer", true);

    if (!srcActor || !destActor)
      throw Logger.error("Both actors must be selected for transferred", true);
    let newActivities = destActs.set(activityToTransfer.id, activityToTransfer);

    setActorActivities(srcActor, [...newActivities.values()]);
    Logger.info(
      `Successfully copied ${activityToTransfer.name} from ${srcActor.name} to ${destActor.name}.`,
      true,
    );
  }
}

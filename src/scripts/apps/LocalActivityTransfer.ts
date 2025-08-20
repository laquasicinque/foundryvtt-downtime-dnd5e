import CONSTANTS from "../constants";
import Logger from "../lib/Logger";
import type { DeepPartial } from "../types";

export class LocalActivityTransferApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: `${CONSTANTS.MODULE_ID}-local-activity-transfer-{id}`,
        window: {
            title: 'Copy Activities Between Actors'
        },
        form: {
            closeOnSubmit: false
        }
    } satisfies DeepPartial<foundry.applications.api.ApplicationV2.Configuration<foundry.applications.api.ApplicationV2.Any>>

    static PARTS = {
        form: {
            template: `modules/${CONSTANTS.MODULE_ID}/templates/additional/localActivityTransfer.hbs`
        }
    }
    async _prepareContext(
        options: DeepPartial<foundry.applications.api.HandlebarsApplicationMixin.RenderOptions> & { isFirstRender: boolean }
    ) {
        await super._prepareContext(options)
        let actorsFiltered = game.actors.filter((a) => !foundry.utils.getProperty(a, `flags.item-piles.data.enabled`));
        return {
            activities: game.settings.get(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.worldActivities),
            actors: actorsFiltered,
        } as foundry.applications.api.HandlebarsApplicationMixin.RenderContext;
    }


    async _onRender(
        context: DeepPartial<foundry.applications.api.HandlebarsApplicationMixin.RenderContext>,
        options: DeepPartial<foundry.applications.api.HandlebarsApplicationMixin.RenderOptions>
    ) {
        super._onRender(context, options)
        this.element.querySelector("#srcActor")?.addEventListener('change', (() => this.changeActorAct()));

        this.changeActorAct();

        this.element.querySelector("#submit")?.addEventListener('click', (() => this.submit()));
    }

    changeActorAct() {
        const actorAct = this.element.querySelector("#actorAct");
        actorAct?.replaceChildren();

        const srcActorID = this.element.querySelector<HTMLInputElement>("#srcActor")?.value;
        const srcActor = game.actors.get(srcActorID as string);
        const srcActs = srcActor?.getFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.trainingItems);

        if (srcActs?.length) {
            actorAct?.append(...srcActs.map(actor => {
                const opt = document.createElement('option')
                opt.value = actor.id
                opt.append(actor.name)
                return opt
            }))
        } else {
            Logger.info("Actor " + srcActor?.name + " does not have any downtime activities.", true);
        }
    }

    async submit() {
        const srcActorID = this.element.querySelector<HTMLInputElement>("#srcActor")?.value;
        const srcActor = game.actors.get(srcActorID as string);
        const srcActs = srcActor?.getFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.trainingItems) ?? [];

        const destActorID = this.element.querySelector<HTMLInputElement>("#destActor")?.value;
        const destActor = game.actors.get(destActorID as string);
        const destActs = destActor?.getFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.trainingItems) ?? []

        const transferID = this.element.querySelector<HTMLInputElement>("#actorAct")?.value;
        const activityToTransfer = srcActs.find((a) => a.id == transferID);

        if (srcActorID !== destActorID && activityToTransfer && destActor && srcActor) {
            let newActivities = destActs.concat([activityToTransfer]);
            await destActor.setFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.trainingItems, newActivities);
            Logger.info(`Successfully copied ${activityToTransfer.name} from ${srcActor.name} to ${destActor.name}.`, true);
        } else {
            Logger.error("Source Actor and Destination Actor are the same.", true);
        }
    }


}

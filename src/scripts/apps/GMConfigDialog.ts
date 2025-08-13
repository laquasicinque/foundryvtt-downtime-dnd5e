import { DeepPartial } from "fvtt-types/utils";
import CONSTANTS from "../constants";
import { _updateDowntimes } from "../settings/training";
import Logger from "../lib/Logger";
import { LocalActivityTransferApplication } from "./LocalActivityTransfer";

export class GMConfig extends foundry.applications.api.DialogV2 {

    static DEFAULT_OPTIONS = {
        id: `${CONSTANTS.MODULE_ID}-{id}-gm-config`,
        window: {
            title: "Modify Global Downtime Events",
        },
        position: { width: 600, height: "auto" },
        buttons: [
            {
                action: 'copy',
                type: 'button',
                label: 'Copy Local Activities to Another Actor',
                icon: 'fas fa-arrow-down-arrow-up',
                callback: () => {
                    new LocalActivityTransferApplication().render(true);
                }
            },
            {
                action: 'import',
                type: 'button',
                label: 'Import World Downtimes',
                icon: 'fas fa-file-import',
                callback: () => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.addEventListener('change', async (e) => {
                        const file = (e.currentTarget as HTMLInputElement).files?.[0];
                        if (!file) return;
                        const result = await foundry.utils.readTextFromFile(file)

                        const settings = JSON.parse(JSON.parse(result).value);
                        const [newDowntimes, changed] = await _updateDowntimes(settings);
                        game.settings.set(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.worldActivities, newDowntimes);

                    })
                    input.click()
                }
            },
            {
                action: 'export',
                type: 'button',
                label: 'Export World Downtimes',
                icon: 'fas fa-file-export',
                callback: async () => {
                    const data = game.settings.get(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.worldActivities)
                    const json = JSON.stringify(data, null, 2)
                    foundry.utils.saveDataToFile(json, 'application/json', `${CONSTANTS.MODULE_ID}-world-activities.json`)
                    Logger.info("Downtime: Saved Activity Data.", true);
                }
            },
        ]

    } satisfies DeepPartial<foundry.applications.api.DialogV2.Configuration<foundry.applications.api.DialogV2.Any>>

}

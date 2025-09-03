import type { DeepPartial } from "../types";
import Logger from "../lib/Logger";
import CONSTANTS from "../constants";
import { localize } from "../utils/localize";

export class ResetSettingsDialog extends foundry.applications.api.DialogV2 {
  static DEFAULT_OPTIONS = {
    window: {
      title: `downtime-dnd5e.SettingReset.dialogs.title`,
    },
    get content() {
      return localize(`downtime-dnd5e.SettingReset.dialogs.content`);
    },
    buttons: [
      {
        type: "submit",
        get label() {
          return localize(`downtime-dnd5e.SettingReset.dialogs.confirm`);
        },
        icon: "fas fa-check",
        action: "confirm",
        callback: async () => {
          const worldSettings = game.settings.storage.get(
            "world",
          ) as foundry.documents.collections.WorldSettings;
          const worldModuleSettings = worldSettings.filter((setting) =>
            setting.key.startsWith(`${CONSTANTS.MODULE_ID}.`),
          );
          await Promise.all(
            worldModuleSettings.map((setting) => {
              Logger.debug(`Reset setting '${setting.key}'`);
              return setting.delete();
            }),
          );
        },
      },
      {
        type: "submit",
        default: true,
        icon: "fas fa-times",
        action: "cancel",
        get label() {
          return localize(`downtime-dnd5e.SettingReset.dialogs.cancel`);
        },
      },
    ],
  } satisfies DeepPartial<
    foundry.applications.api.DialogV2.Configuration<foundry.applications.api.DialogV2.Any>
  >;
}

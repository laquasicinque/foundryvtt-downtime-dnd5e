import CONSTANTS from "./constants.js";
import { ResetSettingsDialog } from "./apps/ResetSettingsDialog.js";
import { GMConfig } from "./apps/GMConfigDialog.js";
import { localize } from "./utils/localize.js";

export function registerSettings() {
    game.settings.registerMenu(CONSTANTS.MODULE_ID, "resetAllSettings", {
        name: `downtime-dnd5e.SettingReset.name`,
        hint: `downtime-dnd5e.SettingReset.hint`,
        icon: "fas fa-coins",
        label: "Reset",
        type: ResetSettingsDialog,
        restricted: true,
    });

    game.settings.registerMenu(CONSTANTS.MODULE_ID, "config", {
        name: "Config",
        label: "Access Config Menu",
        hint: "Access the configuration menu to find additional options.",
        icon: "fas fa-desktop",
        type: GMConfig,
        restricted: true,
    });

    // Stores data about migrations. This gets updated to the module's current version
    // any time a migration is complete
    game.settings.register(CONSTANTS.MODULE_ID, "lastMigrationApplied", {
        scope: "world",
        config: false,
        default: 0,
        type: Number,
    });

    game.settings.register(CONSTANTS.MODULE_ID, "showImportButton", {
        name: localize("downtime-dnd5e.SettingShowImportButton"),
        hint: localize("downtime-dnd5e.SettingShowImportButtonHint"),
        scope: "client",
        config: true,
        default: false,
        type: Boolean,
    });

    game.settings.register(CONSTANTS.MODULE_ID, "gmOnlyMode", {
        name: localize("downtime-dnd5e.SettingGmOnlyMode"),
        hint: localize("downtime-dnd5e.SettingGmOnlyModeHint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
    });

    game.settings.register(CONSTANTS.MODULE_ID, "gmOnlyEditMode", {
        name: localize("downtime-dnd5e.SettingGmOnlyEditMode"),
        hint: localize("downtime-dnd5e.SettingGmOnlyEditModeHint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
    });

    game.settings.register(CONSTANTS.MODULE_ID, "enableTraining", {
        name: localize("downtime-dnd5e.SettingShowDowntimeTabPc"),
        hint: localize("downtime-dnd5e.SettingShowDowntimeTabPcHint"),
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
    });

    game.settings.register(CONSTANTS.MODULE_ID, "enableTrainingNpc", {
        name: localize("downtime-dnd5e.SettingShowDowntimeTabNpc"),
        hint: localize("downtime-dnd5e.SettingShowDowntimeTabNpcHint"),
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
    });

    game.settings.register(CONSTANTS.MODULE_ID, "tabName", {
        name: localize("downtime-dnd5e.SettingTabName"),
        hint: localize("downtime-dnd5e.SettingTabNameHint"),
        scope: "world",
        config: true,
        default: "Downtime",
        type: String,
    });

    game.settings.register(CONSTANTS.MODULE_ID, "extraSheetWidth", {
        name: localize("downtime-dnd5e.SettingExtraSheetWidth"),
        hint: localize("downtime-dnd5e.SettingExtraSheetWidthHint"),
        scope: "client",
        config: true,
        default: 50,
        type: Number,
    });

    game.settings.register(CONSTANTS.MODULE_ID, "totalToComplete", {
        name: localize("downtime-dnd5e.SettingDefaultCompletionTarget"),
        hint: localize("downtime-dnd5e.SettingDefaultCompletionTargetHint"),
        scope: "world",
        config: true,
        default: 300,
        type: Number,
    });

    game.settings.register(CONSTANTS.MODULE_ID, "announceCompletionFor", {
        name: localize("downtime-dnd5e.SettingAnnounceActivityCompletionFor"),
        hint: localize("downtime-dnd5e.SettingAnnounceActivityCompletionForHint"),
        scope: "world",
        config: true,
        type: String,
        choices: {
            pc: localize("downtime-dnd5e.PcsOnly"),
            npc: localize("downtime-dnd5e.NpcsOnly"),
            both: localize("downtime-dnd5e.PcsAndNpcs"),
            none: localize("downtime-dnd5e.None"),
        },
        default: "pc",
    });

    game.settings.register(CONSTANTS.MODULE_ID, "debug", {
        name: `${CONSTANTS.MODULE_ID}.SettingDebug.title`,
        hint: `${CONSTANTS.MODULE_ID}.SettingDebug.hint`,
        scope: "client",
        config: true,
        default: false,
        type: Boolean,
    });

    game.settings.register(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.worldActivities, {
        scope: "world",
        config: false,
        default: [],
    });

    game.settings.register(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.worldCategories, {
        scope: "world",
        config: false,
        default: [],
    });
}

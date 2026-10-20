import { CONSTANTS } from "./constants";
import { localize } from "./foundry/i18n";
import { registerSetting } from "./foundry/settings";

/** Call from `init`. */
export function registerSettings() {
    const id = CONSTANTS.MODULE_ID;

    registerSetting("gmOnlyMode", {
        name: localize("downtime-dnd5e.SettingGmOnlyMode"),
        hint: localize("downtime-dnd5e.SettingGmOnlyModeHint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
    });

    registerSetting("totalToComplete", {
        name: localize("downtime-dnd5e.SettingDefaultCompletionTarget"),
        hint: localize("downtime-dnd5e.SettingDefaultCompletionTargetHint"),
        scope: "world",
        config: true,
        default: 10,
        type: Number,
    });

    registerSetting("announceCompletionFor", {
        name: localize("downtime-dnd5e.SettingAnnounceActivityCompletionFor"),
        hint: localize(
            "downtime-dnd5e.SettingAnnounceActivityCompletionForHint",
        ),
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

    registerSetting(CONSTANTS.SETTINGS.milestoneApprovalDefault, {
        name: localize("downtime-dnd5e.SettingMilestoneApproval.name"),
        hint: localize("downtime-dnd5e.SettingMilestoneApproval.hint"),
        scope: "world",
        config: true,
        type: String,
        choices: {
            AUTO: localize("downtime-dnd5e.SettingMilestoneApproval.AUTO"),
            GM: localize("downtime-dnd5e.SettingMilestoneApproval.GM"),
        },
        default: "AUTO",
    });

    registerSetting("debug", {
        name: `${id}.SettingDebug.title`,
        hint: `${id}.SettingDebug.hint`,
        scope: "client",
        config: true,
        default: false,
        type: Boolean,
    });

    // ── Data (hidden) ────────────────────────────────────────────────────

    // V1 world data: migrated once, then kept untouched as the backup that
    // "Restore from V1" (the repair tool) converts again.
    registerSetting(CONSTANTS.SETTINGS.worldActivities, {
        scope: "world",
        config: false,
        default: [],
    });
    registerSetting(CONSTANTS.SETTINGS.worldCategories, {
        scope: "world",
        config: false,
        default: [],
    });

    // The world store's journal entry.
    registerSetting(CONSTANTS.SETTINGS.worldJournalId, {
        scope: "world",
        config: false,
        type: String,
        default: "",
    });
}

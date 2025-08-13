import { preloadTemplates } from "./utils/load-templates.js";
import { registerSettings } from "./settings.js";
import { registerHelpers } from "./handlebars-helpers.js";
import { migrateToVersion1 } from "./migrations/migrationNumber1.js";
import AuditLogApp from "./apps/AuditLogApp.js";
import TrackingAndTraining from "./TrackingAndTraining.js";
import CONSTANTS from "./constants.js";
import API from "./api.js";
import Logger from "./lib/Logger.js";
import { manualOverride } from "./utils/manualOverride.js";
import { DeepPartial } from "fvtt-types/utils";
import { getActorActivities } from "./utils/activities.js";
import { getActorCategories, getWorldCategories } from "./utils/categories.js";
import { getActor } from "./utils/getActor.js";
import { localize } from "./utils/localize.js";


// Register Game Settings
export const initHooks = () => {
    // Logger.warn("Init Hooks processing");
    // setup all the hooks
    preloadTemplates();
    registerSettings();
    registerHelpers();
};

type AnyFn = (...args: any[]) => any

export const setupHooks = () => {
    // Logger.warn("Setup Hooks processing");
};

export const readyHooks = () => {
    API.crashTNT = crashTNT();

    const mod = game?.modules?.get(CONSTANTS.MODULE_ID)
    if (mod) mod.api = API;
    migrateAllActors();

    /**
     * Add the tab to the sidebar
     */
    dnd5e.applications.actor.CharacterActorSheet.TABS.push({
        label: 'Downtime',
        tab: CONSTANTS.MODULE_ID,
        icon: 'fas fa-clock'
    })

    /**
     * Add the template
     */
    dnd5e.applications.actor.CharacterActorSheet.PARTS[CONSTANTS.MODULE_ID] = {
        template: `modules/${CONSTANTS.MODULE_ID}/templates/training-section-v3.hbs`,
    }

};

// The Meat And Potatoes
async function addTrainingTab(app: Downtime.ActorSheetApplication, html: HTMLFormElement, data: { actor: dnd5e.documents.Actor5e, isCharacter: boolean, isNPC: boolean }) {
    // Determine if we should show the downtime tab
    const enableCharacter = game.settings.get(CONSTANTS.MODULE_ID, "enableTraining");
    const enableNpc = game.settings.get(CONSTANTS.MODULE_ID, "enableTrainingNpc");
    const gmOnlyMode = game.settings.get(CONSTANTS.MODULE_ID, "gmOnlyMode");

    let showToUser = game.user.isGM || (app.object.isOwner && gmOnlyMode);

    if (!showToUser) return;
    if (data.isCharacter && !enableCharacter) return;
    if (data.isNPC && !enableNpc) return;

    //Tab is ready
    Hooks.call(`TrainingTabReady`, app, html, data);
}

function getTemplateData(data) {
    const actor = data.actor;
    const notShowToUserEditMode = game.settings.get(CONSTANTS.MODULE_ID, "gmOnlyEditMode") && !game.users.current.isGM;
    const showImportButton = game.settings.get(CONSTANTS.MODULE_ID, "showImportButton");

    const categoriesActor = getActorCategories(actor);
    const categoriesWorld = getWorldCategories();

    const categoriesActorIds = categoriesActor.map((c) => c.id);
    const categoriesWorldIds = categoriesWorld.map((c) => c.id);

    const activities = getActorActivities(actor);
    let activitiesCategorized = activities.filter(
        (activity) => activity.category && categoriesActorIds.includes(activity.category),
    );
    let activitiesUnCategorized = activities.filter(
        (activity) => !activity.category || !categoriesActorIds.includes(activity.category),
    );
    if (!game.user.isGM) {
        activitiesCategorized = activitiesCategorized.filter((activity) => !activity.hidden);
        activitiesUnCategorized = activitiesUnCategorized.filter((activity) => !activity.hidden);
    }

    let activitiesWorld = game.settings.get(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.worldActivities) || [];
    let activitiesWorldCategorized = activitiesWorld.filter(
        (activity) => activity.category && categoriesWorldIds.includes(activity.category),
    );
    let activitiesWorldUnCategorized = activitiesWorld.filter(
        (activity) => !activity.category || !categoriesWorldIds.includes(activity.category),
    );

    if (!game.user.isGM) {
        activitiesWorldCategorized = activitiesWorldCategorized.filter((activity) => !activity.hidden);
        activitiesWorldUnCategorized = activitiesWorldUnCategorized.filter((activity) => !activity.hidden);
    }

    data.showImportButton = showImportButton;
    data.showToUserEditMode = !notShowToUserEditMode;
    data.isGM = game.user.isGM;
    data.activitiesCategorized = activitiesCategorized;
    data.activitiesUnCategorized = activitiesUnCategorized;
    data.activitiesWorldCategorized = activitiesWorldCategorized;
    data.activitiesWorldUnCategorized = activitiesWorldUnCategorized;

    data.categoriesActor = categoriesActor;
    data.categoriesWorld = categoriesWorld;

    return data;
}

// Determines whether or not the sheet should have its width adjusted.
// If the setting for extra width is set, and if the sheet is of a type for which
// we have training enabled, this returns true.
function adjustSheetWidth(app: Downtime.ActorSheetApplication) {
    let settingEnabled = !!game.settings.get(CONSTANTS.MODULE_ID, "extraSheetWidth");
    let sheetHasTab =
        (app.actor.type === "npc" && game.settings.get(CONSTANTS.MODULE_ID, "enableTrainingNpc")) ||
        (app.actor.type === "character" && game.settings.get(CONSTANTS.MODULE_ID, "enableTraining"));
    let currentWidth = app.position.width;
    let defaultWidth = app.options.width;
    let sheetIsSmaller = currentWidth < defaultWidth + game.settings.get(CONSTANTS.MODULE_ID, "extraSheetWidth");
    let sheetIsMonsterBlock = app.options.classes.includes("monsterblock");

    return settingEnabled && sheetHasTab && sheetIsSmaller && !sheetIsMonsterBlock;
}

async function migrateAllActors() {
    const LATEST_MIGRATION = 1;

    let updatesRequired = [];

    // Start loop through actors
    for (var i = 0; i < game.actors.contents.length; i++) {
        const a = game.actors.contents[i];

        // If the user can't update the actor, skip it
        let currentUserId = game.userId;
        let currentUserOwnsActor = a.permission[currentUserId] === 3;
        let currentUserIsGm = game.user.isGM;
        if (!currentUserOwnsActor && !currentUserIsGm) {
            Logger.debug(localize("downtime-dnd5e.Skipping") + ": " + a.data.name);
            continue;
        }

        // Flag items that need to be updated
        let itemsToUpdate = 0;
        let allTrainingItems = a.getFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.trainingItems) || [];
        for (var j = 0; j < allTrainingItems.length; j++) {
            let itemSchemaVersion = allTrainingItems[j].schemaVersion;
            if (itemSchemaVersion === undefined) {
                // Should only happen if it's coming from versions prior to 0.6.0
                allTrainingItems[j].updateMe = true;
                allTrainingItems[j].schemaVersion = 0;
                itemsToUpdate++;
            } else if (allTrainingItems[j].schemaVersion < LATEST_MIGRATION) {
                // If the latest is newer, gotta update
                allTrainingItems[j] = true;
                itemsToUpdate++;
            }
        }

        // If items need to be updated, add them to the updatesRequired array
        if (itemsToUpdate > 0) {
            updatesRequired.push({ actor: a, items: allTrainingItems });
        }
    }

    if (updatesRequired.length > 0) {
        // Prompt to see if the user wants to update their actors.
        let doUpdate = false;
        let content = `<h3>${localize("downtime-dnd5e.MigrationPromptTitle")}</h3>
                   <p>${game.i18n.format("downtime-dnd5e.MigrationPromptText1")}</p>
                   <h3>${localize("downtime-dnd5e.MigrationPromptBackupWarning")}</h3>
                   <p>${game.i18n.format("downtime-dnd5e.MigrationPromptText2")}</p>
                   <hr>
                   <p>${game.i18n.format("downtime-dnd5e.MigrationPromptText3", { num: updatesRequired.length })}</p>`;
        // Insert dialog
        new Dialog({
            title: `${CONSTANTS.MODULE_ID}`,
            content: content,
            buttons: {
                yes: {
                    icon: "<i class='fas fa-check'></i>",
                    label: localize("downtime-dnd5e.MigrationPromptYes"),
                    callback: () => (doUpdate = true),
                },
                no: {
                    icon: "<i class='fas fa-times'></i>",
                    label: localize("downtime-dnd5e.MigrationPromptNo"),
                    callback: () => (doUpdate = false),
                },
            },
            default: "no",
            close: async (html) => {
                // If they said yes, we migrate
                if (doUpdate) {
                    for (var i = 0; i < updatesRequired.length; i++) {
                        let thisUpdate = updatesRequired[i];
                        let a = thisUpdate.actor;
                        let allTrainingItems = thisUpdate.items;

                        // Backup old data and store in backup flag
                        let backup = { trainingItems: allTrainingItems, timestamp: new Date() };
                        Logger.info(localize("downtime-dnd5e.BackingUpDataFor") + ": " + a.data.name, true);
                        Logger.debug(localize("downtime-dnd5e.BackingUpDataFor") + ": " + a.data.name);
                        await a.setFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.backup, backup);

                        // Alert that we're migrating actor
                        Logger.info(localize("downtime-dnd5e.UpdatingDataFor") + ": " + a.data.name, true);
                        Logger.debug(localize("downtime-dnd5e.UpdatingDataFor") + ": " + a.data.name);

                        // Loop through items and update if they need updates
                        for (var j = 0; j < allTrainingItems.length; j++) {
                            if (allTrainingItems[j].updateMe) {
                                try {
                                    if (allTrainingItems[j].schemaVersion < 1) {
                                        allTrainingItems[j] = migrateToVersion1(allTrainingItems[j]);
                                    }
                                    // Repeat line for new versions as needed
                                } catch (err) {
                                    Logger.error(
                                        localize("downtime-dnd5e.ProblemUpdatingDataFor") +
                                        ": " +
                                        a.data.name,
                                        true,
                                        err,
                                    );
                                }
                                delete allTrainingItems[j].updateMe;
                            }
                        }
                        await a.setFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.trainingItems, allTrainingItems);
                        Logger.info(
                            localize("downtime-dnd5e.SuccessUpdatingDataFor") + ": " + a.data.name,
                            true,
                        );
                        Logger.debug(localize("downtime-dnd5e.SuccessUpdatingDataFor") + ": " + a.data.name);
                    }
                }
            },
        }).render(true);
    }
}

Hooks.on(`renderActorSheetV2`, (app: Downtime.ActorSheetApplication, html: JQuery, data: Record<string, unknown>) => {
    if (tidy5eApi?.isTidy5eSheet?.(app)) {
        return;
    }

    let widenSheet = adjustSheetWidth(app);
    if (widenSheet) {
        let newPos = { width: app.position.width + game.settings.get(CONSTANTS.MODULE_ID, "extraSheetWidth") };
        app.setPosition(newPos);
    }
    addTrainingTab(app, html, data).then(function () {
            if (app.activateTrainingTab) {
            app._tabs[0].activate("training");
        }
    });
});

Hooks.on(`TrainingTabReady`, (app, html, data) => {
    // Logger.log("Downtime tab ready!");
});

/**
 * An instance of the Tidy 5e Sheet API.
 * This becomes available when the `tidy5e-sheet.ready` hook fires.
 */
let tidy5eApi = undefined;

Hooks.on("tidy5e-sheet.ready", (api) => {
    tidy5eApi = api;
    api.registerCharacterTab(
        new api.models.HandlebarsTab({
            tabId: "downtime-dnd5e-training-tab",
            path: `modules/${CONSTANTS.MODULE_ID}/templates/partials/training-section-contents.hbs`,
            title: () => game.settings.get(CONSTANTS.MODULE_ID, "tabName"),
            getData: (data) => getTemplateData(data),
            enabled: (data) => {
                const showToUser = game.users.current.isGM || !game.settings.get(CONSTANTS.MODULE_ID, "gmOnlyMode");
                return data.editable && showToUser && game.settings.get(CONSTANTS.MODULE_ID, "enableTraining");
            },
            onRender: ({ app, element, data }) => {
                activateTabListeners(data.actor, app, $(element), data);
            },
            tabContentsClasses: ["downtime-dnd5e"],
            activateDefaultSheetListeners: false,
        }),
    );
    api.registerNpcTab(
        new api.models.HandlebarsTab({
            tabId: "downtime-dnd5e-training-tab",
            path: `modules/${CONSTANTS.MODULE_ID}/templates/partials/training-section-contents.hbs`,
            title: () => game.settings.get(CONSTANTS.MODULE_ID, "tabName"),
            getData: (data) => getTemplateData(data),
            enabled: (data) => {
                const showToUser = game.users.current.isGM || !game.settings.get(CONSTANTS.MODULE_ID, "gmOnlyMode");
                return data.editable && showToUser && game.settings.get(CONSTANTS.MODULE_ID, "enableTrainingNpc");
            },
            onRender: ({ app, element, data }) => {
                activateTabListeners(data.actor, app, $(element), data);
            },
            tabContentsClasses: ["downtime-dnd5e"],
            activateDefaultSheetListeners: false,
        }),
    );
});

// Open up for other people to use
/** @deprecated remain for retrocompatibility */
export function crashTNT() {
    async function updateActivityProgress(actorName, itemName, newProgress) {
        await API.updateActivityProgress(actorName, itemName, newProgress);
    }

    function getActivitiesForActor(actorName) {
        return API.getActivitiesForActor(actorName);

    }

    function getActivity(actorName, itemName) {
        return API.getActivity(actorName, itemName);

    }

    return {
        updateActivityProgress: updateActivityProgress,
        getActivity: getActivity,
        getActivitiesForActor: getActivitiesForActor,
    };
}

import { registerSettings } from "./settings.js";

import { migrateToVersion1 } from "./migrations/migrationNumber1.js";
import CONSTANTS from "./constants.js";
import API from "./api.js";
import Logger from "./lib/Logger.js";
import { getActorActivities, getWorldActivities } from "./utils/activities.js";
import { getActorCategories, getWorldCategories } from "./utils/categories.js";
import { localize } from "./utils/localize.js";
import { pluckId } from "./utils/pluckId.js";
import { mount, unmount } from "svelte";
import { registerTidy5eSheet } from "./integrations/tidy5e/tidy5e.js";
import {
  getSvelteElement,
  triggerUpdates,
  ensureSheetStoredValues,
  setSvelteInstance,
  setSvelteElement,
  getSvelteInstance,
} from "./lib/reactiveSheet.svelte.js";
import SheetContent from "./partial/SheetContent.svelte";
import { settings } from "./utils/settings.js";

// Register Game Settings
export const initHooks = () => {
  // Logger.warn("Init Hooks processing");
  // setup all the hooks
  registerSettings();
};

export const setupHooks = () => {
  const coreSheetHandler = (
    sheet: Downtime.ActorSheetApplication,
    form: HTMLFormElement,
    context,
    options,
  ) => {
    const downtimeTab = form.querySelector(
      'section[data-tab="downtime-dnd5e"]',
    );
    const mountRoot = downtimeTab?.querySelector("[data-svelte]");
    const tabs = form.querySelector('[data-container-id="tabs"]');

    if (tabs && downtimeTab && mountRoot) {
      tabs.append(downtimeTab);
      const element = getSvelteElement(sheet);
      if (element) {
        mountRoot.replaceWith(element);
        triggerUpdates(sheet);
        return;
      }
      ensureSheetStoredValues(sheet);
      setSvelteInstance(
        sheet,
        mount(SheetContent, {
          target: mountRoot,
          props: {
            sheet,
            actor: sheet.actor,
          },
        }),
      );
      setSvelteElement(sheet, mountRoot as HTMLElement);
    }
  };

  Hooks.on("renderCharacterActorSheet", coreSheetHandler);
  Hooks.on("renderNPCActorSheet", coreSheetHandler);

  Hooks.on("closeActorSheetV2", (sheet: Downtime.ActorSheetApplication) => {
    const instance = getSvelteInstance(sheet);
    if (instance) {
      unmount(instance);
      setSvelteInstance(sheet, undefined);
      setSvelteElement(sheet, undefined);
    }
  });

  Hooks.on(
    "tidy5e-sheet.ready",
    (
      api: import("tidy5e-sheet/src/api/Tidy5eSheetsApi.js").Tidy5eSheetsApi,
    ) => {
      registerTidy5eSheet(api);
    },
  );

  Hooks.on(
    "renderTidy5eCharacterSheetQuadrone",
    (sheet, form: HTMLFormElement, context, options) => {
      if (!options.isFirstRender) {
        triggerUpdates(sheet);
        return;
      }
      ensureSheetStoredValues(sheet);
    },
  );
};

export const readyHooks = () => {
  const mod = game?.modules?.get(CONSTANTS.MODULE_ID);
  if (mod) mod.api = API;
  migrateAllActors();
  addTabsToCoreSheets();
};

function addTabsToCoreSheets() {
  // We're doing this to cover our bases with the deprecation of ActorSheet5eCharacter2
  const sheet = (
    "CharacterActorSheet" in dnd5e.applications.actor
      ? (dnd5e.applications.actor as any).CharacterActorSheet
      : dnd5e.applications.actor.ActorSheet5eCharacter2
  ) as dnd5e.applications.actor.ActorSheet5eCharacter2 & {
    TABS: { label: string; tab: string; icon: string }[];
    PARTS: Record<string, { template: string }>;
  };

  const npcSheet = (
    "NPCActorSheet" in dnd5e.applications.actor
      ? (dnd5e.applications.actor as any).NPCActorSheet
      : dnd5e.applications.actor.NPCActorSheet
  ) as dnd5e.applications.actor.ActorSheet5eNPC2 & {
    TABS: { label: string; tab: string; icon: string }[];
    PARTS: Record<string, { template: string }>;
  };
  /**
   * Add the tab to the sidebar
   */
  sheet.TABS.push({
    label: "Downtime",
    tab: CONSTANTS.MODULE_ID,
    icon: "fas fa-clock",
  });

  npcSheet.TABS.push({
    label: "Downtime",
    tab: CONSTANTS.MODULE_ID,
    icon: "fas fa-clock",
  });

  /**
   * Add the template
   */
  sheet.PARTS[CONSTANTS.MODULE_ID] = {
    template: `modules/${CONSTANTS.MODULE_ID}/templates/training-section-v3.hbs`,
  };

  npcSheet.PARTS[CONSTANTS.MODULE_ID] = {
    template: `modules/${CONSTANTS.MODULE_ID}/templates/training-section-v3.hbs`,
  };
}

// The Meat And Potatoes
async function addTrainingTab(
  app: Downtime.ActorSheetApplication,
  html: HTMLFormElement,
  data: {
    actor: dnd5e.documents.Actor5e;
    isCharacter: boolean;
    isNPC: boolean;
  },
) {
  // Determine if we should show the downtime tab
  const enableCharacter = settings.enableTraining;
  const enableNpc = settings.enableTrainingNpc;
  const gmOnlyMode = settings.gmOnlyMode;

  let showToUser = game.user.isGM || (app.object.isOwner && gmOnlyMode);

  if (!showToUser) return;
  if (data.isCharacter && !enableCharacter) return;
  if (data.isNPC && !enableNpc) return;

  //Tab is ready
  Hooks.call(`TrainingTabReady`, app, html, data);
}

function getTemplateData(data) {
  const actor = data.actor;
  const notShowToUserEditMode =
    settings.gmOnlyEditMode && !game.users?.current?.isGM;
  const showImportButton = settings.showImportButton;

  const categoriesActor = getActorCategories(actor);
  const categoriesWorld = getWorldCategories();

  const categoriesActorIds = [...pluckId(categoriesActor)];
  const categoriesWorldIds = [...pluckId(categoriesWorld)];

  const activities = getActorActivities(actor);
  let activitiesCategorized = activities.filter(
    (activity) =>
      activity.category && categoriesActorIds.includes(activity.category),
  );
  let activitiesUnCategorized = activities.filter(
    (activity) =>
      !activity.category || !categoriesActorIds.includes(activity.category),
  );
  if (!game.user.isGM) {
    activitiesCategorized = activitiesCategorized.filter(
      (activity) => !activity.hidden,
    );
    activitiesUnCategorized = activitiesUnCategorized.filter(
      (activity) => !activity.hidden,
    );
  }

  let activitiesWorld = getWorldActivities();

  let activitiesWorldCategorized = activitiesWorld.filter(
    (activity) =>
      activity.category && categoriesWorldIds.includes(activity.category),
  );
  let activitiesWorldUnCategorized = activitiesWorld.filter(
    (activity) =>
      !activity.category || !categoriesWorldIds.includes(activity.category),
  );

  if (!game.user.isGM) {
    activitiesWorldCategorized = activitiesWorldCategorized.filter(
      (activity) => !activity.hidden,
    );
    activitiesWorldUnCategorized = activitiesWorldUnCategorized.filter(
      (activity) => !activity.hidden,
    );
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
  let settingEnabled = !!settings.extraSheetWidth;

  let sheetHasTab =
    (app.actor.type === "npc" && settings.enableTrainingNpc) ||
    (app.actor.type === "character" && settings.enableTraining);
  let currentWidth = app.position.width!;
  let defaultWidth = app.options.width!;
  let sheetIsSmaller = currentWidth < defaultWidth + settings.extraSheetWidth;
  let sheetIsMonsterBlock = app.options.classes.includes("monsterblock");

  return (
    settingEnabled && sheetHasTab && sheetIsSmaller && !sheetIsMonsterBlock
  );
}

async function migrateAllActors() {
  const LATEST_MIGRATION = 1;

  let updatesRequired = [];

  // Start loop through actors
  const currentUserId = game.userId as string;
  const currentUserIsGm = game.user.isGM;
  for (const actor of game.actors.contents as Iterable<
    dnd5e.documents.Actor5e<"character">
  >) {
    const currentUserOwnsActor =
      actor.permission === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    // If the user can't update the actor, skip it
    if (!currentUserOwnsActor && !currentUserIsGm) {
      Logger.debug(localize("downtime-dnd5e.Skipping") + ": " + actor.name);
      continue;
    }

    // Flag items that need to be updated
    let itemsToUpdate = 0;
    const allTrainingItems = getActorActivities(actor);

    for (let j = 0; j < allTrainingItems.length; j++) {
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
      updatesRequired.push({ actor: actor, items: allTrainingItems });
    }
  }

  if (updatesRequired.length > 0) {
    // Prompt to see if the user wants to update their actors.
    let doUpdate = false;
    let content = `<h3>${localize("downtime-dnd5e.MigrationPromptTitle")}</h3>
                   <p>${localize("downtime-dnd5e.MigrationPromptText1")}</p>
                   <h3>${localize("downtime-dnd5e.MigrationPromptBackupWarning")}</h3>
                   <p>${localize("downtime-dnd5e.MigrationPromptText2")}</p>
                   <hr>
                   <p>${localize("downtime-dnd5e.MigrationPromptText3", { num: String(updatesRequired.length) })}</p>`;
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
            let backup = {
              trainingItems: allTrainingItems,
              timestamp: new Date(),
            };
            Logger.info(
              localize("downtime-dnd5e.BackingUpDataFor") + ": " + a.name,
              true,
            );
            Logger.debug(
              localize("downtime-dnd5e.BackingUpDataFor") + ": " + a.name,
            );
            await a.setFlag(
              CONSTANTS.MODULE_ID,
              CONSTANTS.FLAGS.backup,
              backup,
            );

            // Alert that we're migrating actor
            Logger.info(
              localize("downtime-dnd5e.UpdatingDataFor") + ": " + a.name,
              true,
            );
            Logger.debug(
              localize("downtime-dnd5e.UpdatingDataFor") + ": " + a.name,
            );

            // Loop through items and update if they need updates
            for (var j = 0; j < allTrainingItems.length; j++) {
              if (allTrainingItems[j].updateMe) {
                try {
                  if (allTrainingItems[j].schemaVersion < 1) {
                    allTrainingItems[j] = migrateToVersion1(
                      allTrainingItems[j],
                    );
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
            await a.setFlag(
              CONSTANTS.MODULE_ID,
              CONSTANTS.FLAGS.trainingItems,
              allTrainingItems,
            );
            Logger.info(
              localize("downtime-dnd5e.SuccessUpdatingDataFor") +
                ": " +
                a.data.name,
              true,
            );
            Logger.debug(
              localize("downtime-dnd5e.SuccessUpdatingDataFor") +
                ": " +
                a.data.name,
            );
          }
        }
      },
    }).render(true);
  }
}

Hooks.on(`TrainingTabReady`, (app, html, data) => {
  Logger.log("Downtime tab ready!");
});

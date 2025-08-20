/**
 * This is your TypeScript entry file for Foundry VTT.
 * Register custom settings, sheets, and constants using the Foundry API.
 * Change this heading to be more descriptive to your module, or remove it.
 * Author: [your name]
 * Content License: [copyright and-or license] If using an existing system
 * 					you may want to put a (link to a) license or copyright
 * 					notice here (e.g. the OGL).
 * Software License: [your license] Put your desired license here, which
 * 					 determines how others may use and modify your module
 */
// Import JavaScript modules
// Import TypeScript modules
import { registerSettings } from "./scripts/settings.js";
import { initHooks, readyHooks, setupHooks } from "./scripts/5e-training.js";
import CONSTANTS from "./scripts/constants.js";
import { createApp, h, markRaw, reactive, readonly, ref, render, toRefs } from "vue";
import SheetContent from "./scripts/partial/SheetContent.vue";
import { SheetKey } from "./scripts/composables/useSheet.js";

/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once("init", async () => {
  registerSettings();
  initHooks();
});
/* ------------------------------------ */
/* Setup module							*/
/* ------------------------------------ */
Hooks.once("setup", function () {
  setupHooks();
});
/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */
Hooks.once("ready", async () => {
  // Do anything once the module is ready
  // if (!game.modules.get('lib-wrapper')?.active && game.user?.isGM) {
  //   let word = 'install and activate';
  //   if (game.modules.get('lib-wrapper')) word = 'activate';
  //   throw Logger.error(`Requires the 'libWrapper' module. Please ${word} it.`);
  // }
  // if (!game.modules.get('socketLib')?.active && game.user?.isGM) {
  //   let word = 'install and activate';
  //   if (game.modules.get('socketLib')) word = 'activate';
  //   throw Logger.error(`Requires the 'socketLib' module. Please ${word} it.`);
  // }
  readyHooks();
});

Hooks.on("renderActorSheetV2", (sheet: Downtime.ActorSheetApplication, form: HTMLFormElement, context, options) => {
  const downtimeTab = form.querySelector('section[data-tab="downtime-dnd5e"]');
  const mountRoot = downtimeTab?.querySelector("[data-vue]");
  const tabs = form.querySelector('[data-container-id="tabs"]');

  if (tabs && downtimeTab && mountRoot) {
    tabs.append(downtimeTab);
    // create some vue stuff

    if (!sheet[`__downtime-dnd5e_VUE_STATE__`]) {
      const state = {
        isEditMode: ref(false),
      };
      sheet[`__downtime-dnd5e_VUE_STATE__`] = state;
    }

    sheet[`__downtime-dnd5e_VUE_STATE__`].isEditMode.value = sheet["_mode"] === sheet.constructor.MODES.EDIT;

    if (sheet[`__${CONSTANTS.MODULE_ID}_INSTANCE__`]) {
      sheet[`__${CONSTANTS.MODULE_ID}_INSTANCE__`].unmount();
    }

    sheet[`__${CONSTANTS.MODULE_ID}_INSTANCE__`] = createApp(SheetContent)
      .provide("sheet", markRaw({ sheet, form, context, options }))
      .provide(SheetKey, sheet[`__${CONSTANTS.MODULE_ID}_VUE_STATE__`] as any);

    sheet[`__${CONSTANTS.MODULE_ID}_INSTANCE__`].mount(mountRoot);
  }
});

Hooks.on("closeActorSheetV2", (sheet: any) => {
  if (sheet[`__${CONSTANTS.MODULE_ID}_INSTANCE__`]) {
    sheet[`__${CONSTANTS.MODULE_ID}_INSTANCE__`].unmount();
    sheet[`__${CONSTANTS.MODULE_ID}_INSTANCE__`] = null;
  }
});

/* ------------------------------------ */
/* Other Hooks							*/
/* ------------------------------------ */
Hooks.once("devModeReady", ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag(CONSTANTS.MODULE_ID);
});

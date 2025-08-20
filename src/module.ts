import { registerSettings } from "./scripts/settings.js";
import { initHooks, readyHooks, setupHooks } from "./scripts/5e-training.js";
import CONSTANTS from "./scripts/constants.js";
import { mount, unmount } from "svelte";
import SheetContent from "./scripts/partial/SheetContent.svelte";
import { registerTidy5eSheet } from "./scripts/integrations/tidy5e/tidy5e.js";
window.mnt = mount
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
    readyHooks();
});

Hooks.on("renderActorSheetV2", (sheet: Downtime.ActorSheetApplication, form: HTMLFormElement, context, options) => {
    const downtimeTab = form.querySelector('section[data-tab="downtime-dnd5e"]');
    const mountRoot = downtimeTab?.querySelector("[data-svelte]");
    const tabs = form.querySelector('[data-container-id="tabs"]');

    if (tabs && downtimeTab && mountRoot) {
        tabs.append(downtimeTab);

        if (sheet[`__${CONSTANTS.MODULE_ID}_INSTANCE__`]) {
            unmount(sheet[`__${CONSTANTS.MODULE_ID}_INSTANCE__`]);
        }

        sheet[`__${CONSTANTS.MODULE_ID}_INSTANCE__`] = mount(SheetContent, {
            target: mountRoot,
            context: new Map([["sheet", { sheet, isEditMode: sheet["_mode"] === sheet.constructor.MODES.EDIT }]]),
        });
    }
});

Hooks.on(
    "tidy5e-sheet.ready",
    (api: import("../node_modules/tidy5e-sheet/src/api/Tidy5eSheetsApi.ts").Tidy5eSheetsApi) => {
        registerTidy5eSheet(api);
    },
);

Hooks.on("closeActorSheetV2", (sheet: any) => {
    if (sheet[`__${CONSTANTS.MODULE_ID}_INSTANCE__`]) {
        unmount(sheet[`__${CONSTANTS.MODULE_ID}_INSTANCE__`]);
        sheet[`__${CONSTANTS.MODULE_ID}_INSTANCE__`] = null;
    }
});

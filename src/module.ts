import { registerSettings } from "./scripts/settings.js";
import { initHooks, readyHooks, setupHooks } from "./scripts/5e-training.js";

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

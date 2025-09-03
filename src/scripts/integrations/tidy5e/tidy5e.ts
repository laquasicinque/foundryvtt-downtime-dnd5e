import {
  ensureSheetStoredValues,
  getSvelteInstance,
  getSvelteElement,
  setSvelteElement,
  triggerUpdates,
  setSvelteInstance,
} from "../../lib/reactiveSheet.svelte";
import SheetContent from "../../partial/Tidy5eSheetContent.svelte";
import { mount } from "svelte";

export function registerTidy5eSheet(
  api?: import("../../../../node_modules/tidy5e-sheet/src/api/Tidy5eSheetsApi.ts").Tidy5eSheetsApi,
) {
  if (!api) return;

  const tab = new api.models.HtmlTab({
    html: '<div class="scroll-container" data-svelte></div>',
    title: "Downtime",
    iconClass: "fa-solid fa-clock",
    tabId: "downtime",
    renderScheme: "force",
    onRender({ app, element, data, isFullRender, tabContentsElement }) {
      ensureSheetStoredValues(app);
      const existingInstance = getSvelteInstance(app);
      if (existingInstance) {
        triggerUpdates(app);
      } else {
        const target = tabContentsElement.querySelector("[data-svelte]");
        setSvelteInstance(
          app,
          mount(SheetContent, {
            target,
            props: {
              actor: data.actor,
              sheet: app,
            },
          }),
        );
        setSvelteElement(app, target);
      }
    },
    enabled: () => true,
  });

  api.registerCharacterTab(tab, { overrideExisting: true });
}

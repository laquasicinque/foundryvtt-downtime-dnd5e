import { ensureSheetStoredValues } from "../../lib/reactiveSheet.svelte";
import SheetContent from "../../partial/Tidy5eSheetContent.svelte";

export function registerTidy5eSheet(
  api?: import("../../../../node_modules/tidy5e-sheet/src/api/Tidy5eSheetsApi.ts").Tidy5eSheetsApi,
) {
  if (!api) return;

  const tab = new api.models.SvelteTab({
    component: SheetContent,
    title: "Downtime",
    iconClass: "fa-solid fa-clock",
    tabId: "downtime",
    getProps(data) {
      ensureSheetStoredValues(data.sheet);
      return {
        actor: data.actor,
        sheet: data.sheet,
        context: data.sheet._context,
      };
    },
    onRender() {
      console.log("hello");
    },
    enabled: () => true,
  });

  api.registerCharacterTab(tab, { overrideExisting: true });
}

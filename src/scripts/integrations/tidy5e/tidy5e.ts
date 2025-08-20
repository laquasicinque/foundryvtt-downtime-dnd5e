import api from "../../api";
import SheetContent from "../../partial/Tidy5eSheetContent.svelte";

export function registerTidy5eSheet(
    api?: import("../../../../node_modules/tidy5e-sheet/src/api/Tidy5eSheetsApi.ts").Tidy5eSheetsApi,
) {
    if (!api) return;

    const tab = new api.models.SvelteTab({
        component: SheetContent,
        title: "Downtime",
        iconClass: 'fa-solid fa-clock',
        tabId: "downtime",
        getProps(data) {
            return { actor: data.actor, sheet: data.sheet };
        },
        enabled: () => true,
        getContext(context) {
            const { data: { sheet } } = context.get('context')
            const myContext = new Map(context)
            myContext.set('sheet', sheet)
            return myContext
        },

    });

    api.registerCharacterTab(tab, { overrideExisting: true });
}

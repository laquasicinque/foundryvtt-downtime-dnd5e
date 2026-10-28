/**
 * The Downtime tab on actor sheets: the core dnd5e character/NPC sheets and
 * Tidy5e. Both mount the same component; it keeps itself up to date from
 * document hooks, so a sheet re-render only has to re-attach it.
 */
import { mount, unmount } from "svelte";
import { CONSTANTS } from "../../constants";
import { localize } from "../../foundry/i18n";
import {
    type ActorSheet,
    coreActorSheets,
    sheetActor,
} from "../../dnd5e/sheets";
import type { Actor } from "../../foundry/actors";
import { onHook } from "../../foundry/hooks";
import DowntimeTab from "../DowntimeTab.svelte";

type Sheet = ActorSheet;

/** The mounted tab per sheet, kept across re-renders. */
const mounted = new WeakMap<
    object,
    { instance: object; element: HTMLElement }
>();

/** Mount the tab into `target`, or move the existing one there. */
function attach(sheet: Sheet, actor: Actor, target: HTMLElement) {
    const existing = mounted.get(sheet);
    if (existing) {
        if (existing.element !== target) target.replaceWith(existing.element);
        return;
    }
    const instance = mount(DowntimeTab, { target, props: { actor, sheet } });
    mounted.set(sheet, { instance, element: target });
}

/** `closeActorSheetV2` fires for every actor sheet; only ours are in `mounted`. */
function detach(sheet: object) {
    const existing = mounted.get(sheet);
    if (!existing) return;
    void unmount(existing.instance);
    mounted.delete(sheet);
}

/** Core dnd5e sheets: add the tab part, mount on render. Call on ready. */
function registerCoreSheets() {
    for (const sheetClass of coreActorSheets()) {
        sheetClass.TABS.push({
            label: "downtime-dnd5e.Tab.Title",
            tab: CONSTANTS.MODULE_ID,
            icon: "fas fa-clock",
        });
        sheetClass.PARTS[CONSTANTS.MODULE_ID] = {
            // Keep this file name: it's loaded from the installed module
            // folder (including through the dev proxy).
            template: `modules/${CONSTANTS.MODULE_ID}/templates/training-section-v3.hbs`,
        };
    }

    const onRender: Downtime.SheetRenderHook = (sheet, form) => {
        const tab = form.querySelector<HTMLElement>(
            `section[data-tab="${CONSTANTS.MODULE_ID}"]`,
        );
        const root = tab?.querySelector<HTMLElement>("[data-svelte]");
        const tabs = form.querySelector('[data-container-id="tabs"]');
        if (!tab || !root || !tabs) return;
        tabs.append(tab);
        attach(sheet, sheetActor(sheet), root);
    };
    onHook("renderCharacterActorSheet", onRender);
    onHook("renderNPCActorSheet", onRender);
}

/** Tidy5e: a tab whose contents we mount ourselves. */
function registerTidy5e(api?: Tidy5e.Api) {
    if (!api) return;
    const tab = new api.models.HtmlTab({
        html: '<div class="scroll-container" data-svelte></div>',
        title: localize("downtime-dnd5e.Tab.Title"),
        iconClass: "fa-solid fa-clock",
        tabId: "downtime",
        renderScheme: "force",
        onRender({ app, data, tabContentsElement }) {
            const target =
                tabContentsElement.querySelector<HTMLElement>("[data-svelte]");
            if (target) attach(app, data.actor, target);
        },
        enabled: () => true,
    });
    api.registerCharacterTab(tab, { overrideExisting: true });
    api.registerNpcTab(tab, { overrideExisting: true });
}

/** Call from `init`. */
export function registerSheetTabs() {
    onHook("tidy5e-sheet.ready", (api) => registerTidy5e(api));
    onHook("closeActorSheetV2", detach);
    onHook("ready", registerCoreSheets);
}

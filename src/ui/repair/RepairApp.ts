import { CONSTANTS } from "../../constants";
import type { DeepPartial } from "../../types/utility";
import {
    type Configuration,
    SvelteApplication,
} from "../../foundry/SvelteApplication";
import { showApplication } from "../../foundry/applications";
import Repair from "./Repair.svelte";

/** GM: the downtime data repair tool. */
export class RepairApp extends SvelteApplication {
    static DEFAULT_OPTIONS = {
        id: `${CONSTANTS.MODULE_ID}-repair`,
        classes: ["downtime-dnd5e-repair"],
        svelte: { component: Repair },
        window: { title: "downtime-dnd5e.Repair.Title", resizable: true },
        position: { width: 620, height: 560 },
    } satisfies DeepPartial<Configuration>;

    override async _prepareContext() {
        return {};
    }
}

export function openRepair() {
    showApplication(`${CONSTANTS.MODULE_ID}-repair`, () => new RepairApp());
}

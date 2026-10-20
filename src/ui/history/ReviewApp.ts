import { CONSTANTS } from "../../constants";
import type { DeepPartial } from "../../types/utility";
import {
    type Configuration,
    SvelteApplication,
} from "../../foundry/SvelteApplication";
import { showApplication } from "../../foundry/applications";
import Review from "./Review.svelte";

/** GM: unreviewed changes across the world and all characters. */
export class ReviewApp extends SvelteApplication {
    static DEFAULT_OPTIONS = {
        id: `${CONSTANTS.MODULE_ID}-review`,
        classes: ["downtime-dnd5e-history"],
        svelte: { component: Review },
        window: { title: "downtime-dnd5e.Review.Title", resizable: true },
        position: { width: 640, height: 560 },
    } satisfies DeepPartial<Configuration>;

    override async _prepareContext() {
        return {};
    }
}

export function openReview() {
    showApplication(`${CONSTANTS.MODULE_ID}-review`, () => new ReviewApp());
}

import CONSTANTS from "../constants";
import { getActor } from "./getActor";

export function getActorCategories(actorOrId: string | dnd5e.documents.Actor5e | foundry.documents.Actor.Stored) {
    return getActor(actorOrId).getFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.categories) ?? []
}

export function getWorldCategories() {
    return game.settings.get(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.worldCategories) ?? []
}

export function setActorCategories(actorOrId: string | dnd5e.documents.Actor5e | foundry.documents.Actor.Stored, categories: Downtime.Category[]) {
    return getActor(actorOrId).setFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.categories, categories)
}

export function setWorldCategories(categories: Downtime.Category[]) {
    return game.settings.set(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.worldCategories, categories)
}

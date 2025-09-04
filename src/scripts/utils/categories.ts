import CONSTANTS from "../constants";
import { getActor } from "./getActor";

export function getActorCategories(actorOrId: Downtime.ActorResolvable) {
    return getActor(actorOrId).getFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.categories) ?? []
}

export function getActorCategoriesMap(actorOrId: Downtime.ActorResolvable) {
    return new Map(getActorCategories(actorOrId).map((x) => [x.id, x]));
}


export function getWorldCategories() {
    return game.settings.get(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.worldCategories) ?? []
}

export function getWorldCategoriesMap() {
    return new Map(getWorldCategories().map((x) => [x.id, x]));
}

export function getCategories({ actor }: { actor?: Downtime.ActorResolvable | null } = {}) {
    if (actor) {
        return getActorCategories(actor);
    }
    return getWorldCategories();
}

export function getCategoriesMap({ actor }: { actor?: Downtime.ActorResolvable | null } = {}) {
    if (actor) {
        return getActorCategoriesMap(actor);
    }
    return getWorldCategoriesMap();
}

export function setCategories({ actor, categories }: { actor?: Downtime.ActorResolvable | null, categories: Downtime.Category[] }) {
    if (actor) {
        return setActorCategories(actor, categories);
    }
    return setWorldCategories(categories);
}

export function setActorCategories(actorOrId: Downtime.ActorResolvable, categories: Downtime.Category[]) {
    return getActor(actorOrId).setFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.categories, categories)
}

export function setWorldCategories(categories: Downtime.Category[]) {
    return game.settings.set(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.worldCategories, categories)
}

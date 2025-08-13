import CONSTANTS from "../constants";
import { getActor } from "./getActor";

export function getActorActivities(actorOrId: string | dnd5e.documents.Actor5e | foundry.documents.Actor.Stored) {
    return getActor(actorOrId).getFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.trainingItems) ?? []
}

export function getActorActivitiesMap(actorOrId: string | dnd5e.documents.Actor5e | foundry.documents.Actor.Stored) {
    return new Map(getActorActivities(actorOrId).map(x => [x.id, x]))
}

export function getWorldActivities() {
    return game.settings.get(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.worldActivities) ?? []
}

export function getWorldActivitiesMap() {
    return new Map(getWorldActivities().map(x => [x.id, x]))
}


export function setActorActivities(actorOrId: string | dnd5e.documents.Actor5e | foundry.documents.Actor.Stored, items: Downtime.TrackedItem[]) {
    return getActor(actorOrId).setFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.trainingItems, items)
}


export function setWorldActivities(items: Downtime.TrackedItem[]) {
    return game.settings.set(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.worldActivities, items)
}

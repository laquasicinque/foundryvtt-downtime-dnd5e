import CONSTANTS from "../constants";
import { getActor } from "./getActor";

export function getActorActivities(actorOrId: Downtime.ActorResolvable) {
    return getActor(actorOrId).getFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.trainingItems) ?? [];
}

export function getActorActivitiesMap(actorOrId: Downtime.ActorResolvable) {
    return new Map(getActorActivities(actorOrId).map((x) => [x.id, x]));
}

export function getWorldActivities() {
    return game.settings.get(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.worldActivities) ?? [];
}

export function getWorldActivitiesMap() {
    return new Map(getWorldActivities().map((x) => [x.id, x]));
}

export function getActivities({ actor }: { actor?: Downtime.ActorResolvable | null } = {}) {
    if (actor) {
        return getActorActivities(actor);
    }
    return getWorldActivities();
}

export function getActivitiesMap({ actor }: { actor?: Downtime.ActorResolvable | null } = {}) {
    if (actor) {
        return getActorActivitiesMap(actor);
    }
    return getWorldActivitiesMap();
}

export function setActivities({ actor, items }: { actor?: Downtime.ActorResolvable | null, items: Downtime.TrackedItem[] }) {
    if (actor) {
        return setActorActivities(actor, items)
    }
    return setWorldActivities(items)
}

export function setActorActivities(
    actorOrId: Downtime.ActorResolvable,
    items: Downtime.TrackedItem[],
) {
    return getActor(actorOrId).setFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.trainingItems, items);
}

export function setWorldActivities(items: Downtime.TrackedItem[]) {
    return game.settings.set(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.worldActivities, items);
}

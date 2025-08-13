import TrackingAndTraining from "./TrackingAndTraining.js";
import CONSTANTS from "./constants.js";
import { RetrieveHelpers } from "./lib/retrieve-helpers.js";
import { getUserCharacter, isRealNumber } from "./lib/lib.js";
import { Logger } from './lib/Logger.js'
import { getActorActivities, setActorActivities, getWorldActivities, setWorldActivities } from "./utils/activities.js";
import { getActorCategories, getWorldCategories } from "./utils/categories.js";
import { localize } from "./utils/localize.js";
import { crashTNT } from "./5e-training.js";

const API = {

    crashTNT: undefined as ReturnType<typeof crashTNT> | undefined,
    /**
     * @deprecated
     * @param {Actor|string} actor
     * @param {string} activityName
     * @param {number|string} newProgress
     * @returns {Promise<void>}
     */
    async updateActivityProgress(actor: dnd5e.documents.Actor5e, activityName: string, newProgress: number) {
        return await this.updateActivity(actor, activityName, newProgress);
    },

    /**
     * @param {Actor|string} actor
     * @param {string} activityName
     * @param {number|string} newProgress
     * @returns {Promise<void>}
     */
    async updateActivity(actor: dnd5e.documents.Actor5e, activityName: string, newProgress: number) {
        const actorTmp = await RetrieveHelpers.getActorAsync(actor, false, false);
        if (!actorTmp) {
            Logger.warn(localize("downtime-dnd5e.ActorNotFoundWarning"), true);
            return;
        }
        const allItems = getActorActivities(actorTmp);
        const itemIdx = allItems.findIndex((i) => i.name === activityName);
        if (itemIdx < 0) {
            Logger.warn(localize("downtime-dnd5e.ItemNotFoundWarning") + ": " + activityName, true);
            return;
        }

        const newProgressI = Number(newProgress);
        if (!isRealNumber(newProgressI)) {
            Logger.warn(localize("downtime-dnd5e.ProgressValueIsNanWarning"), true);
            return;
        }

        // Increase progress
        let thisItem = allItems[itemIdx];
        if (!thisItem) {
            Logger.warn(localize("downtime-dnd5e.InvalidItemWarning"), true);
            return;
        }
        const alreadyCompleted = thisItem.progress >= thisItem.completionAt;
        thisItem = TrackingAndTraining.calculateNewProgress(
            thisItem,
            localize("downtime-dnd5e.LogActionMacro"),
            newProgressI,
            true,
        );
        // Log activity completion
        TrackingAndTraining.checkCompletion(actorTmp, thisItem, alreadyCompleted);
        // Update flags and actor
        allItems[itemIdx] = thisItem;
        await setActorActivities(actorTmp, allItems);
    },

    /**
     * @deprecated
     * @param {Actor|string} actor
     * @returns {Activity[]}
     */
    getActivitiesForActor(actor: dnd5e.documents.Actor5e | string) {
        return this.getActivities(actor);
    },

    /**
     * @param {Actor|string} actor
     * @returns {Activity[]}
     */
    getActivities(actor: dnd5e.documents.Actor5e | string) {
        const actorTmp = RetrieveHelpers.getActorSync(actor, false, false);
        if (actorTmp) {
            return getActorActivities(actorTmp);
        } else {
            Logger.warn(localize("downtime-dnd5e.ActorNotFoundWarning"), true);
            return [];
        }
    },

    /**
     *
     * @param {Actor|string} actor
     * @param {string} activityName
     * @returns {Activity}
     */
    getActivity(actor: Actor | string, activityName: string) {
        const actorTmp = RetrieveHelpers.getActorSync(actor, false, false);
        if (!actorTmp) {
            Logger.warn(localize("downtime-dnd5e.ActorNotFoundWarning"), true);
            return;
        }
        const allItems = getActorActivities(actorTmp);
        const itemIdx = allItems.findIndex((i) => i.name === activityName);
        if (itemIdx < 0) {
            Logger.warn(localize("downtime-dnd5e.ItemNotFoundWarning") + ": " + activityName, true);
            return;
        } else {
            return allItems[itemIdx];
        }
    },

    /**
     * @param {Actor|string} actor
     * @returns {Category[]}
     */
    getCategories(actor: Actor | string) {
        const actorTmp = RetrieveHelpers.getActorSync(actor, false, false);
        if (actorTmp)
            return getActorCategories(actorTmp);
        Logger.warn(localize("downtime-dnd5e.ActorNotFoundWarning"), true);
        return [];
    },

    /**
     * @deprecated
     * @param {string} activityName
     * @param {number|string} newProgress
     * @param {Actor|string} explicitActor
     * @returns {Promise<void>}
     */
    async updateWorldActivityProgress(activityName: string, newProgress: number, explicitActor: Actor) {
        return await this.updateWorldActivity(activityName, newProgress, explicitActor);
    },

    /**
     *
     * @param {string} activityName
     * @param {number|string} newProgress
     * @param {Actor|string} explicitActor
     * @returns {Promise<void>}
     */
    async updateWorldActivity(activityName: string, newProgress: number, explicitActor: Actor) {
        const actorTmp = explicitActor
            ? await RetrieveHelpers.getActorAsync(explicitActor, false, false)
            : getUserCharacter(game.user);
        if (!actorTmp) {
            Logger.warn(localize("downtime-dnd5e.ActorNotFoundWarning"), true);
            return;
        }
        const allItems = getWorldActivities();
        const itemIdx = allItems.findIndex((i) => i.name === activityName);
        if (itemIdx < 0) {
            Logger.warn(localize("downtime-dnd5e.ItemNotFoundWarning") + ": " + activityName, true);
            return;
        }

        const newProgressI = Number(newProgress);
        if (!isRealNumber(newProgressI)) {
            Logger.warn(localize("downtime-dnd5e.ProgressValueIsNanWarning"), true);
            return;
        }

        // Increase progress
        let thisItem = allItems[itemIdx];
        if (!thisItem) {
            Logger.warn(localize("downtime-dnd5e.InvalidItemWarning"), true);
            return;
        }
        const alreadyCompleted = thisItem.progress >= thisItem.completionAt;
        thisItem = TrackingAndTraining.calculateNewProgress(
            thisItem,
            localize("downtime-dnd5e.LogActionMacro"),
            newProgressI,
            true,
        );
        // Log activity completion
        TrackingAndTraining.checkCompletion(actorTmp, thisItem, alreadyCompleted);
        // Update flags and actor
        allItems[itemIdx] = thisItem;
        await setWorldActivities(allItems);
    },

    /**
     *
     * @returns {Activity[]}
     */
    getWorldActivities() {
        return getWorldActivities();
    },

    /**
     *
     * @param {string} activityName
     * @returns {Activity}
     */
    getWorldActivity(activityName: string) {
        const allItems = getWorldActivities();
        const itemIdx = allItems.findIndex((i) => i.name === activityName);
        if (itemIdx < 0) {
            Logger.warn(localize("downtime-dnd5e.ItemNotFoundWarning") + ": " + activityName, true);
            return;
        } else {
            return allItems[itemIdx];
        }
    },

    /**
     *
     * @returns {Category[]}
     */
    getWorldCategories() {
        return getWorldCategories();
    },
};
export default API;

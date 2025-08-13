import Category from "./Category.js";
import CONSTANTS from "./constants.js";
import TrackingAndTraining from "./TrackingAndTraining.js";
import { localize } from "./utils/localize.js";

export function registerHelpers() {
    Handlebars.registerHelper(`${CONSTANTS.MODULE_ID}-trainingCompletion`, function (trainingItem) {
        let percentComplete = Math.min(100, (100 * trainingItem.progress) / trainingItem.completionAt).toFixed(0);
        return percentComplete;
    });



    Handlebars.registerHelper(`${CONSTANTS.MODULE_ID}-progressionStyle`, function (item: Downtime.TrackedItem, actor: dnd5e.documents.Actor5e) {
        if (!item || !actor) {
            return "?";
        }

        let formatted = "";

        if (item.progressionStyle === "FIXED") {
            formatted = localize("downtime-dnd5e.ProgressionStyleFixed");
        } else if (item.progressionStyle === "ABILITY") {
            formatted = CONFIG.DND5E.abilities[item.ability].label;
        } else if (item.progressionStyle === "SKILL") {
            formatted = CONFIG.DND5E.skills[item.skill].label;
        } else if (item.progressionStyle === "TOOL") {
            let toolId = item.tool;
            let tool = actor.items.filter((item) => {
                return item._id === toolId;
            })[0];
            if (tool) {
                formatted = tool.name;
            } else {
                formatted = "[" + localize("downtime-dnd5e.InvalidTool") + "]";
            }
        } else if (item.progressionStyle === "MACRO") {
            formatted = localize("downtime-dnd5e.ProgressionStyleMacro");
        }

        if (item.dc) {
            formatted += " (" + localize("downtime-dnd5e.DC") + item.dc + ")";
        }

        return formatted;
    });

    Handlebars.registerHelper(`${CONSTANTS.MODULE_ID}-trainingRollBtnClass`, function (trainingItem) {
        let className = "downtime-dnd5e-roll";
        if (trainingItem.progress >= trainingItem.completionAt) {
            className = "downtime-dnd5e-roll-disabled";
        }
        return className;
    });

    Handlebars.registerHelper(`${CONSTANTS.MODULE_ID}-worldTrainingRollBtnClass`, function (trainingItem) {
        let className = "downtime-dnd5e-world-roll";
        if (trainingItem.progress >= trainingItem.completionAt) {
            className = "downtime-dnd5e-world-roll-disabled";
        }
        return className;
    });

    Handlebars.registerHelper(`${CONSTANTS.MODULE_ID}-trainingRollBtnTooltip`, function (trainingItem) {
        let text = localize("downtime-dnd5e.RollItemProgress");
        if (trainingItem.progress >= trainingItem.completionAt) {
            text = localize("downtime-dnd5e.RollItemDisabled");
        }
        return text;
    });

    Handlebars.registerHelper(`${CONSTANTS.MODULE_ID}-worldTrainingRollBtnTooltip`, function (trainingItem) {
        let text = localize("downtime-dnd5e.RollItemProgress");
        if (trainingItem.progress >= trainingItem.completionAt) {
            text = localize("downtime-dnd5e.RollItemDisabled");
        }
        return text;
    });

    Handlebars.registerHelper(`${CONSTANTS.MODULE_ID}-isInCategory`, function (actor: dnd5e.documents.Actor5e, category: Category) {
        let catId = category.id;
        let allTrainingItems = actor.getFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.trainingItems) ?? []
        const matchingItems = allTrainingItems.filter(item => {
            if (!item) {
                warn(localize("downtime-dnd5e.InvalidItemWarning"), true);
                return;
            }
            return item.category === catId
        })

        matchingItems.sort((a, b) => (a.name > b.name ? 1 : -1));
        return matchingItems;
    });

    Handlebars.registerHelper(`${CONSTANTS.MODULE_ID}-isInWorldCategory`, function (actor: dnd5e.documents.Actor5e, category) {
        const catId = category.id;
        let allTrainingItems = game.settings.get(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.worldActivities) || [];
        const matchingItems = allTrainingItems.filter(item => {
            if (!item) {
                warn(localize("downtime-dnd5e.InvalidItemWarning"), true);
                return false
            }
            return item.category === catId
        })

        matchingItems.sort((a, b) => (a.name > b.name ? 1 : -1));
        return matchingItems;
    });

    // Handlebars.registerHelper(`${CONSTANTS.MODULE_ID}-isUncategorized`, function (actor) {
    //   let allTrainingItems = actor.flags[CONSTANTS.MODULE_ID]?.trainingItems || [];
    //   let matchingItems = [];
    //   for (var i = 0; i < allTrainingItems.length; i++) {
    //     let thisItem = allTrainingItems[i];
    //     if(!thisItem){
    //      warn(localize("downtime-dnd5e.InvalidItemWarning"), true);
    //      return;
    //     }
    //     if (!thisItem.category) {
    //       matchingItems.push(thisItem);
    //     }
    //   }
    //   matchingItems.sort((a, b) => (a.name > b.name ? 1 : -1));
    //   return matchingItems;
    // });

    Handlebars.registerHelper(`${CONSTANTS.MODULE_ID}-getBarColor`, function (item: { progress: number, completionAt: number }) {
        // Derived from this: https://gist.github.com/mlocati/7210513
        let perc = Number(Math.min(100, (100 * item.progress) / item.completionAt).toFixed(0));
        let r = 0
        let g = 0
        if (perc < 50) {
            r = 255;
            g = Math.round(5.1 * perc);
        } else {
            g = 255;
            r = Math.round(510 - 5.1 * perc);
        }
        return `rgba(${r},${g},0,0.5)`;
    });
}

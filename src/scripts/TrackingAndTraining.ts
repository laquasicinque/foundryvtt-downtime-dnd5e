import { CategoryApp } from "./apps/CategoryApp.js";
import TrackedItemApp from "./apps/TrackedItemApp.js";
import { createTrackedItem } from "./TrackedItem.js";
import { createCategory } from "./Category.js";
import CONSTANTS from "./constants.js";
import { runMacroOnExplicitActor } from "./lib/lib.js";
import { RetrieveHelpers } from "./lib/retrieve-helpers.js";
import Logger from "./lib/Logger.js";
import { localize } from "./utils/localize.js";
import { getActorCategories, getCategories, setCategories, setActorCategories, setWorldCategories } from "./utils/categories.js";
import { getActorActivities, getActivities, setActivities, setActorActivities, setWorldActivities } from "./utils/activities.js";
import { getActor } from "./utils/getActor.js";
import { Iter } from "./utils/iterables/Iter.js";
import { pluckId } from "./utils/pluckId.js";
import { pluck } from "./utils/iterables/pluck.js";

const { DialogV2 } = foundry.applications.api;

export const TrackingAndTraining = {
    async addCategory(actorId: string, world = false) {
        Logger.debug("New Category excuted!");

        // As of writing this, the types cause issues with the actor object
        const actor = getActor(actorId) as any;
        new CategoryApp({
            actor,
            category: createCategory(),
            world,
        }).render({ force: true });
    },

    async editCategory(actorId: string, categoryId: string, world = false) {
        Logger.debug("Edit Category executed!");

        const actor = getActor(actorId) as any;
        const allCategories = getCategories({ actor: world ? undefined : actor });

        const category = allCategories.find((obj) => obj.id === categoryId);
        const catApp = new CategoryApp({
            actor,
            category,
            world,
            editing: true,
        })

        catApp.render({ force: true });

        return catApp.resolveOnClose
    },

    async deleteCategory(actorId: string, categoryId: string, world = false) {
        Logger.debug("Delete Category excuted!");

        // Set up some variables
        const actor = getActor(actorId);
        const allItems = getActivities({ actor: world ? undefined : actor });
        const allCategories = getCategories({ actor: world ? undefined : actor });

        // Create dialog
        const del = await DialogV2.confirm({
            window: {
                title: localize("downtime-dnd5e.DeleteCategory"),
            },
            content: localize("downtime-dnd5e.DeleteCategoryConfirmation"),
        });

        if (del) {
            for (const item of allItems) {
                if (item.category === categoryId) item.category = "";
            }

            // Update actor
            await setCategories({ actor: world ? null : actor, categories: allCategories.filter((x) => x.id !== categoryId) });
            await setActivities({ actor: world ? null : actor, items: allItems });
        }
    },

    async addItem(actorId: string, dropdownOptions: Downtime.DropdownOptions, world = false) {
        Logger.debug("New Item excuted!");
        const actor = getActor(actorId) as any;
        const categories = getCategories({ actor: world ? undefined : actorId });
        const activity = createTrackedItem({ progressionStyle: "ABILITY", ability: "int" });

        const data = {
            actor,
            activity,
            alreadyCompleted: activity.progress >= activity.completionAt,
            categories,
            dropdownOptions,
            world,
        };
        const tracked = new TrackedItemApp(data)
        tracked.render({ force: true });
        return tracked.resolveOnClose
    },

    async editFromSheet(
        actorId: string,
        itemId: string,
        dropdownOptions: Downtime.DropdownOptions,
        world = false,
    ) {
        Logger.debug("Edit Downtime Activity excuted!");
        const actor = getActor(actorId) as any;
        const categories = getCategories({ actor: world ? undefined : actor });
        const activities = getActivities({ actor: world ? undefined : actor });

        const activity = activities.find((obj) => obj.id === itemId);

        if (!activity) {
            Logger.warn(localize("downtime-dnd5e.InvalidItemWarning"), true);
            return;
        }

        const data = {
            actor,
            activity,
            alreadyCompleted: activity.progress >= activity.completionAt,
            categories,
            dropdownOptions,
            editMode: true,
            world,
        };
        const track = new TrackedItemApp(data)
        track.render({ force: true });

        return track.resolveOnClose
    },

    async deleteFromSheet(actorId: string, itemId: string, world = false) {
        Logger.debug("Delete Downtime Activity excuted!");

        // Set up some variables
        const actor = getActor(actorId);

        const del = await DialogV2.confirm({
            window: {
                title: localize("downtime-dnd5e.DeleteItem"),
            },
            content: localize("downtime-dnd5e.DeleteItemConfirmation"),
        });

        if (del) {
            const items = getActivities({ actor: world ? undefined : actor });
            const activity = items.find((obj) => obj.id === itemId);

            if (!activity) {
                Logger.warn(localize("downtime-dnd5e.InvalidItemWarning"), true);
                return;
            }

            await setActivities({ actor: world ? null : actor, items: items.filter((item) => activity.id !== item.id) });

            actor.sheet?.render(true);
        }
    },

    async updateItemProgressFromSheet(actorId: string, itemId: string, value: string, world = false) {
        Logger.debug("Progression Override excuted!");

        // Set up some variables
        const actor = getActor(actorId);
        const allItems = getActivities({ actor: world ? undefined : actor });

        let activity = allItems.find((obj) => obj.id === itemId);
        if (!activity) {
            Logger.warn(localize("downtime-dnd5e.InvalidItemWarning"), true);
            return;
        }

        let adjustment = 0;
        let alreadyCompleted = activity.progress >= activity.completionAt;

        // Format input and change
        if (value.charAt(0) === "+") {
            let changeName = localize("downtime-dnd5e.AdjustProgressValue") + " (+)";
            adjustment = parseInt(value.slice(1).trim());
            activity = TrackingAndTraining.calculateNewProgress(activity, changeName, adjustment);
        } else if (value.charAt(0) === "-") {
            let changeName = localize("downtime-dnd5e.AdjustProgressValue") + " (-)";
            adjustment = 0 - parseInt(value.slice(1).trim());
            activity = TrackingAndTraining.calculateNewProgress(activity, changeName, adjustment);
        } else {
            let changeName = localize("downtime-dnd5e.AdjustProgressValue") + " (=)";
            adjustment = parseInt(value);
            activity = TrackingAndTraining.calculateNewProgress(activity, changeName, adjustment, true);
        }

        // Log completion
        TrackingAndTraining.checkCompletion(actor, activity, alreadyCompleted);

        // Update flags and actor
        await setActivities({ actor: world ? undefined : actor, items: allItems });

        actor.sheet?.render(true);
    },

    async progressItem(actorId: string, itemId: string, world = false) {
        Logger.debug("Progress Downtime Activity excuted!");

        // Set up some variables
        const actor = getActor(actorId);
        const allItems = getActivities({ actor: world ? undefined : actor });

        let activity = allItems.filter((obj) => obj.id === itemId)[0];
        if (!activity) {
            Logger.warn(localize("downtime-dnd5e.InvalidItemWarning"), true);
            return;
        }
        const rollType = activity.progressionStyle;
        const alreadyCompleted = activity.progress >= activity.completionAt;

        // Progression Type: Ability Check or DC - ABILITY
        if (rollType === "ABILITY") {
            const abilityName = CONFIG.DND5E.abilities[activity.ability].label;
            // Roll to increase progress
            const options = TrackingAndTraining.getRollOptions();
            const r = await actor.rollAbilityCheck({ ...options, ability: activity.ability });

            if (r) {
                const attemptName = localize("downtime-dnd5e.Roll") + " " + abilityName;
                // Increase progress
                const progressChange = TrackingAndTraining.getRollResult(r);

                activity = TrackingAndTraining.calculateNewProgress(activity, attemptName, progressChange);
                // Log item completion
                TrackingAndTraining.checkCompletion(actor, activity, alreadyCompleted);
                // Update flags and actor
                await setActivities({ actor: world ? null : actor, items: allItems });

                actor.sheet?.render(true);
            }
        }

        // Progression Type: Ability Check or DC - SKILL
        else if (rollType === "SKILL") {
            const abilityName = CONFIG.DND5E.skills[activity.skill].label;

            // Roll to increase progress
            const options = TrackingAndTraining.getRollOptions();
            const r = await actor.rollSkill({ ...options, skill: activity.skill });
            if (r) {
                const attemptName = localize("downtime-dnd5e.Roll") + " " + abilityName;
                // Increase progress
                const progressChange = TrackingAndTraining.getRollResult(r);
                activity = TrackingAndTraining.calculateNewProgress(activity, attemptName, progressChange);
                // Log item completion
                TrackingAndTraining.checkCompletion(actor, activity, alreadyCompleted);
                // Update flags and actor
                await setActivities({ actor: world ? null : actor, items: allItems });

                actor.sheet?.render(true);
            }
        }

        // Progression Type: Ability Check or DC - TOOL
        else if (rollType === "TOOL") {
            const toolId = activity.tool;
            const tool = actor.items.get(toolId) as dnd5e.documents.Item5e<"tool">;
            if (tool) {
                const toolName = tool.name;
                // Roll to increase progress
                const options = TrackingAndTraining.getRollOptions();
                const r = await tool.rollToolCheck(options);
                if (r) {
                    const attemptName = localize("downtime-dnd5e.Roll") + " " + toolName;
                    // Increase progress
                    const progressChange = TrackingAndTraining.getToolRollResult(r);
                    activity = TrackingAndTraining.calculateNewProgress(activity, attemptName, progressChange);
                    // Log item completion
                    TrackingAndTraining.checkCompletion(actor, activity, alreadyCompleted);
                    // Update flags and actor
                    if (world) {
                        await setWorldActivities(allItems);
                    } else {
                        await setActorActivities(actor, allItems);
                    }

                    actor.sheet?.render(true);
                }
            } else {
                Logger.warn(localize("downtime-dnd5e.ToolNotFoundWarning"));
            }
        }

        // Progression Type: Simple
        else if (rollType === "FIXED") {
            const itemName = localize("downtime-dnd5e.ProgressionStyleFixed");
            // Increase progress
            activity = TrackingAndTraining.calculateNewProgress(activity, itemName, activity.fixedIncrease);
            // Log item completion
            TrackingAndTraining.checkCompletion(actor, activity, alreadyCompleted);
            // Update flags and actor
            await setActivities({ actor: world ? null : actor, items: allItems });

            actor.sheet?.render(true);
        }

        // Progression Type: Macro
        else if (rollType === "MACRO") {
            const macroName = activity.macroName;
            // let macro = game.macros.getName(macroName);
            const macro = await RetrieveHelpers.getMacroAsync(macroName, false, false);
            if (macro) {
                const macroData = [];
                // macro.execute();
                runMacroOnExplicitActor(actor, macro, macroData);
            } else {
                Logger.warn(localize("downtime-dnd5e.MacroNotFoundWarning") + ": " + macroName, true);
            }
        }
    },

    // Figures out what options we need to tack onto any rolls we do for things to work as expected
    getRollOptions() {
        const options = {} as Partial<dnd5e.dice.D20Roll.Configuration & { rollMode: string; vanilla: boolean }>;
        if (game.settings.get(CONSTANTS.MODULE_ID, "gmOnlyMode")) {
            options.rollMode = "gmroll";
        } //GM Only Mode
        if (
            !game.modules.get("midi-qol")?.active ||
            foundry.utils.isNewerVersion(game.modules.get("midi-qol").version, "0.9.25")
        ) {
            options.vanilla = true;
        } //Handles BR. Want it on in all cases except when midi is enabled
        return options;
    },

    // Gets the result of the roll. Necessary for compatibility with BR, which returns CustomItemRoll objects.
    getRollResult(roll: Downtime.Roll[]) {
        return Iter.from(roll).pluck("total").filterNullish().sum();
    },

    // Gets the result of the roll. Necessary for compatibility with BR, which returns CustomItemRoll objects.
    // This is slightly different for tools because of how the object gets attached to the roll.
    getToolRollResult(roll: Downtime.Roll) {
        let result;
        if (roll.BetterRoll) {
            result = roll.BetterRoll.entries.filter((entry) => entry.type == "multiroll")[0].entries[0].total;
        } else {
            result = roll.total;
        }
        return Number(result);
    },

    // Calculates the progress value of an item and logs the change to the progress
    // if absolute is true, set progress to the change value rather than adding to it
    // RETURNS THE ENTIRE ITEM
    calculateNewProgress(item: Downtime.TrackedItem, actionName: string, change: number, absolute = false) {
        let newProgress = 0;

        if (absolute) {
            newProgress = change;
        } else {
            if (item.dc) {
                //if there's a dc set
                if (change >= item.dc) {
                    //if the check beat the dc
                    newProgress = item.progress + 1; //increase the progress
                } else {
                    //check didnt beat dc
                    newProgress = item.progress; //add nothing
                }
            } else {
                //if no dc set
                newProgress = item.progress + change;
            }
        }

        if (newProgress > item.completionAt) {
            newProgress = item.completionAt;
        } else if (newProgress < 0) {
            newProgress = 0;
        }

        // Log item change
        // Make sure flags exist and add them if they don't
        if (!item.changes) {
            item.changes = [];
        }
        // Create and add new change to log
        const logEntry = {
            id: foundry.utils.randomID(),
            timestamp: new Date(),
            actionName: actionName,
            valueChanged: "progress",
            oldValue: item.progress,
            newValue: newProgress,
            user: game.user.name,
            note: "",
        } as Downtime.AuditLogV1;
        item.changes.push(logEntry);

        item.progress = newProgress;
        return item;
    },

    // Checks for completion of an item and alerts if it's done
    async checkCompletion(
        actor: dnd5e.documents.Actor5e,
        activity: Downtime.TrackedItem,
        alreadyCompleted: boolean,
    ) {
        if (alreadyCompleted) {
            return;
        }
        if (activity.progress >= activity.completionAt) {
            const alertFor = game.settings.get(CONSTANTS.MODULE_ID, "announceCompletionFor");
            const isPc = actor.hasPlayerOwner;
            let sendIt;

            switch (alertFor) {
                case "none":
                    sendIt = false;
                    break;
                case "both":
                    sendIt = true;
                    break;
                case "npc":
                    sendIt = !isPc;
                    break;
                case "pc":
                    sendIt = isPc;
                    break;
                default:
                    sendIt = false;
            }

            if (sendIt) {
                Logger.debug("" + actor.name + " " + localize("downtime-dnd5e.CompletedATrackedItem"));
                const chatHtml = await renderTemplate(`modules/${CONSTANTS.MODULE_ID}/templates/completion-message.hbs`, {
                    actor: actor,
                    activity: activity,
                });
                const chatObj: { content: string; whisper?: foundry.documents.User.Stored[] } = { content: chatHtml };
                if (game.settings.get(CONSTANTS.MODULE_ID, "gmOnlyMode")) {
                    chatObj.whisper = ChatMessage.getWhisperRecipients("GM");
                }
                ChatMessage.create(chatObj);
            }
        }
    },

    // Determines what kind of item is being rolled, be it a skill check, an ability check, or a tool check
    // OLD METHOD, STILL USED BY MIGRATION #1
    determineRollType(item: Downtime.TrackedItem) {
        let rollType;
        const abilities = ["str", "dex", "con", "int", "wis", "cha"];
        const skills = [
            "acr",
            "ani",
            "arc",
            "ath",
            "dec",
            "his",
            "ins",
            "inv",
            "itm",
            "med",
            "nat",
            "per",
            "prc",
            "prf",
            "rel",
            "slt",
            "ste",
            "sur",
        ];

        // checks for post-migration 1 types and returns
        if (["ABILITY", "SKILL", "TOOL", "MACRO", "FIXED"].includes(item.progressionStyle)) {
            return item.progressionStyle;
        }

        if (item.progressionStyle === "ABILITY") {
            if (abilities.includes(item.ability)) {
                rollType = "ability";
            } else if (skills.includes(item.ability)) {
                rollType = "skill";
            } else if (item.ability.substr(0, 5) === "tool-") {
                rollType = "tool";
            }
        } else if (item.progressionStyle === "MACRO") {
            rollType = "macro";
        } else {
            rollType = "simple";
        }

        return rollType;
    },

    // Gets and formats an array of tools the actor has in their inventory. Used for selection menus
    getActorTools(actorId: string) {
        const actor = getActor(actorId);
        const items = actor.items as foundry.abstract.EmbeddedCollection<dnd5e.documents.Item5e, dnd5e.documents.Actor5e>;
        const tools = items.filter((item) => (item.type as string) === "tool");
        const formatted = tools.map((obj) => {
            return {
                value: obj._id,
                label: obj.name,
            };
        });
        return formatted;
    },

    formatAbilitiesForDropdown() {
        return [
            { value: "str", type: "ability", label: localize("DND5E.AbilityStr") },
            { value: "dex", type: "ability", label: localize("DND5E.AbilityDex") },
            { value: "con", type: "ability", label: localize("DND5E.AbilityCon") },
            { value: "int", type: "ability", label: localize("DND5E.AbilityInt") },
            { value: "wis", type: "ability", label: localize("DND5E.AbilityWis") },
            { value: "cha", type: "ability", label: localize("DND5E.AbilityCha") },
        ] as const;
    },

    formatSkillsForDropdown() {
        return [
            { value: "acr", type: "skill", label: localize("DND5E.SkillAcr") },
            { value: "ani", type: "skill", label: localize("DND5E.SkillAni") },
            { value: "arc", type: "skill", label: localize("DND5E.SkillArc") },
            { value: "ath", type: "skill", label: localize("DND5E.SkillAth") },
            { value: "dec", type: "skill", label: localize("DND5E.SkillDec") },
            { value: "his", type: "skill", label: localize("DND5E.SkillHis") },
            { value: "ins", type: "skill", label: localize("DND5E.SkillIns") },
            { value: "inv", type: "skill", label: localize("DND5E.SkillInv") },
            { value: "itm", type: "skill", label: localize("DND5E.SkillItm") },
            { value: "med", type: "skill", label: localize("DND5E.SkillMed") },
            { value: "nat", type: "skill", label: localize("DND5E.SkillNat") },
            { value: "per", type: "skill", label: localize("DND5E.SkillPer") },
            { value: "prc", type: "skill", label: localize("DND5E.SkillPrc") },
            { value: "prf", type: "skill", label: localize("DND5E.SkillPrf") },
            { value: "rel", type: "skill", label: localize("DND5E.SkillRel") },
            { value: "slt", type: "skill", label: localize("DND5E.SkillSlt") },
            { value: "ste", type: "skill", label: localize("DND5E.SkillSte") },
            { value: "sur", type: "skill", label: localize("DND5E.SkillSur") },
        ] as const;
    },

    getDowntimeDropdownOptions(actorId: string): Downtime.DropdownOptions {
        const actorTools = TrackingAndTraining.getActorTools(actorId);
        const ABILITIES = TrackingAndTraining.formatAbilitiesForDropdown();
        const SKILLS = TrackingAndTraining.formatSkillsForDropdown();
        return { abilities: ABILITIES, skills: SKILLS, tools: actorTools } as Downtime.DropdownOptions;
    },

    exportItems(actorId: string) {
        const actor = getActor(actorId);
        const allItems = getActorActivities(actor);
        const allCategories = getActorCategories(actor);
        const dataToExport = {
            items: allItems,
            categories: allCategories,
        };
        if (allItems.length < 1 && allCategories.length < 1) {
            Logger.info(localize("downtime-dnd5e.ExportNoTrackedItems"), true);
            return;
        }
        const jsonData = JSON.stringify(dataToExport);
        foundry.utils.saveDataToFile(jsonData, "application/json", `${actor.id}-tracked-items-backup.json`);
    },

    async importItems(actorId: string) {
        const actor = getActor(actorId);
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.addEventListener("change", function (event) {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) {
                Logger.info(localize("downtime-dnd5e.ImportNoFile"), true);
                return;
            }
            foundry.utils.readTextFromFile(file).then(async (contents) => {
                const importedData = JSON.parse(contents);
                let importedItems = [];
                let importedCategories = [];

                // Handles old format of export/import
                if (importedData.items) {
                    importedItems = importedData.items;
                    importedCategories = importedData.categories;
                } else {
                    await DialogV2.confirm({
                        window: { title: localize("downtime-dnd5e.ImportOldWarningTitle") },
                        content: localize("downtime-dnd5e.ImportOldWarningText"),
                    });

                    Logger.debug("Import detected old format.", importedData);
                    importedItems = importedData;
                }

                if (importedItems.length < 1 && importedCategories.legnth < 1) {
                    Logger.info(localize("downtime-dnd5e.ImportNoTrackedItems"), true);
                    return;
                }

                const currentCategories = getActorCategories(actor);
                const currentCategoryIds = [...pluckId(currentCategories)];
                const currentCategoryNames = [...pluck(currentCategories, "name")];
                const categoriesToDelete: string[] = [];

                for (let i = 0; i < importedCategories.length; i++) {
                    // De-dupe category ID's
                    if (currentCategoryIds.indexOf(importedCategories[i].id) > -1) {
                        const newId = foundry.utils.randomID();
                        const oldId = importedCategories[i].id;
                        for (let j = 0; j < importedItems.length; j++) {
                            if (importedItems[j].category === oldId) {
                                importedItems[j].category = newId;
                            }
                        }
                        importedCategories[i].id = newId;
                    }

                    // If category exists with same name, combine into one category
                    if (currentCategoryNames.indexOf(importedCategories[i].name) > -1) {
                        let newCategory = importedCategories[i];
                        let existingCategory = currentCategories.filter((obj) => obj.name === importedCategories[i].name)[0];
                        let existingCategoryId = existingCategory.id;
                        let importedCategoryId = newCategory.id;

                        for (var j = 0; j < importedItems.length; j++) {
                            if (importedItems[j].category === importedCategoryId) {
                                importedItems[j].category = existingCategoryId;
                            }
                        }
                        // Flag these categories for deletion
                        categoriesToDelete.push(importedCategoryId);
                    }
                }

                const currentItems = getActorActivities(actor);
                const currentIds = [...pluckId(currentItems)];

                for (var i = 0; i < importedItems.length; i++) {
                    // De-dupe item ID's
                    if (currentIds.indexOf(importedItems[i].id) > -1) {
                        importedItems[i].id = randomID();
                    }

                    // Unset missing category ID's
                    let importedCategoryIds = [...pluckId(importedCategories)] as string[];
                    let availableCategoryIds = currentCategoryIds.concat(importedCategoryIds);
                    if (availableCategoryIds.length === 0 || availableCategoryIds.indexOf(importedItems[i].category) === -1) {
                        importedItems[i].category = "";
                    }
                }

                const combinedItems = currentItems.concat(importedItems);
                const combinedCategories = currentCategories
                    .concat(importedCategories)
                    .filter((c) => !categoriesToDelete.includes(c.id));

                await setActorCategories(actor, combinedCategories);
                await setActorActivities(actor, combinedItems);

                Logger.info(localize("downtime-dnd5e.ImportComplete"), true);

                actor.sheet?.render(true);
            });
        });
        input.click();
    },

    async moveActivity({ sourceId, targetId, targetActorId, sourceActorId }: { sourceId: string, targetId: string, targetActorId?: string, sourceActorId?: string }) {
        if (sourceId === targetId) return

        const sourceActor = sourceActorId ? getActor(sourceActorId) : null
        const targetActor = targetActorId ? getActor(targetActorId) : null

        const sourceActivities = getActivities({ actor: sourceActor })
        const targetActivities = getActivities({ actor: targetActor })

        const sourceIdx = sourceActivities.findIndex(({ id }) => id === sourceId)
        const targetIdx = targetActivities.findIndex(({ id }) => id === targetId)

        // Can't find one of the activites, abort
        if (sourceIdx === -1 || targetIdx === -1) return

        const source = sourceActivities[sourceIdx]
        const target = targetActivities[targetIdx]

        // if the categories match, then we're just moving something within a category
        if (source.category === target.category) {
            // Filter out the source item, then,reinsert next to target
            const newActivities = Iter.from(targetActivities)
                .filter((item) => item.id !== sourceId)
                .flatMap((item) => {
                    if (item.id !== target.id) return item
                    const diff = sourceIdx - targetIdx
                    // if the items were next to each other, swap em
                    if (Math.abs(diff) === 1) {
                        return targetIdx > sourceIdx ? [target, source] : [source, target]
                    }

                    return [target, source]
                }).collect()
            setActivities({ actor: targetActor, items: newActivities })
        } else {
            // The categories are different, this could be because:
            // - Moving from one category to another within an actor or world
            // - Moving from actor downtime to world downtime or vice versa
            // - Moving downtime between characters
            // In the first case, we need to simultaneously remove and add from the same activities
            // in the last two, we remove from the source, then add to the target

            source.category = target.category
            if (sourceActor === targetActor) {
                const newActivities = Iter.from(targetActivities)
                    .filter((item) => item.id !== sourceId)
                    .flatMap((item) => {
                        if (item.id !== target.id) return item
                        return [target, source]
                    }).collect()
                setActivities({ actor: targetActor, items: newActivities })
            } else {
                const newSourceActivities = sourceActivities.filter(item => item.id !== sourceId)
                setActivities({ actor: sourceActor, items: newSourceActivities })

                const newTargetActivities = targetActivities.flatMap((item) => {
                    if (item.id !== targetId) return item
                    return [target, source]
                })

                setActivities({ actor: targetActor, items: newTargetActivities })
            }

        }
    }
};

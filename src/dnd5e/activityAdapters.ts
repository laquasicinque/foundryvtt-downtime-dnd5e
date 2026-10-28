/**
 * Built-in activity roll adapters for dnd5e 6, mirroring how
 * dnd5e's own activities roll (see CheckActivity#rollCheck). Other modules
 * can register adapters for their activity types on the
 * `downtime-dnd5e.registerActivityAdapters` hook or via `api.v3.activityAdapters`.
 */
import { CONSTANTS } from "../constants";
import { type Actor, actorDocument } from "../foundry/actors";
import { callHook } from "../foundry/hooks";
import { Logger } from "../foundry/Logger";
import { ActivityAdapterRegistry } from "../model/ActivityAdapterRegistry";
import type { RollLike } from "../types/rolls";
import type {
    Activity5e,
    ActivityRollOption,
    ActivityRollResult,
} from "../types/activities";
import {
    abilityLabel,
    type AbilityKey,
    isSkillKey,
    isToolKey,
    saveLabel,
    skillLabel,
    toolLabel,
} from "./config";
import { isToolItem } from "./actors";
import { replaceFormulaData } from "./rolls";
import { finiteOrNull } from "../lib/values";

type Actor5e = Dnd5e.latest.Actor;

const checkAdapter = {
    type: "check",
    source: CONSTANTS.MODULE_ID,
    options(activity: Activity5e, actor: Actor5e): ActivityRollOption[] {
        const check = activity.check;
        if (!check) return [];
        const dc = finiteOrNull(check.dc?.value);
        const associated = [...(check.associated ?? [])];
        const toolItem = isToolItem(activity.item) ? activity.item : null;
        const baseItem = toolItem?.system.type.baseItem;
        if (!associated.length && baseItem) associated.push(baseItem);

        // Activity bonus, as dnd5e adds it.
        const bonusFormula = check.bonus
            ? replaceFormulaData(check.bonus, activity.getRollData())
            : "";
        const baseConfig = (ability: AbilityKey | null | undefined) => ({
            ...(ability && { ability }),
            ...(dc !== null && { target: dc }),
            ...(bonusFormula && { rolls: [{ parts: [bonusFormula] }] }),
        });

        const option = (
            label: string,
            rolled: ActivityRollResult["rolled"],
            roll: () => Promise<RollLike[] | null | undefined>,
        ): ActivityRollOption => ({
            label,
            roll: async () => {
                const [first] = (await roll()) ?? [];
                return first ? { roll: first, rolled, dc } : null;
            },
        });

        if (associated.length) {
            return associated.flatMap((key): ActivityRollOption[] => {
                const ability = activity.getAbility?.(key) ?? check.ability;
                if (isSkillKey(key)) {
                    return [
                        option(
                            skillLabel(key),
                            {
                                kind: "SKILL",
                                key,
                                label: skillLabel(key),
                                activityName: activity.name,
                            },
                            () =>
                                actor.rollSkill({
                                    ...baseConfig(ability),
                                    skill: key,
                                }),
                        ),
                    ];
                }
                if (!isToolKey(key)) return [];
                const ownTool =
                    toolItem && (!baseItem || key === baseItem)
                        ? toolItem
                        : null;
                return [
                    option(
                        toolLabel(key),
                        {
                            kind: "TOOL",
                            key,
                            label: toolLabel(key),
                            activityName: activity.name,
                            ...(ownTool?.name && {
                                toolItemName: ownTool.name,
                            }),
                        },
                        () =>
                            actor.rollToolCheck({
                                ...baseConfig(ability),
                                tool: key,
                                ...(ownTool && {
                                    bonus: ownTool.system.bonus,
                                    prof: ownTool.system.prof,
                                    item: ownTool,
                                }),
                            }),
                    ),
                ];
            });
        }
        if (!check.ability) return [];
        const ability = check.ability;
        return [
            option(
                abilityLabel(ability),
                {
                    kind: "ABILITY",
                    key: ability,
                    label: abilityLabel(ability),
                    activityName: activity.name,
                },
                () =>
                    actor.rollAbilityCheck({ ...baseConfig(ability), ability }),
            ),
        ];
    },
};

const saveAdapter = {
    type: "save",
    source: CONSTANTS.MODULE_ID,
    // The acting actor rolls the save themselves.
    options(activity: Activity5e, actor: Actor5e): ActivityRollOption[] {
        const save = activity.save;
        if (!save) return [];
        const dc = finiteOrNull(save.dc?.value);
        return [...(save.ability ?? [])].map((ability) => ({
            label: saveLabel(ability),
            roll: async () => {
                const [first] =
                    (await actor.rollSavingThrow({
                        ability,
                        ...(dc !== null && { target: dc }),
                    })) ?? [];
                return first
                    ? {
                          roll: first,
                          rolled: {
                              kind: "SAVE",
                              key: ability,
                              label: saveLabel(ability),
                              activityName: activity.name,
                          },
                          dc,
                      }
                    : null;
            },
        }));
    },
};

const utilityAdapter = {
    type: "utility",
    source: CONSTANTS.MODULE_ID,
    options(activity: Activity5e): ActivityRollOption[] {
        if (!activity.roll?.formula || !activity.rollFormula) return [];
        const label = activity.roll.name || activity.name;
        return [
            {
                label,
                roll: async () => {
                    const [first] = (await activity.rollFormula!()) ?? [];
                    return first
                        ? {
                              roll: first,
                              rolled: {
                                  kind: "CUSTOM",
                                  key: activity.id,
                                  label,
                                  activityName: activity.name,
                              },
                              dc: null,
                          }
                        : null;
                },
            },
        ];
    },
};

export const activityAdapters = new ActivityAdapterRegistry<
    Activity5e,
    Actor5e
>((message) => Logger.warn(message));
activityAdapters.register(checkAdapter);
activityAdapters.register(saveAdapter);
activityAdapters.register(utilityAdapter);

/** The ways `actor` can roll with this activity, from the registered adapters. */
export function activityRollOptions(
    activity: Activity5e,
    actor: Actor,
): ActivityRollOption[] {
    return activityAdapters.optionsFor(activity, actorDocument(actor));
}

/** Let other modules register adapters. Called once on ready. */
export function announceActivityAdapters() {
    callHook("downtime-dnd5e.registerActivityAdapters", activityAdapters);
}

/**
 * dnd5e ability, skill and tool keys. Stored data holds them as plain strings;
 * these narrow them to dnd5e's key types before they reach a roll.
 */
import { localize } from "../foundry/i18n";
import { compareText } from "../lib/text";
import type { RollSummary } from "../types/data";

export type AbilityKey = Dnd5e.latest.AbilityKey;
export type SkillKey = Dnd5e.latest.SkillKey;
export type ToolKey = Dnd5e.latest.ToolKey;

export const isAbilityKey = (key: string): key is AbilityKey =>
    key in CONFIG.DND5E.abilities;
export const isSkillKey = (key: string): key is SkillKey =>
    key in CONFIG.DND5E.skills;
export const isToolKey = (key: string): key is ToolKey =>
    key in CONFIG.DND5E.tools;

export const abilityLabel = (key: string): string =>
    isAbilityKey(key) ? CONFIG.DND5E.abilities[key].label : key;
export const skillLabel = (key: string): string =>
    isSkillKey(key) ? CONFIG.DND5E.skills[key].label : key;
export const toolLabel = (key: string): string =>
    dnd5e.documents.Trait.keyLabel(key, { trait: "tool" }) ?? key;

export const saveLabel = (ability: string): string =>
    localize("downtime-dnd5e.SaveLabel", { ability: abilityLabel(ability) });

/**
 * What a roll was of, built from its kind and key so it reads in the viewer's
 * language. Custom rolls, and keys dnd5e doesn't have (any more), use the
 * label stored with the roll.
 */
export function rolledLabel(rolled: RollSummary["rolled"]): string {
    switch (rolled.kind) {
        case "ABILITY":
            return isAbilityKey(rolled.key)
                ? abilityLabel(rolled.key)
                : rolled.label;
        case "SAVE":
            return isAbilityKey(rolled.key)
                ? saveLabel(rolled.key)
                : rolled.label;
        case "SKILL":
            return isSkillKey(rolled.key)
                ? skillLabel(rolled.key)
                : rolled.label;
        case "TOOL":
            return isToolKey(rolled.key) ? toolLabel(rolled.key) : rolled.label;
        default:
            return rolled.label;
    }
}

export interface KeyChoice {
    key: string;
    label: string;
}

/** Every ability, for pickers. */
export function abilityChoices(): KeyChoice[] {
    return Object.entries(CONFIG.DND5E.abilities).map(([key, v]) => ({
        key,
        label: v.label,
    }));
}

/** Every skill, for pickers. */
export function skillChoices(): KeyChoice[] {
    return Object.entries(CONFIG.DND5E.skills).map(([key, v]) => ({
        key,
        label: v.label,
    }));
}

/** Every tool, sorted by label, for pickers. */
export function toolChoices(): KeyChoice[] {
    return Object.keys(CONFIG.DND5E.tools)
        .map((key) => ({ key, label: toolLabel(key) }))
        .sort((a, b) => compareText(a.label, b.label));
}

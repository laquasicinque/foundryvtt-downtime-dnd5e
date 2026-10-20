/** Methods: the ways to change an item's progress. Stored data unless marked otherwise. */
import type { AbilityKey, Id, SkillKey } from "./common";
import type { Requirement } from "./requirements";
import type { BandEffect, CountsAs, ResultTable } from "./results";
import type { UsageRule } from "./usage";

export type MethodData =
    | AbilityMethodData
    | SkillMethodData
    | ToolMethodData
    | FixedMethodData
    | ManualMethodData
    | MacroMethodData;

export type MethodKind = MethodData["kind"];

export interface MethodBaseData {
    id: Id;
    name: string;
    description: string;
    img: string | null;
    /** Hidden from non-GM users regardless of requirements. */
    hidden: boolean;
    requirements: Requirement[];
    usage: UsageRule | null;
}

export interface CheckMethodBaseData extends MethodBaseData {
    /**
     * Takes precedence when set. When null, the rolled activity's DC is used
     * if it has one.
     */
    dc: number | null;
    results: ResultTable;
}

export interface AbilityMethodData extends CheckMethodBaseData {
    kind: "ABILITY";
    ability: AbilityKey;
}

export interface SkillMethodData extends CheckMethodBaseData {
    kind: "SKILL";
    skill: SkillKey;
}

/** A tool check without the tool: roll a skill instead. */
export interface SkillFallback {
    kind: "SKILL";
    skill: SkillKey;
}

/** A tool check without the tool: roll an ability check instead. */
export interface AbilityFallback {
    kind: "ABILITY";
    ability: AbilityKey;
}

export type ToolFallback = SkillFallback | AbilityFallback;

export interface ToolMethodData extends CheckMethodBaseData {
    kind: "TOOL";
    /** dnd5e tool key (system.type.baseItem), e.g. "smith". */
    tool: string;
    fallback: ToolFallback | null;
}

export interface FixedMethodData extends MethodBaseData {
    kind: "FIXED";
    effect: BandEffect;
    countsAs: CountsAs;
}

export interface ManualMethodData extends MethodBaseData {
    kind: "MANUAL";
    gmOnly: boolean;
}

export interface MacroMethodData extends MethodBaseData {
    kind: "MACRO";
    macroUuid: string;
    /** Name fallback for V1 data / missing UUIDs. */
    macroName: string | null;
    results: ResultTable | null;
}

export type CheckMethodData =
    | AbilityMethodData
    | SkillMethodData
    | ToolMethodData;

/** Requirements on items and methods. Stored data unless marked otherwise. */
import type { AbilityKey, CompareOp, Id, SkillKey } from "./common";

export type WhenUnmet = "HIDE" | "DISABLE" | "DISABLE_WITH_HINT";

export interface Requirement {
    id: Id;
    whenUnmet: WhenUnmet;
    hint: string | null;
    test: RequirementTest;
}

/** Progress on a tracked item compared with a value. */
export interface ProgressRequirementTest {
    kind: "PROGRESS";
    ref: ItemRef;
    op: CompareOp;
    value: number;
}

/** A milestone of a tracked item reached (or not). */
export interface MilestoneRequirementTest {
    kind: "MILESTONE";
    ref: ItemRef;
    milestoneId: Id;
    reached: boolean;
}

export interface SkillBonusMinimum {
    bonus: number;
}

export type SkillMinimum = "PROFICIENT" | "EXPERT" | SkillBonusMinimum;

export interface SkillRequirementTest {
    kind: "SKILL";
    skill: SkillKey;
    min: SkillMinimum;
}

export interface AbilityScoreMinimum {
    score: number;
}

export interface AbilityModifierMinimum {
    mod: number;
}

export type AbilityMinimum = AbilityScoreMinimum | AbilityModifierMinimum;

export interface AbilityRequirementTest {
    kind: "ABILITY";
    ability: AbilityKey;
    min: AbilityMinimum;
}

export interface ToolProficiencyRequirementTest {
    kind: "TOOL_PROFICIENCY";
    tool: string;
}

/** Owns `quantity` of a matching item. */
export interface ItemRequirementTest {
    kind: "ITEM";
    match: ItemMatch;
    quantity: number;
}

/** A macro run on the user's client returns true. */
export interface MacroRequirementTest {
    kind: "MACRO";
    macroUuid: string;
}

export type RequirementTest =
    | ProgressRequirementTest
    | MilestoneRequirementTest
    | SkillRequirementTest
    | AbilityRequirementTest
    | ToolProficiencyRequirementTest
    | ItemRequirementTest
    | MacroRequirementTest;

/** The item holding the reference. */
export interface SelfReference {
    kind: "SELF";
}

/** Another tracked item, by id (see `RefContext` for how it's resolved). */
export interface ItemReference {
    kind: "ITEM";
    id: Id;
}

export type ItemRef = SelfReference | ItemReference;

/** Actor-independent item matching. First non-null field wins. */
export interface ItemMatch {
    identifier: string | null;
    sourceUuid: string | null;
    name: string | null;
}

import { deriveState } from "./derive";
import type { Problem } from "./problems";
import { compare } from "./progress";
import { resolveRef, type RefContext } from "./refs";
import type {
    CompareOp,
    ItemMatch,
    ItemRef,
    Requirement,
    RequirementTest,
    WhenUnmet,
} from "../../types/data";
import type { ActorItemView, ActorView } from "../../types/actors";
import type { I18nKey, Translate } from "../../types/i18n";

export interface RequirementContext {
    actor: ActorView | null;
    refs: RefContext;
    /** Results of MACRO requirements, run on the player's client. Keyed by requirement id. */
    macroResults: ReadonlyMap<string, boolean>;
}

export interface RequirementMet {
    met: true;
}

export interface RequirementUnmet {
    met: false;
    reason: UnmetReason;
}

export type RequirementResult = RequirementMet | RequirementUnmet;

export type UnmetReason =
    | "NOT_MET"
    /** No acting actor to test against. */
    | "NO_ACTOR"
    /** Referenced tracked item could not be resolved. */
    | "UNRESOLVED_REF"
    /** Macro result missing (not evaluated on the client). */
    | "MACRO_NOT_EVALUATED";

const ok: RequirementResult = { met: true };
const unmet = (reason: UnmetReason = "NOT_MET"): RequirementResult => ({
    met: false,
    reason,
});

export function itemMatches(item: ActorItemView, match: ItemMatch): boolean {
    if (match.identifier !== null) return item.identifier === match.identifier;
    if (match.sourceUuid !== null) return item.sourceUuid === match.sourceUuid;
    if (match.name !== null)
        return item.name.toLocaleLowerCase() === match.name.toLocaleLowerCase();
    return false;
}

export function evaluateTest(
    requirementId: string,
    test: RequirementTest,
    ctx: RequirementContext,
): RequirementResult {
    switch (test.kind) {
        case "PROGRESS": {
            const target = resolveRef(test.ref, ctx.refs);
            if (!target) return unmet("UNRESOLVED_REF");
            const { value } = deriveState(target);
            return compare(value, test.op, test.value) ? ok : unmet();
        }
        case "MILESTONE": {
            const target = resolveRef(test.ref, ctx.refs);
            if (!target) return unmet("UNRESOLVED_REF");
            const fired =
                (deriveState(target).milestoneFires[test.milestoneId] ?? 0) > 0;
            return fired === test.reached ? ok : unmet();
        }
        case "SKILL": {
            if (!ctx.actor) return unmet("NO_ACTOR");
            const skill = ctx.actor.skills[test.skill];
            if (!skill) return unmet();
            if (test.min === "PROFICIENT")
                return skill.proficiency >= 1 ? ok : unmet();
            if (test.min === "EXPERT")
                return skill.proficiency >= 2 ? ok : unmet();
            return skill.total >= test.min.bonus ? ok : unmet();
        }
        case "ABILITY": {
            if (!ctx.actor) return unmet("NO_ACTOR");
            const ability = ctx.actor.abilities[test.ability];
            if (!ability) return unmet();
            if ("score" in test.min)
                return ability.score >= test.min.score ? ok : unmet();
            return ability.mod >= test.min.mod ? ok : unmet();
        }
        case "TOOL_PROFICIENCY":
            if (!ctx.actor) return unmet("NO_ACTOR");
            return ctx.actor.toolProficiencies.has(test.tool) ? ok : unmet();
        case "ITEM": {
            if (!ctx.actor) return unmet("NO_ACTOR");
            const quantity = ctx.actor.items
                .filter((item) => itemMatches(item, test.match))
                .reduce((sum, item) => sum + item.quantity, 0);
            return quantity >= test.quantity ? ok : unmet();
        }
        case "MACRO": {
            const result = ctx.macroResults.get(requirementId);
            if (result === undefined) return unmet("MACRO_NOT_EVALUATED");
            return result ? ok : unmet();
        }
    }
}

export interface UnmetRequirement {
    requirement: Requirement;
    reason: UnmetReason;
}

export interface Available {
    state: "AVAILABLE";
}

export interface Unavailable {
    /** The strictest `whenUnmet` among the unmet requirements. */
    state: WhenUnmet;
    unmet: UnmetRequirement[];
    /** Hints to show (only from DISABLE_WITH_HINT requirements). */
    hints: string[];
}

export type MethodAvailability = Available | Unavailable;

const STRICTNESS: Record<WhenUnmet, number> = {
    HIDE: 3,
    DISABLE: 2,
    DISABLE_WITH_HINT: 1,
};

/**
 * Requirements are AND-ed; the strictest unmet `whenUnmet` wins.
 * `describe` produces the auto-generated hint when a requirement has none.
 */
export function evaluateRequirements(
    method: { readonly requirements: readonly Requirement[] },
    ctx: RequirementContext,
    describe: (requirement: Requirement) => string = () => "",
): MethodAvailability {
    const unmetList: UnmetRequirement[] = [];
    for (const requirement of method.requirements) {
        const result = evaluateTest(requirement.id, requirement.test, ctx);
        if (!result.met) unmetList.push({ requirement, reason: result.reason });
    }
    if (unmetList.length === 0) return { state: "AVAILABLE" };

    const state = unmetList.reduce<WhenUnmet>(
        (strictest, { requirement }) =>
            STRICTNESS[requirement.whenUnmet] > STRICTNESS[strictest]
                ? requirement.whenUnmet
                : strictest,
        "DISABLE_WITH_HINT",
    );
    const hints = unmetList
        .filter(
            ({ requirement }) => requirement.whenUnmet === "DISABLE_WITH_HINT",
        )
        .map(({ requirement }) => requirement.hint ?? describe(requirement))
        .filter((hint) => hint.length > 0);

    return { state, unmet: unmetList, hints };
}

/** Display labels for requirement descriptions, injected so this stays pure. */
export interface RequirementLabels {
    t: Translate;
    skill(key: string): string;
    ability(key: string): string;
    tool(key: string): string;
}

const PROGRESS_KEYS: Record<CompareOp, I18nKey> = {
    lt: "downtime-dnd5e.Requirement.Describe.ProgressBelow",
    lte: "downtime-dnd5e.Requirement.Describe.ProgressAtMost",
    eq: "downtime-dnd5e.Requirement.Describe.ProgressExactly",
    gte: "downtime-dnd5e.Requirement.Describe.ProgressAtLeast",
    gt: "downtime-dnd5e.Requirement.Describe.ProgressAbove",
};

const signedNumber = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/**
 * Description of a requirement ("Requires proficiency in Athletics"). Used as
 * the default player hint and to explain unmet requirements to GMs. `refs`
 * names referenced tracked items when given.
 */
export function describeRequirement(
    requirement: Requirement,
    labels: RequirementLabels,
    refs?: RefContext,
): string {
    const { t } = labels;
    const test = requirement.test;
    const itemName = (ref: ItemRef) => {
        if (ref.kind === "SELF")
            return t("downtime-dnd5e.Requirement.Describe.ThisItem");
        const target = refs ? resolveRef(ref, refs) : null;
        return target
            ? t("downtime-dnd5e.Requirement.Describe.Quoted", {
                  name: target.name,
              })
            : t("downtime-dnd5e.Requirement.Describe.AnotherItem");
    };
    switch (test.kind) {
        case "SKILL": {
            const skill = labels.skill(test.skill);
            if (test.min === "PROFICIENT")
                return t(
                    "downtime-dnd5e.Requirement.Describe.SkillProficient",
                    {
                        skill,
                    },
                );
            if (test.min === "EXPERT")
                return t("downtime-dnd5e.Requirement.Describe.SkillExpert", {
                    skill,
                });
            return t("downtime-dnd5e.Requirement.Describe.SkillBonus", {
                skill,
                bonus: signedNumber(test.min.bonus),
            });
        }
        case "ABILITY": {
            const ability = labels.ability(test.ability);
            return "score" in test.min
                ? t("downtime-dnd5e.Requirement.Describe.AbilityScore", {
                      ability,
                      score: test.min.score,
                  })
                : t("downtime-dnd5e.Requirement.Describe.AbilityMod", {
                      ability,
                      mod: signedNumber(test.min.mod),
                  });
        }
        case "TOOL_PROFICIENCY":
            return t("downtime-dnd5e.Requirement.Describe.Tool", {
                tool: labels.tool(test.tool),
            });
        case "ITEM": {
            const item =
                test.match.name ||
                test.match.identifier ||
                t(
                    test.match.sourceUuid
                        ? "downtime-dnd5e.Requirement.Describe.SpecificItem"
                        : "downtime-dnd5e.Requirement.Describe.AnyItem",
                );
            return test.quantity > 1
                ? t("downtime-dnd5e.Requirement.Describe.ItemQuantity", {
                      quantity: test.quantity,
                      item,
                  })
                : t("downtime-dnd5e.Requirement.Describe.Item", { item });
        }
        case "PROGRESS":
            return t(PROGRESS_KEYS[test.op], {
                item: itemName(test.ref),
                value: test.value,
            });
        case "MILESTONE": {
            const target =
                test.ref.kind === "ITEM" && refs
                    ? resolveRef(test.ref, refs)
                    : test.ref.kind === "SELF"
                      ? (refs?.self ?? null)
                      : null;
            const milestone = target?.milestones.find(
                (m) => m.id === test.milestoneId,
            );
            const vars = {
                milestone: milestone?.label
                    ? t("downtime-dnd5e.Requirement.Describe.Quoted", {
                          name: milestone.label,
                      })
                    : t("downtime-dnd5e.Requirement.Describe.AMilestone"),
                item: itemName(test.ref),
            };
            return test.reached
                ? t(
                      "downtime-dnd5e.Requirement.Describe.MilestoneReached",
                      vars,
                  )
                : t(
                      "downtime-dnd5e.Requirement.Describe.MilestoneBefore",
                      vars,
                  );
        }
        case "MACRO":
            return t("downtime-dnd5e.Requirement.Describe.Macro");
    }
}

export type RequirementProblem = Problem;

/**
 * Problems with a requirement as configured, for the editor. Empty when it's
 * fine. `refs` checks that referenced items exist.
 */
export function requirementProblems(
    requirement: Requirement,
    t: Translate,
    refs?: RefContext,
): RequirementProblem[] {
    const test = requirement.test;
    const problems: RequirementProblem[] = [];
    const block = (key: I18nKey) =>
        problems.push({ message: t(key), blocking: true });
    const checkRef = (ref: ItemRef) => {
        if (ref.kind === "ITEM" && !ref.id)
            block("downtime-dnd5e.Requirement.Problem.ChooseItem");
        else if (ref.kind === "ITEM" && refs && !resolveRef(ref, refs))
            problems.push({
                message: t("downtime-dnd5e.Requirement.Problem.ItemNotFound"),
                blocking: false,
            });
    };
    switch (test.kind) {
        case "PROGRESS":
            checkRef(test.ref);
            break;
        case "MILESTONE": {
            checkRef(test.ref);
            if (!test.milestoneId)
                block("downtime-dnd5e.Requirement.Problem.ChooseMilestone");
            else if (refs) {
                const target = resolveRef(test.ref, refs);
                if (
                    target &&
                    !target.milestones.some((m) => m.id === test.milestoneId)
                )
                    block("downtime-dnd5e.Requirement.Problem.MilestoneGone");
            }
            break;
        }
        case "ITEM":
            if (
                !test.match.identifier &&
                !test.match.sourceUuid &&
                !test.match.name
            )
                block("downtime-dnd5e.Requirement.Problem.NameItem");
            break;
        case "MACRO":
            if (!test.macroUuid)
                block("downtime-dnd5e.Requirement.Problem.DropMacro");
            break;
        default:
            break;
    }
    return problems;
}

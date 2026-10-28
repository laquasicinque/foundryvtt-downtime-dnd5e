import { contributorKey, userKey } from "./contributor";
import { effectiveEvents } from "./derive";
import type {
    Contributor,
    HistoryEventData,
    Id,
    MethodEventData,
    TrackedItemData,
    UsageRule,
    UsageTier,
} from "../../types/data";
import type { Translate } from "../../types/i18n";

function scopeKey(rule: UsageRule, contributor: Contributor): string {
    switch (rule.per) {
        case "ITEM":
            return "item";
        case "ACTOR":
            return contributorKey(contributor);
        case "USER":
            return userKey(contributor);
    }
}

function counts(rule: UsageRule, event: MethodEventData): boolean {
    switch (rule.count.kind) {
        case "ATTEMPTS":
            return true;
        case "SUCCESSES":
            return event.band?.countsAs === "SUCCESS";
        case "FAILURES":
            return event.band?.countsAs === "FAILURE";
        case "BANDS":
            return (
                event.band !== null &&
                rule.count.bandIds.includes(event.band.id)
            );
    }
}

/**
 * How many prior uses count towards `rule` for this contributor.
 * Only non-reverted METHOD events count; SET/ADJUST/LEGACY never do.
 */
export function usageCount(
    history: HistoryEventData[],
    methodId: Id,
    rule: UsageRule,
    contributor: Contributor,
): number {
    const key = scopeKey(rule, contributor);
    let total = 0;
    for (const event of effectiveEvents(history)) {
        if (event.kind !== "METHOD" || event.methodId !== methodId) continue;
        if (scopeKey(rule, event.contributor) !== key) continue;
        if (counts(rule, event)) total++;
    }
    return total;
}

export const NORMAL_TIER: UsageTier = { from: 0, kind: "NORMAL" };

/**
 * The tier that applies to the *next* use, given the count of prior uses.
 * `from: 3` means "once 3 uses have counted", i.e. from the 4th use onwards.
 * Returns the tier and its index in `rule.tiers` (null for the implicit tier).
 */
export function tierFor(
    rule: UsageRule,
    count: number,
): { tier: UsageTier; index: number | null } {
    let best: { tier: UsageTier; index: number | null } = {
        tier: NORMAL_TIER,
        index: null,
    };
    rule.tiers.forEach((tier, index) => {
        if (tier.from <= count && tier.from >= best.tier.from) {
            best = { tier, index };
        }
    });
    return best;
}

export function currentTier(
    item: TrackedItemData,
    methodId: Id,
    contributor: Contributor,
): { tier: UsageTier; index: number | null; count: number } | null {
    const method = item.methods.find((m) => m.id === methodId);
    if (!method?.usage) return null;
    const count = usageCount(item.history, methodId, method.usage, contributor);
    return { ...tierFor(method.usage, count), count };
}

export interface UsageSummary {
    /** The next use is blocked (DISABLE / HIDE tier). */
    blocked: boolean;
    /** "Next use: reduced effect · 2 uses left", the DISABLE hint, "No uses left", or null. */
    text: string | null;
}

const U = "downtime-dnd5e.Usage";

/** Player-facing state of a usage rule after `count` counted uses. */
export function usageSummary(
    rule: UsageRule,
    count: number,
    t: Translate,
): UsageSummary {
    const { tier } = tierFor(rule, count);
    if (tier.kind === "DISABLE" || tier.kind === "HIDE")
        return {
            blocked: true,
            text:
                (tier.kind === "DISABLE" && tier.hint) || t(`${U}.NoUsesLeft`),
        };
    const notes: string[] = [];
    if (tier.kind !== "NORMAL") notes.push(t(`${U}.NextReduced`));
    const limit = rule.tiers
        .filter(
            (other) =>
                other.from > count &&
                (other.kind === "DISABLE" || other.kind === "HIDE"),
        )
        .sort((a, b) => a.from - b.from)[0];
    if (limit) {
        const left = limit.from - count;
        notes.push(t(`${U}.UsesLeft`, { count: left }));
    }
    return { blocked: false, text: notes.length ? notes.join(" · ") : null };
}

/**
 * Warnings about a usage rule as configured, for the editor. `bandIds` are
 * the method's current result bands (empty for methods without results).
 */
export function usageProblems(
    rule: UsageRule,
    bandIds: readonly Id[],
    t: Translate,
): string[] {
    const problems: string[] = [];
    if (rule.count.kind === "BANDS") {
        if (rule.count.bandIds.length === 0)
            problems.push(t(`${U}.Problem.NoBands`));
        else if (rule.count.bandIds.some((id) => !bandIds.includes(id)))
            problems.push(t(`${U}.Problem.BandGone`));
    }
    const seen = new Set<number>();
    for (const tier of rule.tiers) {
        if (seen.has(tier.from))
            problems.push(t(`${U}.Problem.DuplicateStep`, { from: tier.from }));
        seen.add(tier.from);
    }
    if (rule.tiers.some((tier) => tier.from === 0))
        problems.push(t(`${U}.Problem.StepFromZero`));
    if (rule.tiers.length === 0) problems.push(t(`${U}.Problem.NoSteps`));
    return problems;
}

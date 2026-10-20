/** Usage rules: limits and changes after a number of uses. Stored data unless marked otherwise. */
import type { Id } from "./common";
import type { BandEffect, ResultTable } from "./results";

/** Every use counts. */
export interface AttemptsUsageCount {
    kind: "ATTEMPTS";
}

/** Uses whose result counts as a success. */
export interface SuccessesUsageCount {
    kind: "SUCCESSES";
}

/** Uses whose result counts as a failure. */
export interface FailuresUsageCount {
    kind: "FAILURES";
}

/** Uses that got one of these results. */
export interface BandsUsageCount {
    kind: "BANDS";
    bandIds: Id[];
}

export type UsageCount =
    | AttemptsUsageCount
    | SuccessesUsageCount
    | FailuresUsageCount
    | BandsUsageCount;

export interface UsageRule {
    count: UsageCount;
    per: "ITEM" | "ACTOR" | "USER";
    /** Sorted ascending by `from`. Implicit tier at 0 is NORMAL. */
    tiers: UsageTier[];
}

export interface UsageTierBase {
    /** Applies once this many uses have counted. */
    from: number;
}

/** Back to the method's normal behaviour. */
export interface NormalUsageTier extends UsageTierBase {
    kind: "NORMAL";
}

/** Check and macro methods: a different results table. */
export interface ResultsUsageTier extends UsageTierBase {
    kind: "RESULTS";
    results: ResultTable;
}

/** FIXED methods: a different amount. */
export interface EffectUsageTier extends UsageTierBase {
    kind: "EFFECT";
    effect: BandEffect;
}

/** Can't be used; shows `hint`. */
export interface DisableUsageTier extends UsageTierBase {
    kind: "DISABLE";
    hint: string | null;
}

/** Hidden from players. */
export interface HideUsageTier extends UsageTierBase {
    kind: "HIDE";
}

export type UsageTier =
    | NormalUsageTier
    | ResultsUsageTier
    | EffectUsageTier
    | DisableUsageTier
    | HideUsageTier;

import { compare } from "./progress";
import type {
    BandCondition,
    BandEffect,
    DeltaSpec,
    ResultBand,
    ResultTable,
    RollSummary,
} from "../../types/data";
import type { FormulaData, FormulaEvaluator } from "../../types/rolls";

export interface EffectiveDc {
    dc: number | null;
    source: RollSummary["dcSource"];
}

/** The method's DC wins whenever set; otherwise the rolled activity's DC. */
export function effectiveDc(
    methodDc: number | null,
    activityDc: number | null,
): EffectiveDc {
    if (methodDc !== null) return { dc: methodDc, source: "METHOD" };
    if (activityDc !== null) return { dc: activityDc, source: "ACTIVITY" };
    return { dc: null, source: null };
}

export interface BandRoll {
    total: number;
    /** Kept d20 face, or null when the roll has no d20. */
    natural: number | null;
    dc: number | null;
}

/**
 * NATURAL conditions never match without a d20, MARGIN conditions never match
 * without a DC. Resolution then falls through to later bands.
 */
export function conditionMatches(
    condition: BandCondition,
    roll: BandRoll,
): boolean {
    switch (condition.on) {
        case "NATURAL":
            return (
                roll.natural !== null &&
                compare(roll.natural, condition.op, condition.value)
            );
        case "TOTAL":
            return compare(roll.total, condition.op, condition.value);
        case "MARGIN":
            return (
                roll.dc !== null &&
                compare(roll.total - roll.dc, condition.op, condition.value)
            );
    }
}

/**
 * First matching band wins. Returns null only for a table with no matching
 * band, which the normaliser prevents by guaranteeing an unconditional last band.
 */
export function resolveBand(
    table: ResultTable,
    roll: BandRoll,
): ResultBand | null {
    return (
        table.bands.find((band) =>
            band.when.every((condition) => conditionMatches(condition, roll)),
        ) ?? null
    );
}

export function formulaData(
    roll: BandRoll | null,
    extra: Record<string, unknown> = {},
): FormulaData {
    return {
        ...extra,
        total: roll?.total ?? null,
        natural: roll?.natural ?? null,
        dc: roll?.dc ?? null,
        margin: roll && roll.dc !== null ? roll.total - roll.dc : null,
    };
}

export async function evaluateDelta(
    delta: DeltaSpec,
    data: FormulaData,
    evaluate: FormulaEvaluator,
): Promise<number> {
    if (delta.kind === "STATIC") return delta.value;
    const value = await evaluate(delta.formula, data);
    if (!Number.isFinite(value)) {
        throw new Error(
            `Formula "${delta.formula}" did not produce a finite number`,
        );
    }
    return value;
}

export function evaluateEffect(
    effect: BandEffect,
    data: FormulaData,
    evaluate: FormulaEvaluator,
): Promise<number> {
    return evaluateDelta(effect.delta, data, evaluate);
}

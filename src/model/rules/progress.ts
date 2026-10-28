import type {
    CompareOp,
    ProgressConfig,
    ProgressDelta,
} from "../../types/data";

/** Clamp `value` into the item's bounds. null bounds are unbounded. */
export function clampProgress(value: number, config: ProgressConfig): number {
    let result = value;
    if (config.max !== null && result > config.max) result = config.max;
    if (config.min !== null && result < config.min) result = config.min;
    return result;
}

/** Build the delta record for a relative change from `before`. */
export function computeDelta(
    before: number,
    requested: number,
    config: ProgressConfig,
): ProgressDelta {
    const after = clampProgress(before + requested, config);
    return { requested, applied: after - before, before, after };
}

/** Percentage of target, or null for open-ended (or zero) targets. */
export function percentOf(value: number, target: number | null): number | null {
    if (target === null || target === 0) return null;
    return (value / target) * 100;
}

export function compare(left: number, op: CompareOp, right: number): boolean {
    switch (op) {
        case "lt":
            return left < right;
        case "lte":
            return left <= right;
        case "eq":
            return left === right;
        case "gte":
            return left >= right;
        case "gt":
            return left > right;
    }
}

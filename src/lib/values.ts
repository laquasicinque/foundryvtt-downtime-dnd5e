/** Checks and conversions for values whose type isn't known yet (stored data, input, Foundry fields). */

/** A plain object: not null and not an array. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A number other than NaN or ±Infinity. */
export function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

/** The value if it's a finite number, otherwise null. */
export function finiteOrNull(value: unknown): number | null {
    return isFiniteNumber(value) ? value : null;
}

/** A finite number, or a non-blank string that parses as one; otherwise null. */
export function parseFinite(value: unknown): number | null {
    if (typeof value === "string")
        return value.trim() === "" ? null : finiteOrNull(Number(value));
    return finiteOrNull(value);
}

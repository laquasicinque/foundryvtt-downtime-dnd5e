/**
 * Small field readers for the hand-written normalisers.
 *
 * Each reader either returns a valid value, repairs it (recording a
 * "repaired" issue), or throws `InvalidRecord`. Record-level parsers catch
 * `InvalidRecord` and quarantine the record instead of failing the whole item.
 */
import { isFiniteNumber, isRecord, parseFinite } from "../../../lib/values";
import { localized } from "../../../lib/text";
import type {
    I18nKey,
    I18nVars,
    LocalizedText,
    Translate,
} from "../../../types/i18n";
import { InvalidRecord } from "./InvalidRecord";

export type IssueSeverity = "repaired" | "quarantined" | "fatal";

export interface Issue {
    severity: IssueSeverity;
    path: string;
    /** For the GM repair window and logs. Plain strings come from older stored data. */
    message: LocalizedText | string;
}

export interface NormalizeContext {
    issues: Issue[];
    /** Id generator for repairs; foundry.utils.randomID at runtime. */
    randomId(): string;
    t: Translate;
}

export type Raw = Record<string, unknown>;

export function fail(path: string, key: I18nKey, vars?: I18nVars): never {
    throw new InvalidRecord(path, localized(key, vars));
}

export function repaired(
    ctx: NormalizeContext,
    path: string,
    key: I18nKey,
    vars?: I18nVars,
) {
    ctx.issues.push({
        severity: "repaired",
        path,
        message: localized(key, vars),
    });
}

export const join = (path: string, key: string | number) =>
    typeof key === "number" ? `${path}[${key}]` : path ? `${path}.${key}` : key;

export function obj(raw: unknown, path: string): Raw {
    if (!isRecord(raw))
        fail(path, "downtime-dnd5e.Data.ExpectedObject", {
            type: describe(raw),
        });
    return raw;
}

export function describe(raw: unknown): string {
    if (raw === null) return "null";
    if (Array.isArray(raw)) return "an array";
    return typeof raw;
}

const MISSING = Symbol("missing");
type Fallback<T> = T | typeof MISSING;

/** Required string. With a fallback, missing/wrong-typed values are repaired. */
export function str(
    obj: Raw,
    key: string,
    path: string,
    ctx: NormalizeContext,
    fallback: Fallback<string> = MISSING,
): string {
    const value = obj[key];
    if (typeof value === "string") return value;
    if (typeof value === "number" && fallback !== MISSING) {
        repaired(ctx, join(path, key), "downtime-dnd5e.Data.NumberToString");
        return String(value);
    }
    if (fallback === MISSING)
        fail(join(path, key), "downtime-dnd5e.Data.ExpectedString", {
            type: describe(value),
        });
    if (value !== undefined)
        repaired(
            ctx,
            join(path, key),
            "downtime-dnd5e.Data.ReplacedWithDefault",
            { type: describe(value) },
        );
    return fallback;
}

/** Non-empty string, or fail. */
export function requiredStr(o: Raw, key: string, path: string): string {
    const value = o[key];
    if (typeof value !== "string" || value.length === 0)
        fail(join(path, key), "downtime-dnd5e.Data.ExpectedNonEmptyString", {
            type: describe(value),
        });
    return value;
}

/** Text the module stored: a LocalizedText, or a plain string (older data). */
export function isStoredText(value: unknown): value is LocalizedText | string {
    if (typeof value === "string") return true;
    if (!isRecord(value) || typeof value.key !== "string") return false;
    return (
        value.vars === undefined ||
        (isRecord(value.vars) &&
            Object.values(value.vars).every(
                (v) =>
                    typeof v === "string" ||
                    typeof v === "number" ||
                    isStoredText(v),
            ))
    );
}

/** Optional stored text (see `isStoredText`); anything else is repaired to null. */
export function nullableText(
    obj: Raw,
    key: string,
    path: string,
    ctx: NormalizeContext,
): LocalizedText | string | null {
    const value = obj[key];
    if (value === undefined || value === null) return null;
    if (isStoredText(value)) return value;
    repaired(ctx, join(path, key), "downtime-dnd5e.Data.ReplacedWithNull", {
        value: describe(value),
    });
    return null;
}

export function nullableStr(
    obj: Raw,
    key: string,
    path: string,
    ctx: NormalizeContext,
): string | null {
    const value = obj[key];
    if (value === undefined || value === null) return null;
    if (typeof value === "string") return value.length > 0 ? value : null;
    repaired(ctx, join(path, key), "downtime-dnd5e.Data.ReplacedWithNull", {
        value: describe(value),
    });
    return null;
}

/** Finite number. Numeric strings are repaired. With a fallback, other values are repaired too. */
export function num(
    obj: Raw,
    key: string,
    path: string,
    ctx: NormalizeContext,
    fallback: Fallback<number> = MISSING,
): number {
    const value = obj[key];
    if (isFiniteNumber(value)) return value;
    const parsed = parseFinite(value);
    if (parsed !== null) {
        repaired(ctx, join(path, key), "downtime-dnd5e.Data.StringToNumber");
        return parsed;
    }
    if (fallback === MISSING)
        fail(join(path, key), "downtime-dnd5e.Data.ExpectedNumber", {
            type: describe(value),
        });
    if (value !== undefined)
        repaired(ctx, join(path, key), "downtime-dnd5e.Data.ReplacedWith", {
            value: describe(value),
            fallback: String(fallback),
        });
    return fallback;
}

/** Finite number or null. Unparseable values become null (repaired). */
export function nullableNum(
    o: Raw,
    key: string,
    path: string,
    ctx: NormalizeContext,
): number | null {
    const value = o[key];
    if (value === undefined || value === null || value === "") return null;
    if (isFiniteNumber(value)) return value;
    const parsed = parseFinite(value);
    if (parsed !== null) {
        repaired(ctx, join(path, key), "downtime-dnd5e.Data.StringToNumber");
        return parsed;
    }
    repaired(ctx, join(path, key), "downtime-dnd5e.Data.ReplacedWithNull", {
        value: describe(value),
    });
    return null;
}

export function bool(
    o: Raw,
    key: string,
    path: string,
    ctx: NormalizeContext,
    fallback: boolean,
): boolean {
    const value = o[key];
    if (typeof value === "boolean") return value;
    if (value === undefined || value === null) return fallback;
    if (value === "true" || value === "false") {
        repaired(ctx, join(path, key), "downtime-dnd5e.Data.StringToBoolean");
        return value === "true";
    }
    repaired(ctx, join(path, key), "downtime-dnd5e.Data.ReplacedWith", {
        value: describe(value),
        fallback: String(fallback),
    });
    return fallback;
}

/** One of a fixed set. With a fallback, unknown values are repaired; otherwise fail. */
export function oneOf<const T extends string>(
    o: Raw,
    key: string,
    values: readonly T[],
    path: string,
    ctx: NormalizeContext,
    fallback: Fallback<T> = MISSING,
): T {
    const value = o[key];
    if (
        typeof value === "string" &&
        (values as readonly string[]).includes(value)
    )
        return value as T;
    if (fallback === MISSING)
        fail(join(path, key), "downtime-dnd5e.Data.ExpectedOneOf", {
            values: values.join(", "),
            value: JSON.stringify(value),
        });
    if (value !== undefined)
        repaired(ctx, join(path, key), "downtime-dnd5e.Data.ReplacedWith", {
            value: JSON.stringify(value),
            fallback: String(fallback),
        });
    return fallback;
}

/** Id field. Missing ids are generated (repaired). */
export function id(
    o: Raw,
    key: string,
    path: string,
    ctx: NormalizeContext,
): string {
    const value = o[key];
    if (typeof value === "string" && value.length > 0) return value;
    const generated = ctx.randomId();
    repaired(ctx, join(path, key), "downtime-dnd5e.Data.MissingId", {
        id: generated,
    });
    return generated;
}

/**
 * Array field. Missing → [] (silently, it's the common "never set" case).
 * Keyed objects are accepted as their values (storage shape).
 */
export function list(
    o: Raw,
    key: string,
    path: string,
    ctx: NormalizeContext,
): unknown[] {
    const value = o[key];
    if (value === undefined || value === null) return [];
    if (Array.isArray(value)) return value;
    if (isRecord(value)) return Object.values(value);
    repaired(
        ctx,
        join(path, key),
        "downtime-dnd5e.Data.ReplacedWithEmptyList",
        { type: describe(value) },
    );
    return [];
}

/** String array; non-string entries are dropped (repaired). */
export function strList(
    o: Raw,
    key: string,
    path: string,
    ctx: NormalizeContext,
): string[] {
    const values = list(o, key, path, ctx);
    const strings = values.filter(
        (v): v is string => typeof v === "string" && v.length > 0,
    );
    if (strings.length !== values.length)
        repaired(ctx, join(path, key), "downtime-dnd5e.Data.DroppedNonStrings");
    return strings;
}

/**
 * Timestamp rule: always repaired, never quarantined.
 * Numbers pass through, date strings are parsed, anything else
 * (`{}` from serialised Dates, invalid dates, missing) becomes null.
 */
export function timestamp(
    o: Raw,
    key: string,
    path: string,
    ctx: NormalizeContext,
): number | null {
    const value = o[key];
    if (isFiniteNumber(value)) return value;
    if (typeof value === "string") {
        const asNumber = Number(value);
        const parsed =
            Number.isFinite(asNumber) && value.trim() !== ""
                ? asNumber
                : Date.parse(value);
        if (Number.isFinite(parsed)) {
            repaired(
                ctx,
                join(path, key),
                "downtime-dnd5e.Data.DateStringToEpoch",
            );
            return parsed;
        }
    }
    if (value instanceof Date && Number.isFinite(value.getTime())) {
        repaired(ctx, join(path, key), "downtime-dnd5e.Data.DateToEpoch");
        return value.getTime();
    }
    if (value !== null)
        repaired(ctx, join(path, key), "downtime-dnd5e.Data.DateUnknown");
    return null;
}

/**
 * Parse each entry, quarantining entries that throw `InvalidRecord`.
 * Entries with duplicate ids (per `getId`) are quarantined too.
 */
export function parseEach<T>(
    raws: unknown[],
    path: string,
    ctx: NormalizeContext,
    quarantine: (record: {
        path: string;
        reason: LocalizedText;
        raw: unknown;
    }) => void,
    parse: (raw: unknown, path: string) => T,
    getId?: (value: T) => string,
): T[] {
    const results: T[] = [];
    const seen = new Set<string>();
    raws.forEach((raw, index) => {
        const entryPath = join(path, index);
        try {
            const value = parse(raw, entryPath);
            if (getId) {
                const valueId = getId(value);
                if (seen.has(valueId))
                    fail(entryPath, "downtime-dnd5e.Data.DuplicateId", {
                        id: valueId,
                    });
                seen.add(valueId);
            }
            results.push(value);
        } catch (error) {
            if (!(error instanceof InvalidRecord)) throw error;
            ctx.issues.push({
                severity: "quarantined",
                path: error.path,
                message: error.text,
            });
            quarantine({
                path: entryPath,
                reason: localized("downtime-dnd5e.Data.AtPath", {
                    path: error.path,
                    problem: error.text,
                }),
                raw,
            });
        }
    });
    return results;
}

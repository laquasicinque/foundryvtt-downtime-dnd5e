/** Text helpers. */
import type {
    I18nKey,
    I18nVars,
    LocalizedText,
    Translate,
} from "../types/i18n";
import { getOrInsertComputed } from "./collections";

// One shared Collator: `localeCompare` sets up a new one on every call, which adds up in sorts.
const collator = new Intl.Collator();

/** Compares two strings for sorting, the way `a.localeCompare(b)` does. */
export function compareText(a: string, b: string): number {
    return collator.compare(a, b);
}

/** Text from stored or sent data: a LocalizedText through `t`, or a plain string as it is. */
export function resolveText(
    text: LocalizedText | string | null,
    t: Translate,
): string | null {
    if (text === null || typeof text === "string") return text;
    return t(text.key, text.vars);
}

/** A LocalizedText. */
export const localized = (key: I18nKey, vars?: I18nVars): LocalizedText =>
    vars ? { key, vars } : { key };

/** `vars` with nested LocalizedText localized, ready for a translation's placeholders. */
export function flattenVars(
    vars: I18nVars,
    t: Translate,
): Record<string, string | number> {
    return Object.fromEntries(
        Object.entries(vars).map(([name, value]) => [
            name,
            typeof value === "object" ? t(value.key, value.vars) : value,
        ]),
    );
}

const pluralRules = new Map<string, Intl.PluralRules>();

/**
 * The key to look up for `key`: its plural form for `vars.count` when the key
 * has plural forms (`has` says whether a key exists), otherwise `key` itself.
 */
export function pluralKey(
    key: string,
    vars: I18nVars | undefined,
    lang: string,
    has: (key: string) => boolean,
): string {
    const count = vars?.count;
    if (typeof count !== "number" || !has(`${key}.other`)) return key;
    const rules = getOrInsertComputed(
        pluralRules,
        lang,
        (l) => new Intl.PluralRules(l),
    );
    const form = `${key}.${rules.select(count)}`;
    return has(form) ? form : `${key}.other`;
}

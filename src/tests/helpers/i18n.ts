import en from "../../languages/en.json";
import { flattenVars, pluralKey } from "../../lib/text";
import type { LocalizedText, Translate } from "../../types/i18n";

const strings = en as Record<string, string>;

/** Formats from en.json the way game.i18n.format does (plural forms included), so tests read English. */
export const t: Translate = (key, vars = {}) => {
    const values = flattenVars(vars, t);
    const form = pluralKey(key, vars, "en", (k) => k in strings);
    return (strings[form] ?? key).replace(
        /\{(\w+)\}/g,
        (match, name: string) =>
            name in values ? String(values[name]) : match,
    );
};

export const text = (value: LocalizedText | string | null): string | null =>
    value === null || typeof value === "string"
        ? value
        : t(value.key, value.vars);

/** Translations, typed by this module's language keys. */
import { flattenVars, pluralKey } from "../lib/text";
import type {
    CoreI18nKey,
    I18nKey,
    I18nVars,
    LocalizedText,
} from "../types/i18n";

export function localize(
    key: I18nKey | CoreI18nKey | `DND5E.${string}`,
    vars?: I18nVars,
): string {
    if (!vars) return game.i18n.localize(key);
    // `has` counts the English fallback, so untranslated plural forms still resolve.
    const form = pluralKey(key, vars, game.i18n.lang, (k) => game.i18n.has(k));
    const strings = Object.fromEntries(
        Object.entries(flattenVars(vars, localize)).map(([name, value]) => [
            name,
            String(value),
        ]),
    );
    return game.i18n.format(form, strings);
}

/** Text from stored data: a LocalizedText, or a plain string (written before text was stored as keys, or typed by a user). */
export function localizeText(text: LocalizedText | string | null): string {
    if (text === null || typeof text === "string") return text ?? "";
    return localize(text.key, text.vars);
}

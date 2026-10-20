/** Translation: keys from this module's language files, and text kept as a key so it can be shown in each viewer's language. */

type LanguageKey = Downtime.I18nKeys;

type PluralBase<K> = K extends `${infer Base}.other` ? Base : never;

/**
 * A key with plural forms in the language files (`<key>.one`, `<key>.other`,
 * and any other forms a language needs). Pass `count` in the values; the
 * form is picked with the language's plural rules.
 */
export type PluralKey = PluralBase<LanguageKey>;

export type I18nKey = LanguageKey | PluralKey;

/** Foundry core keys this module uses, for wording that should match Foundry's own. */
export type CoreI18nKey =
    | "COMMON.Cancel"
    | "COMMON.Confirm"
    | "COMMON.Delete"
    | "COMMON.No"
    | "COMMON.None"
    | "COMMON.Unknown"
    | "COMMON.Yes"
    | "APPLICATION.ACTIONS.Close"
    | "DOCUMENT.FIELDS.name.label"
    | "DOCUMENT.FIELDS.description.label"
    /** A document type's name, e.g. `DOCUMENT.ActiveEffect`. */
    | `DOCUMENT.${string}`;

/** Values for a key's placeholders. Nested text is localized first. */
export type I18nVars = {
    [name: string]: string | number | LocalizedText;
};

/** Text kept as a key and its values, to be localized when shown. Used for text that is stored or sent to another client. */
export interface LocalizedText {
    key: I18nKey;
    vars?: I18nVars;
}

/** Localizes a key. Injected into pure code (the runtime passes `localize`; tests pass a stub). */
export type Translate = (key: I18nKey, vars?: I18nVars) => string;

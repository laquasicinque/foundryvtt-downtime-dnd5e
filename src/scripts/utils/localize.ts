/**
 * Wrapper around i18n that gives us a little nicer types
 */
export function localize(key: Downtime.I18nKeys | `DND5E.${string}`) {
    return game.i18n.localize(key)
}

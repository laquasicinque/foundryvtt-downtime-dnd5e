/**
 * Wrapper around i18n that gives us a little nicer types
 */
export function localize(
  key: Downtime.I18nKeys | `DND5E.${string}`,
  vars?: Record<string, string>,
) {
  if (vars) return game.i18n.format(key, vars);
  return game.i18n.localize(key);
}

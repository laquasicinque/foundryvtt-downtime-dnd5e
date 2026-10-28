/** Hooks, typed by `Downtime.HookConfig` (types/hooks.d.ts). */

type HookName = keyof Downtime.HookConfig;
type HookFn = (...args: never[]) => unknown;

export function onHook<K extends HookName>(
    hook: K,
    fn: Downtime.HookConfig[K],
): number {
    return Hooks.on(hook, fn as HookFn);
}

export function onceHook<K extends HookName>(
    hook: K,
    fn: Downtime.HookConfig[K],
): number {
    return Hooks.once(hook, fn as HookFn);
}

/** Remove a listener by the id `onHook` returned. */
export function offHook(hook: HookName, id: number): void {
    Hooks.off(hook, id);
}

export function callHook<K extends HookName>(
    hook: K,
    ...args: Parameters<Downtime.HookConfig[K]>
): void {
    Hooks.callAll(hook, ...args);
}

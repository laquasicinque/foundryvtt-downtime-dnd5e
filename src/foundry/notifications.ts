/** Toast notifications. Safe to call before `ui` is ready (they're dropped). */

export function notifyInfo(message: string): void {
    ui.notifications?.info(message);
}

export function notifyWarn(message: string): void {
    ui.notifications?.warn(message);
}

export function notifyError(message: string): void {
    ui.notifications?.error(message);
}

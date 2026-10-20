import { CONSTANTS } from "../constants";
import { devModeDebug } from "./modules";
import { notifyError, notifyInfo, notifyWarn } from "./notifications";
import { getSetting } from "./settings";

const prefix = (message: unknown) =>
    `${CONSTANTS.MODULE_ID} | ${String(message)}`;
const forConsole = (message: string) => message.replace("<br>", "\n");

// ================================
// Logger utility
// ================================
export class Logger {
    static get DEBUG(): boolean {
        try {
            return getSetting("debug") || devModeDebug();
        } catch {
            return false;
        }
    }

    static debug<T>(msg: T, ...args: unknown[]): T {
        if (this.DEBUG) {
            console.log(`DEBUG | ${prefix(msg)}`, ...args);
        }
        return msg;
    }

    static log(message: unknown, ...args: unknown[]): string {
        const text = prefix(message);
        console.log(forConsole(text), ...args);
        return text;
    }

    static info(info: unknown, notify = false, ...args: unknown[]): string {
        const text = prefix(info);
        if (notify) notifyInfo(text);
        console.log(forConsole(text), ...args);
        return text;
    }

    static warn(warning: unknown, notify = false, ...args: unknown[]): string {
        const text = prefix(warning);
        if (notify) notifyWarn(text);
        console.warn(forConsole(text), ...args);
        return text;
    }

    /** Logs (and optionally notifies), then returns an Error for the caller to throw. */
    static error(error: unknown, notify = true, ...args: unknown[]): Error {
        const text = prefix(error);
        if (notify) notifyError(text);
        console.error(forConsole(text), ...args);
        return new Error(forConsole(text));
    }
}

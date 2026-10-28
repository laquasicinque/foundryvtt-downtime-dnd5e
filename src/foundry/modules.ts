/** This module's package entry, and other modules it talks to. */
import { CONSTANTS } from "../constants";

type DevModeApi = {
    getPackageDebugValue(packageId: string, kind: "boolean"): boolean;
};

/** Expose `api` as `game.modules.get("downtime-dnd5e").api`. */
export function setModuleApi(api: Downtime.ModuleApi): void {
    const mod = game.modules.get(CONSTANTS.MODULE_ID);
    if (mod) mod.api = api;
}

/** The Developer Mode module's debug flag for this module. */
export function devModeDebug(): boolean {
    const devMode = game.modules.get("_dev-mode") as
        | { api?: DevModeApi }
        | undefined;
    return !!devMode?.api?.getPackageDebugValue(CONSTANTS.MODULE_ID, "boolean");
}

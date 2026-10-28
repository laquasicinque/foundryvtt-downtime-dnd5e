/** This module's settings, plus the core settings it reads. */
import { CONSTANTS } from "../constants";

/** This module's settings and the type of each value. */
export interface ModuleSettings {
    gmOnlyMode: boolean;
    totalToComplete: number;
    announceCompletionFor: "pc" | "npc" | "both" | "none";
    milestoneApprovalDefault: "AUTO" | "GM";
    debug: boolean;
    /** V1 world data (migration input and backup); parsed, never trusted. */
    activities: unknown[];
    categories: unknown[];
    worldJournalId: string;
}

export type SettingKey = keyof ModuleSettings;

/** The registration options this module uses. */
export interface SettingRegistration<K extends SettingKey> {
    name?: string;
    hint?: string;
    scope: "world" | "client";
    /** Shown in the settings window. */
    config: boolean;
    /** Omitted for data settings (stored as JSON). */
    type?: BooleanConstructor | NumberConstructor | StringConstructor;
    choices?: Record<Extract<ModuleSettings[K], string>, string>;
    default: ModuleSettings[K];
}

export function getSetting<K extends SettingKey>(key: K): ModuleSettings[K] {
    return game.settings.get(CONSTANTS.MODULE_ID, key) as ModuleSettings[K];
}

export async function setSetting<K extends SettingKey>(
    key: K,
    value: ModuleSettings[K],
): Promise<void> {
    await game.settings.set(CONSTANTS.MODULE_ID, key, value);
}

export function registerSetting<K extends SettingKey>(
    key: K,
    data: SettingRegistration<K>,
): void {
    game.settings.register(CONSTANTS.MODULE_ID, key, data);
}

/** A core setting by key, or undefined if this Foundry version doesn't register it. */
export function coreSetting(key: string): unknown {
    try {
        return game.settings.get("core", key);
    } catch {
        return undefined;
    }
}

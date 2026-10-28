/**
 * V1 → V3 migration runner.
 *
 * V3 data is written under new keys (actor flag `store`, the world journal);
 * the V1 flags and settings are never modified, so they double as the backup.
 */
import { CONSTANTS } from "../constants";
import { Logger } from "../foundry/Logger";
import { upgradePreV1 } from "../model/storage/migrate/preV1";
import {
    migrateV1Category,
    migrateV1Item,
    migratedValueMatches,
    type V1MigrationContext,
} from "../model/storage/migrate/v1";
import type { Issue } from "../model/storage/normalize/fields";
import {
    encodeTrackedItem,
    type StoredActorCollection,
} from "../model/storage/storage";
import type { CategoryData, TrackedItemData } from "../types/data";
import { SCHEMA_VERSION } from "../model/storage/schema";
import { toolKeyOf } from "../dnd5e/actors";
import { abilityLabel, skillLabel, toolLabel } from "../dnd5e/config";
import {
    type Actor,
    actorFlags,
    isTokenActor,
    ownActorFlags,
    worldActors,
} from "../foundry/actors";
import { updateDocument } from "../foundry/documents";
import { localize, localizeText } from "../foundry/i18n";
import { localized } from "../lib/text";
import { macroByName } from "../foundry/macros";
import { notifyInfo, notifyWarn } from "../foundry/notifications";
import { getSetting } from "../foundry/settings";
import { isActiveGM } from "../foundry/users";
import { randomId } from "../foundry/utils";
import { createWorldJournal, getWorldJournal } from "./stores";

export interface MigrationReport {
    items: TrackedItemData[];
    categories: CategoryData[];
    issues: { itemId: string | null; issue: Issue }[];
}

const ROLL_PREFIX = () => `${localize("downtime-dnd5e.Roll")} `;

function labelFor(style: string, key: string | null): string {
    switch (style) {
        case "ABILITY":
            return `${ROLL_PREFIX()}${key ? abilityLabel(key) : key}`;
        case "SKILL":
            return `${ROLL_PREFIX()}${key ? skillLabel(key) : key}`;
        case "TOOL":
            return `${ROLL_PREFIX()}${key ? toolLabel(key) : key}`;
        case "MACRO":
            return key ?? localize("downtime-dnd5e.MethodKind.MACRO");
        default:
            return localize("downtime-dnd5e.ProgressionStyleFixed");
    }
}

export function migrationContext(actor: Actor | null): V1MigrationContext {
    return {
        randomId,
        resolveToolKey: (toolItemId) => toolKeyOf(actor, toolItemId),
        resolveMacroUuid: (name) => macroByName(name)?.uuid ?? null,
        methodName: labelFor,
        t: localize,
        isMethodAction: (actionName, style, itemName) => {
            if (actionName.startsWith(ROLL_PREFIX())) return true;
            if (style === "FIXED") return actionName === itemName;
            // V1 logged macro uses as "Macro", in English.
            if (style === "MACRO") return actionName === "Macro";
            return false;
        },
        now: () => Date.now(),
    };
}

export function migrateV1Data(
    rawItems: unknown,
    rawCategories: unknown,
    actor: Actor | null,
): MigrationReport {
    const ctx = migrationContext(actor);
    const report: MigrationReport = { items: [], categories: [], issues: [] };
    const seen = new Set<string>();
    for (const raw of Array.isArray(rawItems) ? rawItems : []) {
        const source = upgradePreV1(raw, ctx.randomId);
        const result = migrateV1Item(source, ctx);
        const itemId = result.value?.id ?? null;
        for (const issue of result.issues)
            report.issues.push({ itemId, issue });
        if (!result.value) continue;
        if (seen.has(result.value.id)) result.value.id = ctx.randomId();
        seen.add(result.value.id);
        if (!migratedValueMatches(result.value, source)) {
            report.issues.push({
                itemId,
                issue: {
                    severity: "quarantined",
                    path: "progress",
                    message: localized("downtime-dnd5e.Data.V1ValueMismatch"),
                },
            });
        }
        report.items.push(result.value);
    }
    for (const raw of Array.isArray(rawCategories) ? rawCategories : []) {
        const result = migrateV1Category(raw, ctx.randomId, ctx.t);
        if (result.value) report.categories.push(result.value);
    }
    return report;
}

export function actorCollection(
    report: MigrationReport,
): StoredActorCollection {
    return {
        schemaVersion: SCHEMA_VERSION,
        items: Object.fromEntries(
            report.items.map((item) => [item.id, encodeTrackedItem(item)]),
        ),
        order: report.items.map((item) => item.id),
        categories: report.categories,
    };
}

/**
 * The module flags an actor holds *itself*. For unlinked token actors that is
 * the token's ActorDelta, not the merged view: a token inherits the base
 * actor's V3 store, but V1 wrote the token's own progress into its delta.
 */
export function ownModuleFlags(
    actor: Actor,
): Record<string, unknown> | undefined {
    return ownActorFlags(actor, CONSTANTS.MODULE_ID);
}

/** Flag key holding this actor's own V3 store. */
export function storeFlagKey(actor: Actor): string {
    return isTokenActor(actor)
        ? CONSTANTS.FLAGS.tokenStore
        : CONSTANTS.FLAGS.store;
}

export function hasOwnV3Store(actor: Actor): boolean {
    return !!ownModuleFlags(actor)?.[storeFlagKey(actor)];
}

/** V1 data of an actor that has no V3 store yet, or null. */
export function legacyActorData(
    actor: Actor,
): { items: unknown; categories: unknown } | null {
    const own = ownModuleFlags(actor);
    if (!own || own[storeFlagKey(actor)]) return null;
    if (!Array.isArray(own[CONSTANTS.FLAGS.trainingItems])) return null;
    const merged = actorFlags(actor, CONSTANTS.MODULE_ID);
    return {
        items: own[CONSTANTS.FLAGS.trainingItems],
        categories:
            own[CONSTANTS.FLAGS.categories] ??
            merged?.[CONSTANTS.FLAGS.categories],
    };
}

/** The migration notice points GMs at the console, so these are localized too. */
function logIssues(where: string, issues: MigrationReport["issues"]) {
    const readable = (list: MigrationReport["issues"]) =>
        list.map(({ itemId, issue }) => ({
            itemId,
            severity: issue.severity,
            path: issue.path,
            message: localizeText(issue.message),
        }));
    const serious = issues.filter(({ issue }) => issue.severity !== "repaired");
    if (serious.length > 0)
        Logger.warn(
            localize("downtime-dnd5e.V3.MigrationIssues", {
                count: serious.length,
                where,
            }),
            false,
            readable(serious),
        );
    else if (issues.length > 0)
        Logger.debug(
            localize("downtime-dnd5e.V3.MigrationRepaired", {
                count: issues.length,
                where,
            }),
            readable(issues),
        );
    return serious.length;
}

/** GM, on ready. Idempotent. */
export async function runMigration(): Promise<void> {
    if (!isActiveGM()) return;
    let items = 0;
    let stores = 0;
    let issues = 0;

    // World: the journal's existence marks the world as migrated.
    if (!getWorldJournal()) {
        const report = migrateV1Data(
            getSetting(CONSTANTS.SETTINGS.worldActivities),
            getSetting(CONSTANTS.SETTINGS.worldCategories),
            null,
        );
        await createWorldJournal(report.items, report.categories);
        items += report.items.length;
        stores++;
        issues += logIssues(
            localize("downtime-dnd5e.V3.WorldDowntimes"),
            report.issues,
        );
    }

    for (const actor of worldActors()) {
        const legacy = legacyActorData(actor);
        if (!legacy) continue;
        const report = migrateV1Data(legacy.items, legacy.categories, actor);
        await updateDocument(actor, {
            [`flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.store}`]:
                actorCollection(report),
        });
        items += report.items.length;
        stores++;
        issues += logIssues(actor.name ?? actor.uuid!, report.issues);
    }

    if (stores > 0) {
        const message = localize("downtime-dnd5e.V3.MigrationDone", {
            items,
            stores,
            issues,
        });
        if (issues > 0) notifyWarn(message);
        else notifyInfo(message);
    }
}

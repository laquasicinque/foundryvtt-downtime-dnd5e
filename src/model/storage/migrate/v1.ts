/**
 * V1 → V3 migration. Pure: Foundry lookups are injected.
 *
 * Builds plain V3 JSON and runs it through the normaliser, so migrated data
 * gets exactly the same validation and repairs as anything loaded later.
 */
import { deriveState } from "../../rules/derive";
import {
    parseCategory,
    parseTrackedItem,
    type ParseResult,
} from "../normalize/item";
import type { Issue } from "../normalize/fields";
import type {
    CategoryData,
    QuarantinedRecord,
    TrackedItemData,
} from "../../../types/data";
import { SCHEMA_VERSION } from "../schema";
import { localized } from "../../../lib/text";
import { isRecord, parseFinite } from "../../../lib/values";
import type { Translate } from "../../../types/i18n";

export interface V1MigrationContext {
    randomId: () => string;
    /** Resolve a V1 tool item id to its dnd5e tool key (system.type.baseItem). null if unresolvable. */
    resolveToolKey(toolItemId: string): string | null;
    /** Resolve a macro name to its UUID, if it still exists. */
    resolveMacroUuid(name: string): string | null;
    /** Localised method name for the migrated method. */
    methodName(style: string, key: string | null): string;
    t: Translate;
    /**
     * Whether a V1 audit `actionName` was produced by using the method (vs. a
     * manual edit or the API). V1 logged rolls as "Roll <thing>", fixed
     * increments under the item's name, and macros as "Macro".
     */
    isMethodAction: (
        actionName: string,
        style: string,
        itemName: string,
    ) => boolean;
    /** Timestamp for events created by the migration itself. */
    now: () => number;
    /** Reason on the reconciling SET event: MIGRATION (default) or IMPORT (V1 files). */
    reconcileReason?: "MIGRATION" | "IMPORT";
}

const ICON_DEFAULT = "icons/svg/book.svg";
const COMPLETION_MILESTONE_ID = "v1-completion";
const METHOD_ID = "v1-method";

type Raw = Record<string, unknown>;

function toNumber(raw: unknown, fallback: number): number {
    return parseFinite(raw) ?? fallback;
}

const str = (raw: unknown): string | null =>
    typeof raw === "string" && raw.length > 0 ? raw : null;

export function isV1Item(raw: unknown): boolean {
    if (!isRecord(raw)) return false;
    return (
        raw.schemaVersion === undefined ||
        raw.schemaVersion === null ||
        toNumber(raw.schemaVersion, 0) < SCHEMA_VERSION
    );
}

/** DC pass/fail bands, or "+roll total" without a DC (V1 rules). */
function v1Results(dc: number | null, ctx: V1MigrationContext) {
    if (dc === null) {
        return {
            bands: [
                {
                    id: ctx.randomId(),
                    label: "",
                    when: [],
                    effect: { delta: { kind: "FORMULA", formula: "@total" } },
                    countsAs: "SUCCESS",
                },
            ],
        };
    }
    return {
        bands: [
            {
                id: ctx.randomId(),
                label: "",
                when: [{ on: "MARGIN", op: "gte", value: 0 }],
                effect: { delta: { kind: "STATIC", value: 1 } },
                countsAs: "SUCCESS",
            },
            {
                id: ctx.randomId(),
                label: "",
                when: [],
                effect: { delta: { kind: "STATIC", value: 0 } },
                countsAs: "FAILURE",
            },
        ],
    };
}

function v1Method(
    raw: Raw,
    ctx: V1MigrationContext,
    quarantine: QuarantinedRecord[],
): Raw | null {
    const style = str(raw.progressionStyle) ?? "";
    const dc = parseFinite(raw.dc);
    const img = str(raw.chat_icon);
    const base = {
        id: METHOD_ID,
        description: "",
        img,
        hidden: false,
        requirements: [],
        usage: null,
    };

    switch (style) {
        case "ABILITY":
        case "SKILL": {
            const key = str(style === "ABILITY" ? raw.ability : raw.skill);
            if (!key) break;
            return {
                ...base,
                kind: style,
                name: ctx.methodName(style, key),
                [style === "ABILITY" ? "ability" : "skill"]: key,
                dc,
                results: v1Results(dc, ctx),
            };
        }
        case "TOOL": {
            const toolItemId = str(raw.tool);
            const tool = toolItemId ? ctx.resolveToolKey(toolItemId) : null;
            if (!tool) {
                quarantine.push({
                    path: "methods[0]",
                    reason: localized("downtime-dnd5e.Data.V1ToolUnresolved", {
                        tool: JSON.stringify(toolItemId),
                    }),
                    raw,
                });
                return null;
            }
            return {
                ...base,
                kind: "TOOL",
                name: ctx.methodName(style, tool),
                tool,
                fallback: null,
                dc,
                results: v1Results(dc, ctx),
            };
        }
        case "FIXED":
            return {
                ...base,
                kind: "FIXED",
                name: ctx.methodName(style, null),
                effect: {
                    delta: {
                        kind: "STATIC",
                        value:
                            toNumber(raw.fixedIncrease, 0) ||
                            toNumber(raw.fixed, 0) ||
                            1,
                    },
                },
                countsAs: "SUCCESS",
            };
        case "MACRO": {
            const macroName = str(raw.macro) ?? str(raw.macroName);
            if (!macroName) break;
            return {
                ...base,
                kind: "MACRO",
                name: ctx.methodName(style, macroName),
                macroUuid: ctx.resolveMacroUuid(macroName) ?? "",
                macroName,
                results: null,
            };
        }
    }
    quarantine.push({
        path: "methods[0]",
        reason: localized("downtime-dnd5e.Data.V1MissingSettings", { style }),
        raw,
    });
    return null;
}

function v1Contributor(raw: unknown) {
    // V1: a user name string. The unreleased V2: { name, id }.
    if (isRecord(raw)) {
        return {
            actorUuid: null,
            actorName: null,
            userId: str(raw.id),
            userName: str(raw.name),
            userWasGM: false,
        };
    }
    return {
        actorUuid: null,
        actorName: null,
        userId: null,
        userName: str(raw),
        userWasGM: false,
    };
}

const SYSTEM_CONTRIBUTOR = {
    actorUuid: null,
    actorName: null,
    userId: null,
    userName: null,
    userWasGM: true,
};

/**
 * Migrate one V1 item. Returns the normalised V3 item and every issue raised
 * on the way (repairs included), so the runner can report them.
 */
export function migrateV1Item(
    raw: unknown,
    ctx: V1MigrationContext,
): ParseResult<TrackedItemData> {
    if (!isRecord(raw)) {
        return parseTrackedItem(raw, { randomId: ctx.randomId, t: ctx.t });
    }
    const quarantine: QuarantinedRecord[] = [];
    const style = str(raw.progressionStyle) ?? "";
    const completionAt = toNumber(raw.completionAt, 0);
    const storedProgress = toNumber(raw.progress, 0);
    const method = v1Method(raw, ctx, quarantine);

    // Audit entries → LEGACY events, in original order.
    const changes = Array.isArray(raw.changes) ? raw.changes : [];
    const history: Raw[] = [];
    changes.forEach((change, index) => {
        if (!isRecord(change)) {
            quarantine.push({
                path: `history[${index}]`,
                reason: localized("downtime-dnd5e.Data.V1EntryNotObject"),
                raw: change,
            });
            return;
        }
        const before = toNumber(change.oldValue, Number.NaN);
        const after = toNumber(change.newValue, Number.NaN);
        if (!Number.isFinite(before) || !Number.isFinite(after)) {
            quarantine.push({
                path: `history[${index}]`,
                reason: localized("downtime-dnd5e.Data.V1EntryNoValue"),
                raw: change,
            });
            return;
        }
        const actionName = str(change.actionName) ?? "";
        history.push({
            id: str(change.id) ?? ctx.randomId(),
            kind: "LEGACY",
            seq: history.length,
            timestamp: change.timestamp,
            contributor: v1Contributor(change.user),
            dismissed: change.dismissed === true,
            note: str(change.note),
            actionName,
            methodId:
                method &&
                ctx.isMethodAction(actionName, style, str(raw.name) ?? "")
                    ? METHOD_ID
                    : null,
            progress: {
                requested: after - before,
                applied: after - before,
                before,
                after,
            },
        });
    });

    const replayed = history.reduce(
        (sum, e) => sum + (e.progress as { applied: number }).applied,
        0,
    );
    const migrationEvent = (value: number, before: number): Raw => ({
        id: ctx.randomId(),
        kind: "SET",
        seq: history.length,
        timestamp: ctx.now(),
        contributor: SYSTEM_CONTRIBUTOR,
        dismissed: true,
        note: null,
        reason: ctx.reconcileReason ?? "MIGRATION",
        value,
        before,
    });
    if (replayed !== storedProgress)
        history.push(migrationEvent(storedProgress, replayed));

    const milestones =
        completionAt > 0
            ? [
                  {
                      id: COMPLETION_MILESTONE_ID,
                      label: "",
                      at: completionAt,
                      match: "CROSS",
                      maxTimes: 1,
                      revertWithCause: true,
                      actions: [
                          { id: "v1-complete", kind: "COMPLETE" },
                          {
                              id: "v1-announce",
                              kind: "ANNOUNCE",
                              message: null,
                              audience: "WORLD_DEFAULT",
                          },
                      ],
                  },
              ]
            : [];

    // Already complete: record the completion as fired so it doesn't fire (or announce) again.
    if (completionAt > 0 && storedProgress >= completionAt) {
        if (history.length === 0)
            history.push(migrationEvent(storedProgress, 0));
        const cause = history.at(-1)!;
        history.push({
            id: ctx.randomId(),
            kind: "MILESTONE",
            seq: history.length,
            timestamp: ctx.now(),
            contributor: SYSTEM_CONTRIBUTOR,
            dismissed: true,
            note: null,
            milestoneId: COMPLETION_MILESTONE_ID,
            causeEventId: cause.id,
            actions: ["v1-complete", "v1-announce"].map((actionId, i) => ({
                actionId,
                kind: i === 0 ? "COMPLETE" : "ANNOUNCE",
                status: "APPLIED",
                message: localized("downtime-dnd5e.Data.MigratedFromV1"),
                createdUuids: [],
                createdItems: [],
                adjustedEvent: null,
                recipientUuids: [],
            })),
        });
    }

    const v3 = {
        schemaVersion: SCHEMA_VERSION,
        id: str(raw.id) ?? ctx.randomId(),
        name: str(raw.name) ?? ctx.t("downtime-dnd5e.Data.Unnamed"),
        img: str(raw.img) ?? ICON_DEFAULT,
        description: typeof raw.description === "string" ? raw.description : "",
        categoryId: str(raw.category),
        hidden: raw.hidden === true,
        preset: "goal",
        progress: {
            target: completionAt > 0 ? completionAt : null,
            min: 0,
            max: completionAt > 0 ? completionAt : null,
        },
        approval: "WORLD_DEFAULT",
        methods: method ? [method] : [],
        milestones,
        history,
        quarantine,
    };

    const result = parseTrackedItem(v3, { randomId: ctx.randomId, t: ctx.t });
    const migrationIssues: Issue[] = quarantine.map((q) => ({
        severity: "quarantined",
        path: q.path,
        message: q.reason,
    }));
    return { ...result, issues: [...migrationIssues, ...result.issues], raw };
}

/** Sanity check used by tests and the runner: migrated value must match V1 stored progress (clamped). */
export function migratedValueMatches(
    item: TrackedItemData,
    raw: unknown,
): boolean {
    if (!isRecord(raw)) return false;
    const expected = toNumber(raw.progress, 0);
    return deriveState(item).rawValue === expected;
}

export function migrateV1Category(
    raw: unknown,
    randomId: () => string,
    t: Translate,
): ParseResult<CategoryData> {
    return parseCategory(raw, { randomId, t });
}

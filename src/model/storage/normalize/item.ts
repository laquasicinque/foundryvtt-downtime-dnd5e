import type {
    ApprovalPolicy,
    CategoryData,
    ProgressConfig,
    QuarantinedRecord,
    TrackedItemData,
    TrackedItemTemplate,
} from "../../../types/data";
import { SCHEMA_VERSION } from "../schema";
import { parseHistory } from "./events";
import {
    bool,
    describe,
    fail,
    id,
    isStoredText,
    join,
    list,
    nullableNum,
    nullableStr,
    obj,
    oneOf,
    parseEach,
    repaired,
    str,
    type Issue,
    type NormalizeContext,
    type Raw,
} from "./fields";
import { InvalidRecord } from "./InvalidRecord";
import { parseMethod, parseRequirement } from "./methods";
import { parseMilestone, type TemplateParser } from "./milestones";
import { localized } from "../../../lib/text";
import { isRecord } from "../../../lib/values";
import type { LocalizedText, Translate } from "../../../types/i18n";

export interface ParseResult<T> {
    /** null when the record is unrecoverable (render as a "broken item" row for the GM). */
    value: T | null;
    issues: Issue[];
    raw: unknown;
}

export interface ParseOptions {
    randomId: () => string;
    /** For defaults a repair writes into the data (e.g. a missing name). */
    t: Translate;
}

function parseProgress(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): ProgressConfig {
    if (!isRecord(raw)) {
        repaired(ctx, path, "downtime-dnd5e.Data.MissingProgress");
        return { target: null, min: 0, max: null };
    }
    const config = {
        target: nullableNum(raw, "target", path, ctx),
        min: nullableNum(raw, "min", path, ctx),
        max: nullableNum(raw, "max", path, ctx),
    };
    if (config.min !== null && config.max !== null && config.min > config.max) {
        repaired(ctx, path, "downtime-dnd5e.Data.MinAboveMax", {
            min: config.min,
            max: config.max,
        });
        [config.min, config.max] = [config.max, config.min];
    }
    return config;
}

function parseExistingQuarantine(
    obj: Raw,
    path: string,
    ctx: NormalizeContext,
): QuarantinedRecord[] {
    return list(obj, "quarantine", path, ctx).flatMap((entry, i) => {
        if (
            isRecord(entry) &&
            typeof entry.path === "string" &&
            isStoredText(entry.reason)
        ) {
            return [{ path: entry.path, reason: entry.reason, raw: entry.raw }];
        }
        // Keep it rather than lose data, wrapped in a valid record.
        repaired(
            ctx,
            join(join(path, "quarantine"), i),
            "downtime-dnd5e.Data.RewrappedQuarantine",
        );
        return [
            {
                path: join(join(path, "quarantine"), i),
                reason: localized("downtime-dnd5e.Data.MalformedQuarantine"),
                raw: entry,
            },
        ];
    });
}

/** Body shared by items and templates: everything except id/history/schema. */
function parseBody(
    obj: Raw,
    path: string,
    ctx: NormalizeContext,
    quarantine: QuarantinedRecord[],
): Omit<TrackedItemData, "id" | "history" | "quarantine" | "schemaVersion"> {
    const add = (record: QuarantinedRecord) => quarantine.push(record);
    const requirementsPath = join(path, "requirements");
    const quarantinedBefore = quarantine.length;
    const requirements = parseEach(
        list(obj, "requirements", path, ctx),
        requirementsPath,
        ctx,
        add,
        (raw, p) => parseRequirement(raw, p, ctx),
        (requirement) => requirement.id,
    );
    // Fail closed: if an item-level requirement can't be read, hide the item from
    // players rather than show it to everyone (the GM sees it and the quarantine).
    const brokenRequirement = quarantine.length > quarantinedBefore;
    if (brokenRequirement)
        repaired(
            ctx,
            join(path, "hidden"),
            "downtime-dnd5e.Data.HiddenForRequirement",
        );
    return {
        name: str(obj, "name", path, ctx, "Unnamed"),
        img: str(obj, "img", path, ctx, ""),
        description: str(obj, "description", path, ctx, ""),
        categoryId: nullableStr(obj, "categoryId", path, ctx),
        hidden: brokenRequirement || bool(obj, "hidden", path, ctx, false),
        requirements,
        preset: nullableStr(obj, "preset", path, ctx),
        progress: parseProgress(obj.progress, join(path, "progress"), ctx),
        approval: oneOf<ApprovalPolicy>(
            obj,
            "approval",
            ["WORLD_DEFAULT", "AUTO", "GM"],
            path,
            ctx,
            "WORLD_DEFAULT",
        ),
        methods: parseEach(
            list(obj, "methods", path, ctx),
            join(path, "methods"),
            ctx,
            add,
            (raw, p) => parseMethod(raw, p, ctx),
            (method) => method.id,
        ),
        milestones: parseEach(
            list(obj, "milestones", path, ctx),
            join(path, "milestones"),
            ctx,
            add,
            (raw, p) => parseMilestone(raw, p, ctx, parseTemplate),
            (milestone) => milestone.id,
        ),
    };
}

/**
 * Templates (ADD_TRACKED_ITEM) are parsed strictly: a template with any
 * quarantined part is invalid as a whole, so its action fails closed.
 */
const parseTemplate: TemplateParser = (raw, path, ctx): TrackedItemTemplate => {
    const o = obj(raw, path);
    const quarantine: QuarantinedRecord[] = [];
    const body = parseBody(o, path, ctx, quarantine);
    if (quarantine.length > 0)
        fail(path, "downtime-dnd5e.Data.TemplateInvalid", {
            count: quarantine.length,
        });
    return body;
};

/**
 * Parse a stored V3 tracked item. Never throws for bad data:
 * minor problems are repaired, broken records are quarantined into
 * `item.quarantine`, and only an unrecoverable item returns `value: null`.
 *
 * V1 data must be migrated before reaching this.
 */
export function parseTrackedItem(
    raw: unknown,
    options: ParseOptions,
): ParseResult<TrackedItemData> {
    const ctx: NormalizeContext = {
        issues: [],
        randomId: options.randomId,
        t: options.t,
    };
    const fatal = (message: LocalizedText): ParseResult<TrackedItemData> => {
        ctx.issues.push({ severity: "fatal", path: "", message });
        return { value: null, issues: ctx.issues, raw };
    };

    if (!isRecord(raw))
        return fatal(
            localized("downtime-dnd5e.Data.ExpectedObject", {
                type: describe(raw),
            }),
        );
    if (raw.schemaVersion !== SCHEMA_VERSION) {
        return fatal(
            localized("downtime-dnd5e.Data.UnsupportedSchema", {
                version: JSON.stringify(raw.schemaVersion),
            }),
        );
    }

    try {
        const quarantine = parseExistingQuarantine(raw, "", ctx);
        const itemId = id(raw, "id", "", ctx);
        const body = parseBody(raw, "", ctx, quarantine);
        const history = parseHistory(raw.history, "history", ctx, quarantine);
        return {
            value: {
                schemaVersion: SCHEMA_VERSION,
                id: itemId,
                ...body,
                history,
                quarantine,
            },
            issues: ctx.issues,
            raw,
        };
    } catch (error) {
        // Record parsers quarantine their own failures; anything reaching here is item-level.
        if (error instanceof InvalidRecord)
            return fatal(
                localized("downtime-dnd5e.Data.AtPath", {
                    path: error.path,
                    problem: error.text,
                }),
            );
        return fatal(
            localized("downtime-dnd5e.Error.Unexpected", {
                message: error instanceof Error ? error.message : String(error),
            }),
        );
    }
}

export function parseCategory(
    raw: unknown,
    options: ParseOptions,
): ParseResult<CategoryData> {
    const ctx: NormalizeContext = {
        issues: [],
        randomId: options.randomId,
        t: options.t,
    };
    if (!isRecord(raw)) {
        ctx.issues.push({
            severity: "fatal",
            path: "",
            message: localized("downtime-dnd5e.Data.ExpectedObject", {
                type: describe(raw),
            }),
        });
        return { value: null, issues: ctx.issues, raw };
    }
    return {
        value: {
            id: id(raw, "id", "", ctx),
            name: str(
                raw,
                "name",
                "",
                ctx,
                ctx.t("downtime-dnd5e.Data.UnnamedCategory"),
            ),
            description: str(raw, "description", "", ctx, ""),
        },
        issues: ctx.issues,
        raw,
    };
}

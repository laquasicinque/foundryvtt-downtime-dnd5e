import type {
    BandSnapshot,
    Contributor,
    EventBaseData,
    HistoryEventData,
    ItemLocation,
    StoreRef,
    MilestoneActionResult,
    ProgressDelta,
    QuarantinedRecord,
    RollSummary,
    StateEventData,
} from "../../../types/data";
import {
    bool,
    fail,
    join,
    list,
    nullableNum,
    nullableStr,
    nullableText,
    num,
    obj,
    oneOf,
    repaired,
    requiredStr,
    str,
    strList,
    timestamp,
    type NormalizeContext,
} from "./fields";
import { InvalidRecord } from "./InvalidRecord";
import { METHOD_KINDS, parseCountsAs } from "./methods";
import { ACTION_KINDS } from "./milestones";
import { localized } from "../../../lib/text";
import { isRecord } from "../../../lib/values";

const UNKNOWN_CONTRIBUTOR: Contributor = {
    actorUuid: null,
    actorName: null,
    userId: null,
    userName: null,
    userWasGM: false,
};

/** Contributors are always repaired, never quarantined: an unknown author is still a valid event. */
function parseContributor(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): Contributor {
    if (!isRecord(raw)) {
        // V1 stored the user name as a plain string.
        if (typeof raw === "string" && raw.length > 0)
            return { ...UNKNOWN_CONTRIBUTOR, userName: raw };
        repaired(ctx, path, "downtime-dnd5e.Data.UnknownContributor");
        return { ...UNKNOWN_CONTRIBUTOR };
    }
    return {
        actorUuid: nullableStr(raw, "actorUuid", path, ctx),
        actorName: nullableStr(raw, "actorName", path, ctx),
        userId: nullableStr(raw, "userId", path, ctx),
        userName: nullableStr(raw, "userName", path, ctx),
        userWasGM: bool(raw, "userWasGM", path, ctx, false),
    };
}

function parseProgressDelta(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): ProgressDelta {
    const o = obj(raw, path);
    // `applied` is the only field the fold reads; it must be valid.
    const applied = num(o, "applied", path, ctx);
    const before = num(o, "before", path, ctx, 0);
    return {
        applied,
        requested: num(o, "requested", path, ctx, applied),
        before,
        after: num(o, "after", path, ctx, before + applied),
    };
}

/** Display-only data: a broken roll summary is dropped (repaired), not quarantined. */
function parseRoll(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): RollSummary | null {
    if (raw === null || raw === undefined) return null;
    try {
        const o = obj(raw, path);
        const rolled = obj(o.rolled, join(path, "rolled"));
        const rolledPath = join(path, "rolled");
        return {
            formula: str(o, "formula", path, ctx, ""),
            total: num(o, "total", path, ctx),
            natural: nullableNum(o, "natural", path, ctx),
            dc: nullableNum(o, "dc", path, ctx),
            dcSource:
                o.dcSource === "METHOD" || o.dcSource === "ACTIVITY"
                    ? o.dcSource
                    : null,
            rolled: {
                kind: oneOf(
                    rolled,
                    "kind",
                    ["ABILITY", "SKILL", "TOOL", "SAVE", "CUSTOM"],
                    rolledPath,
                    ctx,
                    "CUSTOM",
                ),
                key: str(rolled, "key", rolledPath, ctx, ""),
                label: str(rolled, "label", rolledPath, ctx, ""),
                ...(typeof rolled.toolItemName === "string" && {
                    toolItemName: rolled.toolItemName,
                }),
                ...(typeof rolled.activityName === "string" && {
                    activityName: rolled.activityName,
                }),
            },
            rollMode: str(o, "rollMode", path, ctx, ""),
            messageId: nullableStr(o, "messageId", path, ctx),
        };
    } catch (error) {
        if (!(error instanceof InvalidRecord)) throw error;
        repaired(ctx, path, "downtime-dnd5e.Data.DroppedRollSummary", {
            problem: error.text,
        });
        return null;
    }
}

function parseBandSnapshot(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): BandSnapshot | null {
    if (raw === null || raw === undefined) return null;
    const o = obj(raw, path);
    return {
        id: requiredStr(o, "id", path),
        label: str(o, "label", path, ctx, ""),
        countsAs: parseCountsAs(o.countsAs, join(path, "countsAs"), ctx),
    };
}

function parseActionResult(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): MilestoneActionResult {
    const o = obj(raw, path);
    const adjusted = o.adjustedEvent;
    const adjustedPath = join(path, "adjustedEvent");
    return {
        actionId: requiredStr(o, "actionId", path),
        kind: oneOf(o, "kind", ACTION_KINDS, path, ctx),
        status: oneOf(
            o,
            "status",
            ["APPLIED", "PENDING_APPROVAL", "REJECTED", "FAILED", "REVERTED"],
            path,
            ctx,
        ),
        message: nullableText(o, "message", path, ctx),
        createdUuids: strList(o, "createdUuids", path, ctx),
        createdItems: list(o, "createdItems", path, ctx).map((entry, i) =>
            parseItemLocation(entry, join(join(path, "createdItems"), i), ctx),
        ),
        adjustedEvent: isRecord(adjusted)
            ? {
                  ...parseItemLocation(adjusted, adjustedPath, ctx),
                  eventId: requiredStr(adjusted, "eventId", adjustedPath),
              }
            : null,
        recipientUuids: strList(o, "recipientUuids", path, ctx),
    };
}

export function parseStoreRef(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): StoreRef {
    const o = obj(raw, path);
    const kind = oneOf(o, "kind", ["ACTOR", "WORLD"], path, ctx);
    if (kind === "WORLD") return { kind };
    return { kind, actorUuid: requiredStr(o, "actorUuid", path) };
}

function parseItemLocation(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): ItemLocation {
    const o = obj(raw, path);
    return {
        store: parseStoreRef(o.store, join(path, "store"), ctx),
        itemId: requiredStr(o, "itemId", path),
    };
}

export const EVENT_KINDS = [
    "METHOD",
    "ADJUST",
    "SET",
    "LEGACY",
    "MILESTONE",
    "APPROVAL",
    "REVERT",
    "STATE",
] as const satisfies readonly HistoryEventData["kind"][];

/**
 * Parse one event. `fallbackId` is the storage key when history is persisted
 * as a keyed object. `seq` may be NaN here; `parseHistory` repairs ordering.
 */
function parseEvent(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
    fallbackId: string | null,
): HistoryEventData {
    const o = obj(raw, path);
    const kind = oneOf(o, "kind", EVENT_KINDS, path, ctx);

    let eventId =
        typeof o.id === "string" && o.id.length > 0 ? o.id : fallbackId;
    if (!eventId) {
        eventId = ctx.randomId();
        repaired(ctx, join(path, "id"), "downtime-dnd5e.Data.MissingId", {
            id: eventId,
        });
    }
    const base: EventBaseData = {
        id: eventId,
        seq:
            typeof o.seq === "number" && Number.isInteger(o.seq)
                ? o.seq
                : Number.NaN,
        timestamp: timestamp(o, "timestamp", path, ctx),
        contributor: parseContributor(
            o.contributor,
            join(path, "contributor"),
            ctx,
        ),
        dismissed: bool(o, "dismissed", path, ctx, false),
        note: nullableStr(o, "note", path, ctx),
    };

    switch (kind) {
        case "METHOD": {
            const method = obj(o.method, join(path, "method"));
            return {
                ...base,
                kind,
                methodId: requiredStr(o, "methodId", path),
                method: {
                    name: str(method, "name", join(path, "method"), ctx, ""),
                    kind: oneOf(
                        method,
                        "kind",
                        METHOD_KINDS,
                        join(path, "method"),
                        ctx,
                    ),
                },
                band: parseBandSnapshot(o.band, join(path, "band"), ctx),
                roll: parseRoll(o.roll, join(path, "roll"), ctx),
                usageTier: nullableNum(o, "usageTier", path, ctx),
                progress: parseProgressDelta(
                    o.progress,
                    join(path, "progress"),
                    ctx,
                ),
            };
        }
        case "ADJUST":
            return {
                ...base,
                kind,
                progress: parseProgressDelta(
                    o.progress,
                    join(path, "progress"),
                    ctx,
                ),
            };
        case "SET":
            return {
                ...base,
                kind,
                reason: oneOf(
                    o,
                    "reason",
                    ["MIGRATION", "API", "MANUAL", "IMPORT"],
                    path,
                    ctx,
                    "MANUAL",
                ),
                value: num(o, "value", path, ctx),
                before: num(o, "before", path, ctx, 0),
            };
        case "LEGACY":
            return {
                ...base,
                kind,
                actionName: str(o, "actionName", path, ctx, ""),
                methodId: nullableStr(o, "methodId", path, ctx),
                progress: parseProgressDelta(
                    o.progress,
                    join(path, "progress"),
                    ctx,
                ),
            };
        case "MILESTONE": {
            const actionsPath = join(path, "actions");
            return {
                ...base,
                kind,
                milestoneId: requiredStr(o, "milestoneId", path),
                causeEventId: requiredStr(o, "causeEventId", path),
                actions: list(o, "actions", path, ctx).map((a, i) =>
                    parseActionResult(a, join(actionsPath, i), ctx),
                ),
            };
        }
        case "APPROVAL": {
            if (typeof o.approved !== "boolean")
                fail(
                    join(path, "approved"),
                    "downtime-dnd5e.Data.ExpectedBoolean",
                );
            return {
                ...base,
                kind,
                milestoneEventId: requiredStr(o, "milestoneEventId", path),
                actionId: requiredStr(o, "actionId", path),
                approved: o.approved,
                result: parseActionResult(o.result, join(path, "result"), ctx),
            };
        }
        case "REVERT":
            return {
                ...base,
                kind,
                targetEventId: requiredStr(o, "targetEventId", path),
                revertedMilestoneEventIds: strList(
                    o,
                    "revertedMilestoneEventIds",
                    path,
                    ctx,
                ),
            };
        case "STATE": {
            const state: StateEventData = { ...base, kind };
            if (typeof o.locked === "boolean") state.locked = o.locked;
            if (typeof o.completed === "boolean") state.completed = o.completed;
            return state;
        }
    }
}

/**
 * History may be stored as an array (import, in-memory) or as a keyed object
 * (persisted shape). Returns events sorted by seq.
 *
 * Ordering repair: events are sorted by (seq, timestamp, original position).
 * If any seq is missing or duplicated, all events are renumbered 0..n-1 in
 * that order. Timestamps never affect validity.
 */
export function parseHistory(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
    quarantine: QuarantinedRecord[],
): HistoryEventData[] {
    let entries: [string | null, unknown][];
    if (raw === undefined || raw === null) entries = [];
    else if (Array.isArray(raw)) entries = raw.map((value) => [null, value]);
    else if (isRecord(raw)) entries = Object.entries(raw);
    else {
        repaired(ctx, path, "downtime-dnd5e.Data.HistoryNotList");
        entries = [];
    }

    const parsed: { event: HistoryEventData; index: number }[] = [];
    const seen = new Set<string>();
    entries.forEach(([key, value], index) => {
        const entryPath = key === null ? join(path, index) : join(path, key);
        try {
            const event = parseEvent(value, entryPath, ctx, key);
            if (seen.has(event.id))
                fail(entryPath, "downtime-dnd5e.Data.DuplicateEventId", {
                    id: event.id,
                });
            seen.add(event.id);
            parsed.push({ event, index });
        } catch (error) {
            if (!(error instanceof InvalidRecord)) throw error;
            ctx.issues.push({
                severity: "quarantined",
                path: error.path,
                message: error.text,
            });
            quarantine.push({
                path: entryPath,
                reason: localized("downtime-dnd5e.Data.AtPath", {
                    path: error.path,
                    problem: error.text,
                }),
                raw: value,
            });
        }
    });

    const order = (n: number) =>
        Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
    parsed.sort(
        (a, b) =>
            order(a.event.seq) - order(b.event.seq) ||
            (a.event.timestamp ?? 0) - (b.event.timestamp ?? 0) ||
            a.index - b.index,
    );

    const seqs = parsed.map(({ event }) => event.seq);
    const needsRenumber = seqs.some(
        (seq, i) => Number.isNaN(seq) || (i > 0 && seq === seqs[i - 1]),
    );
    if (needsRenumber) {
        repaired(ctx, path, "downtime-dnd5e.Data.Renumbered");
        parsed.forEach(({ event }, i) => (event.seq = i));
    }
    return parsed.map(({ event }) => event);
}

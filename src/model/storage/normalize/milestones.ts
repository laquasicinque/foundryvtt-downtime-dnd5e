import type {
    ContributorFilter,
    MilestoneData,
    MilestoneAction,
    Recipient,
    RecipientSelection,
    TrackedItemTemplate,
} from "../../../types/data";
import {
    bool,
    fail,
    id,
    join,
    list,
    nullableNum,
    nullableStr,
    num,
    obj,
    oneOf,
    requiredStr,
    strList,
    type NormalizeContext,
} from "./fields";
import { parseTrackedItemRef } from "./methods";

/*
 * Fail-closed like methods: a broken action quarantines its milestone, so a
 * milestone never fires with only part of its actions.
 */

const SELECTIONS = [
    "AUTO",
    "GM_PICKS",
] as const satisfies readonly RecipientSelection[];

function parseFilter(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): ContributorFilter {
    const o = obj(raw ?? {}, path);
    return {
        window: oneOf(
            o,
            "window",
            ["ALL_TIME", "SINCE_LAST_FIRE"],
            path,
            ctx,
            "ALL_TIME",
        ),
        minNet: nullableNum(o, "minNet", path, ctx),
        minAttempts: nullableNum(o, "minAttempts", path, ctx),
        methodIds: strList(o, "methodIds", path, ctx),
    };
}

export function parseRecipient(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): Recipient {
    const o = obj(raw, path);
    const type = oneOf(
        o,
        "type",
        ["TRIGGERING_ACTOR", "OWNING_ACTOR", "ACTOR", "CONTRIBUTORS"],
        path,
        ctx,
    );
    switch (type) {
        case "TRIGGERING_ACTOR":
        case "OWNING_ACTOR":
            return { type };
        case "ACTOR": {
            const actorUuids = strList(o, "actorUuids", path, ctx);
            if (actorUuids.length === 0)
                fail(
                    join(path, "actorUuids"),
                    "downtime-dnd5e.Data.ActorRecipientEmpty",
                );
            return {
                type,
                actorUuids,
                selection: oneOf(o, "selection", SELECTIONS, path, ctx, "AUTO"),
            };
        }
        case "CONTRIBUTORS":
            return {
                type,
                filter: parseFilter(o.filter, join(path, "filter"), ctx),
                selection: oneOf(o, "selection", SELECTIONS, path, ctx, "AUTO"),
            };
    }
}

/** Injected to avoid a circular import with item.ts. */
export type TemplateParser = (
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
) => TrackedItemTemplate;

export const ACTION_KINDS = [
    "COMPLETE",
    "LOCK",
    "ANNOUNCE",
    "GRANT_ITEM",
    "APPLY_EFFECT",
    "ADD_TRACKED_ITEM",
    "ADJUST_PROGRESS",
    "MACRO",
] as const satisfies readonly MilestoneAction["kind"][];

function parseAction(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
    parseTemplate: TemplateParser,
): MilestoneAction {
    const o = obj(raw, path);
    const actionId = id(o, "id", path, ctx);
    const kind = oneOf(o, "kind", ACTION_KINDS, path, ctx);
    switch (kind) {
        case "COMPLETE":
        case "LOCK":
            return { id: actionId, kind };
        case "ANNOUNCE":
            return {
                id: actionId,
                kind,
                message: nullableStr(o, "message", path, ctx),
                audience: oneOf(
                    o,
                    "audience",
                    ["WORLD_DEFAULT", "PUBLIC", "GM"],
                    path,
                    ctx,
                    "WORLD_DEFAULT",
                ),
            };
        case "GRANT_ITEM":
            return {
                id: actionId,
                kind,
                sourceUuid: requiredStr(o, "sourceUuid", path),
                quantity: Math.max(1, num(o, "quantity", path, ctx, 1)),
                recipient: parseRecipient(
                    o.recipient,
                    join(path, "recipient"),
                    ctx,
                ),
            };
        case "APPLY_EFFECT":
            return {
                id: actionId,
                kind,
                sourceUuid: requiredStr(o, "sourceUuid", path),
                recipient: parseRecipient(
                    o.recipient,
                    join(path, "recipient"),
                    ctx,
                ),
            };
        case "ADD_TRACKED_ITEM":
            return {
                id: actionId,
                kind,
                template: parseTemplate(
                    o.template,
                    join(path, "template"),
                    ctx,
                ),
                store: oneOf(
                    o,
                    "store",
                    ["SAME", "RECIPIENT_ACTOR", "WORLD"],
                    path,
                    ctx,
                    "SAME",
                ),
                recipient:
                    o.recipient === null || o.recipient === undefined
                        ? null
                        : parseRecipient(
                              o.recipient,
                              join(path, "recipient"),
                              ctx,
                          ),
            };
        case "ADJUST_PROGRESS":
            return {
                id: actionId,
                kind,
                ref: parseTrackedItemRef(o.ref, join(path, "ref"), ctx),
                delta: num(o, "delta", path, ctx),
            };
        case "MACRO":
            return {
                id: actionId,
                kind,
                macroUuid: requiredStr(o, "macroUuid", path),
                undoMacroUuid: nullableStr(o, "undoMacroUuid", path, ctx),
            };
    }
}

export function parseMilestone(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
    parseTemplate: TemplateParser,
): MilestoneData {
    const o = obj(raw, path);
    const actions = list(o, "actions", path, ctx).map((a, i) =>
        parseAction(a, join(join(path, "actions"), i), ctx, parseTemplate),
    );
    const actionIds = new Set<string>();
    for (const action of actions) {
        if (actionIds.has(action.id))
            fail(
                join(path, "actions"),
                "downtime-dnd5e.Data.DuplicateActionId",
                { id: action.id },
            );
        actionIds.add(action.id);
    }
    const maxTimes = nullableNum(o, "maxTimes", path, ctx);
    const match = oneOf(
        o,
        "match",
        ["CROSS", "EXACT", "EVERY"],
        path,
        ctx,
        "CROSS",
    );
    if (match === "EVERY" && !(typeof o.at === "number" && o.at > 0))
        fail(join(path, "at"), "downtime-dnd5e.Data.RepeatInterval");
    if (maxTimes !== null && maxTimes < 1)
        fail(join(path, "maxTimes"), "downtime-dnd5e.Data.MaxTimes");

    return {
        id: id(o, "id", path, ctx),
        label: typeof o.label === "string" ? o.label : "",
        at: num(o, "at", path, ctx),
        match,
        maxTimes,
        revertWithCause: bool(o, "revertWithCause", path, ctx, true),
        actions,
    };
}

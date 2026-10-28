/**
 * Shape validation for commands arriving over the wire. Deep validation of
 * item data happens in the normaliser; this only guarantees the fields the
 * executor reads are the right types.
 */
import type { TransferChoices } from "../../types/transfer";
import type { CategoryData, StoreRef } from "../../types/data";
import { CommandError, localized } from "./CommandError";
import type {
    ClientRoll,
    Command,
    MacroMethodResult,
} from "../../types/commands";
import { isFiniteNumber, isRecord } from "../../lib/values";

type Raw = Record<string, unknown>;

/** The detail is for whoever wrote the code sending the command, so it stays in English. */
function invalid(detail: string): never {
    throw new CommandError(
        "INVALID",
        localized("downtime-dnd5e.Error.InvalidCommand", { detail }),
    );
}

function str(o: Raw, key: string): string {
    const value = o[key];
    if (typeof value !== "string" || value.length === 0)
        invalid(`${key} must be a non-empty string`);
    return value;
}

function optStr(o: Raw, key: string): string | null {
    const value = o[key];
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") invalid(`${key} must be a string`);
    return value;
}

function num(o: Raw, key: string): number {
    const value = o[key];
    if (!isFiniteNumber(value)) invalid(`${key} must be a finite number`);
    return value;
}

function optNum(o: Raw, key: string): number | null {
    const value = o[key];
    if (value === undefined || value === null) return null;
    return num(o, key);
}

function bool(o: Raw, key: string): boolean {
    const value = o[key];
    if (typeof value !== "boolean") invalid(`${key} must be a boolean`);
    return value;
}

function optBool(o: Raw, key: string): boolean | undefined {
    return o[key] === undefined ? undefined : bool(o, key);
}

function strArray(o: Raw, key: string): string[] {
    const value = o[key];
    if (!Array.isArray(value) || !value.every((v) => typeof v === "string"))
        invalid(`${key} must be a list of strings`);
    return value;
}

function store(raw: unknown): StoreRef {
    if (!isRecord(raw)) invalid("store is required");
    if (raw.kind === "WORLD") return { kind: "WORLD" };
    if (raw.kind === "ACTOR")
        return { kind: "ACTOR", actorUuid: str(raw, "actorUuid") };
    return invalid("store.kind must be ACTOR or WORLD");
}

function clientRoll(raw: unknown): ClientRoll {
    if (!isRecord(raw)) invalid("roll must be an object");
    const rolled = raw.rolled;
    if (!isRecord(rolled)) invalid("roll.rolled must be an object");
    const kind = rolled.kind;
    if (
        kind !== "ABILITY" &&
        kind !== "SKILL" &&
        kind !== "TOOL" &&
        kind !== "SAVE" &&
        kind !== "CUSTOM"
    )
        invalid("roll.rolled.kind is invalid");
    return {
        formula: optStr(raw, "formula") ?? "",
        total: num(raw, "total"),
        natural: optNum(raw, "natural"),
        activityDc: optNum(raw, "activityDc"),
        rolled: {
            kind,
            key: optStr(rolled, "key") ?? "",
            label: optStr(rolled, "label") ?? "",
            ...(typeof rolled.toolItemName === "string" && {
                toolItemName: rolled.toolItemName,
            }),
            ...(typeof rolled.activityName === "string" && {
                activityName: rolled.activityName,
            }),
        },
        rollMode: optStr(raw, "rollMode") ?? "",
        messageId: optStr(raw, "messageId"),
    };
}

function macroResult(raw: unknown): MacroMethodResult | null {
    if (raw === undefined || raw === null) return null;
    if (!isRecord(raw)) invalid("macroResult must be an object");
    if ("delta" in raw) return { delta: num(raw, "delta") };
    if ("roll" in raw) return { roll: clientRoll(raw.roll) };
    return invalid("macroResult needs delta or roll");
}

function boolRecord(raw: unknown): Record<string, boolean> {
    if (raw === undefined || raw === null) return {};
    if (
        !isRecord(raw) ||
        !Object.values(raw).every((v) => typeof v === "boolean")
    )
        invalid("macroRequirements must map ids to booleans");
    return raw as Record<string, boolean>;
}

function enumRecord<T extends string>(
    raw: unknown,
    key: string,
    allowed: readonly T[],
): Record<string, T> {
    if (raw === undefined || raw === null) return {};
    if (
        !isRecord(raw) ||
        !Object.values(raw).every((v) => allowed.includes(v as T))
    )
        invalid(`choices.${key} must map keys to ${allowed.join("/")}`);
    return raw as Record<string, T>;
}

function transferChoices(raw: unknown): TransferChoices {
    if (raw === undefined || raw === null) return {};
    if (!isRecord(raw)) invalid("choices must be an object");
    return {
        references: enumRecord(raw.references, "references", [
            "INCLUDE",
            "COPY_DEPENDENCY",
            "REMOVE",
            "KEEP",
        ] as const),
        recipients: enumRecord(raw.recipients, "recipients", [
            "SWITCH",
            "KEEP",
        ] as const),
        categories: enumRecord(raw.categories, "categories", [
            "CREATE",
            "UNCATEGORISED",
        ] as const),
    };
}

export function parseCommand(raw: unknown): Command {
    if (!isRecord(raw)) invalid("Command must be an object");
    const base = { store: store(raw.store) };
    switch (raw.type) {
        case "USE_METHOD":
            return {
                type: raw.type,
                ...base,
                itemId: str(raw, "itemId"),
                methodId: str(raw, "methodId"),
                actorUuid: optStr(raw, "actorUuid"),
                roll:
                    raw.roll === undefined || raw.roll === null
                        ? null
                        : clientRoll(raw.roll),
                amount: optNum(raw, "amount"),
                macroResult: macroResult(raw.macroResult),
                macroRequirements: boolRecord(raw.macroRequirements),
            };
        case "ADJUST":
            return {
                type: raw.type,
                ...base,
                itemId: str(raw, "itemId"),
                delta: num(raw, "delta"),
                actorUuid: optStr(raw, "actorUuid"),
                note: optStr(raw, "note"),
            };
        case "SET": {
            const reason = raw.reason ?? "MANUAL";
            if (reason !== "MANUAL" && reason !== "API")
                invalid("reason must be MANUAL or API");
            return {
                type: raw.type,
                ...base,
                itemId: str(raw, "itemId"),
                value: num(raw, "value"),
                reason,
                note: optStr(raw, "note"),
            };
        }
        case "REVERT_LATEST":
        case "DELETE_ITEM":
            return { type: raw.type, ...base, itemId: str(raw, "itemId") };
        case "RESOLVE_APPROVAL":
            return {
                type: raw.type,
                ...base,
                itemId: str(raw, "itemId"),
                milestoneEventId: str(raw, "milestoneEventId"),
                actionId: str(raw, "actionId"),
                approved: bool(raw, "approved"),
                ...(raw.recipientUuids !== undefined && {
                    recipientUuids: strArray(raw, "recipientUuids"),
                }),
            };
        case "SET_DISMISSED":
            return {
                type: raw.type,
                ...base,
                itemId: str(raw, "itemId"),
                eventIds: strArray(raw, "eventIds"),
                dismissed: bool(raw, "dismissed"),
            };
        case "SET_NOTE":
            return {
                type: raw.type,
                ...base,
                itemId: str(raw, "itemId"),
                eventId: str(raw, "eventId"),
                note: optStr(raw, "note"),
            };
        case "SET_STATE": {
            const locked = optBool(raw, "locked");
            const completed = optBool(raw, "completed");
            return {
                type: raw.type,
                ...base,
                itemId: str(raw, "itemId"),
                ...(locked !== undefined && { locked }),
                ...(completed !== undefined && { completed }),
                note: optStr(raw, "note"),
            };
        }
        case "CREATE_ITEM":
            return { type: raw.type, ...base, data: raw.data };
        case "UPDATE_ITEM":
            if (!isRecord(raw.changes)) invalid("changes must be an object");
            return {
                type: raw.type,
                ...base,
                itemId: str(raw, "itemId"),
                changes: raw.changes,
            };
        case "REORDER_ITEMS":
            return { type: raw.type, ...base, order: strArray(raw, "order") };
        case "SET_CATEGORIES":
            if (!Array.isArray(raw.categories))
                invalid("categories must be a list");
            return {
                type: raw.type,
                ...base,
                categories: raw.categories as CategoryData[],
            };
        case "MOVE_METHOD":
            return {
                type: raw.type,
                ...base,
                itemId: str(raw, "itemId"),
                methodId: str(raw, "methodId"),
                dest: store(raw.dest),
                destItemId: str(raw, "destItemId"),
                index: num(raw, "index"),
                copy: bool(raw, "copy"),
            };
        case "IMPORT_ITEMS":
            if (!Array.isArray(raw.items) || !Array.isArray(raw.categories))
                invalid("items and categories must be lists");
            return {
                type: raw.type,
                ...base,
                items: raw.items,
                categories: raw.categories,
            };
        case "TRANSFER":
            if (raw.mode !== "MOVE" && raw.mode !== "COPY")
                invalid("mode must be MOVE or COPY");
            return {
                type: raw.type,
                ...base,
                dest: store(raw.dest),
                mode: raw.mode,
                itemIds: strArray(raw, "itemIds"),
                choices: transferChoices(raw.choices),
            };
        default:
            return invalid(`Unknown command type ${JSON.stringify(raw.type)}`);
    }
}

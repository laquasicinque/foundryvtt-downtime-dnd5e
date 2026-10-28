/** What the GM sends back for a command. */
import type { Id, ItemLocation } from "../data";
import type { LocalizedText } from "../i18n";

export type CommandErrorCode =
    | "INVALID"
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "LOCKED"
    | "UNAVAILABLE"
    | "BLOCKED"
    | "NO_GM"
    | "FAILED";

export interface CommandSuccess {
    ok: true;
    /** Items written by this command (including chained effects). */
    changed: ItemLocation[];
    /** Events appended to the command's own item. */
    eventIds: Id[];
    /** CREATE_ITEM: the new item's id. */
    itemId?: Id;
    /** TRANSFER: source id → destination id of every transferred item. IMPORT_ITEMS: the renamed ones. */
    transferred?: Record<Id, Id>;
    /** IMPORT_ITEMS: how many items were added. */
    imported?: number;
}

export interface CommandFailure {
    ok: false;
    /** `message` is localized by whoever shows it (a key, or text that's already final). */
    error: {
        code: CommandErrorCode;
        message: LocalizedText | string;
        details?: unknown;
    };
}

export type CommandResult = CommandSuccess | CommandFailure;

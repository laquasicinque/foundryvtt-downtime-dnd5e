import type { CommandErrorCode } from "../../types/commands";
import type { LocalizedText } from "../../types/i18n";
import { localized } from "../../lib/text";

export { localized };

/**
 * A command the GM refused (or that failed), with a machine-readable code.
 * The text is a key, so the player who sent the command reads it in their
 * own language; a plain string is text that's already final (a GM-written hint).
 */
export class CommandError extends Error {
    readonly code: CommandErrorCode;
    readonly text: LocalizedText | string;
    readonly details: unknown;

    constructor(
        code: CommandErrorCode,
        text: LocalizedText | string,
        details?: unknown,
    ) {
        super(typeof text === "string" ? text : text.key);
        this.name = "CommandError";
        this.code = code;
        this.text = text;
        this.details = details;
    }
}

/** The text to keep for a caught error: a CommandError's own, or the unexpected error's message. */
export function errorText(error: unknown): LocalizedText | string {
    if (error instanceof CommandError) return error.text;
    return localized("downtime-dnd5e.Error.Unexpected", {
        message: error instanceof Error ? error.message : String(error),
    });
}

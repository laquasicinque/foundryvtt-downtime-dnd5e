import type { CommandErrorCode } from "../types/commands";

/** Thrown by write methods when the GM rejects a command. */
export class DowntimeError extends Error {
    readonly code: CommandErrorCode;
    readonly details: unknown;

    constructor(code: CommandErrorCode, message: string, details?: unknown) {
        super(message);
        this.name = "DowntimeError";
        this.code = code;
        this.details = details;
    }
}

/** Chat messages, and what code outside the compat layer can read from one. */
import { type Actor, actorDocument } from "./actors";
import { coreSetting } from "./settings";

type MessageDocument = Foundry.latest.ChatMessage;

declare const brand: unique symbol;

/**
 * A chat message as code outside the compat layer sees it. At runtime it's
 * the message document itself; anything beyond its id goes through the
 * layer's functions.
 */
export interface ChatMessage {
    readonly id: string;
    readonly [brand]: "ChatMessage";
}

/** The document behind a `ChatMessage`. Compat layer only. */
export function messageDocument(message: ChatMessage): MessageDocument {
    return message as unknown as MessageDocument;
}

/** A message document as a `ChatMessage`. Compat layer only. */
export function asChatMessage(document: MessageDocument): ChatMessage {
    return document as unknown as ChatMessage;
}

export interface ChatMessageInput {
    content: string;
    /** User ids. */
    whisper?: string[];
    speaker?: unknown;
}

export function createChatMessage(
    data: ChatMessageInput | Record<string, unknown>,
): Promise<unknown> {
    return ChatMessage.create(data);
}

export function chatMessageById(id: string): ChatMessage | null {
    const message = game.messages.get(id);
    return message ? asChatMessage(message) : null;
}

/** The message's flags in `scope`. */
export function messageFlags(
    message: ChatMessage,
    scope: string,
): Record<string, unknown> | undefined {
    const flags = messageDocument(message).flags as Record<string, unknown>;
    return flags[scope] as Record<string, unknown> | undefined;
}

/** The current message mode. Foundry v14 moved it to `core.messageMode`; fall back to the old setting. */
export function defaultMessageMode(): string {
    for (const key of ["messageMode", "rollMode"]) {
        const mode = coreSetting(key);
        if (typeof mode === "string" && mode) return mode;
    }
    return "public";
}

/** Apply a message mode's whisper/blind settings to message data. */
export function applyMessageMode(data: object, mode: string): void {
    ChatMessage.applyMode(data, mode);
}

/** Chat speaker data for an actor, or for the current user. */
export function speakerFor(actor: Actor | null): unknown {
    return actor
        ? ChatMessage.getSpeaker({ actor: actorDocument(actor) })
        : ChatMessage.getSpeaker();
}

/** Ids of the GM users (whisper recipients). */
export function gmUserIds(): string[] {
    return ChatMessage.getWhisperRecipients("GM").map((user) => user.id!);
}

/** The sound to play with a message carrying dice rolls. */
export function diceSound(): string {
    return CONFIG.sounds.dice;
}

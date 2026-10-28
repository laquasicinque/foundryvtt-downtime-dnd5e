/**
 * The Foundry and dnd5e globals, typed by our own declarations
 * (types/foundry, types/dnd5e). Only the compat layer may use them: the
 * `no-restricted-globals` lint rule enforces that.
 */
declare const game: Foundry.latest.Game;
declare const ui: Foundry.latest.UI;
declare const CONFIG: Foundry.latest.Config & Dnd5e.latest.Config;
declare const CONST: Foundry.latest.Const;
declare const Hooks: Foundry.latest.Hooks;
declare const foundry: Foundry.latest.Namespace;
declare const ChatMessage: Foundry.latest.ChatMessageClass;
declare const dnd5e: Dnd5e.latest.Namespace;

/** Resolve a uuid, loading it from its compendium if needed. */
declare function fromUuid(
    uuid: string,
): Promise<Foundry.latest.Document | null>;

/**
 * Resolve a uuid from memory only: an unloaded compendium document gives its
 * index entry; embedded documents in a compendium throw.
 */
declare function fromUuidSync(
    uuid: string,
): Foundry.latest.Document | Foundry.latest.IndexEntry | null;

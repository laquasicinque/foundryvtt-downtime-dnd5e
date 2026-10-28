/**
 * Every hook this module calls or listens to, with the arguments it reads.
 * Used by the wrappers in `foundry/hooks`. Arguments that reach code outside
 * the compat layer use the layer's neutral types (`ChatMessage`,
 * `ActorSheet`, …); document hooks pass the document as `unknown`, for the
 * layer's `touchesActor`/`touchesJournal`.
 */
declare namespace Downtime {
    /** Document create/update/delete hooks; only the document is read. */
    type DocumentHook = (document: unknown, ...rest: unknown[]) => void;

    interface HookConfig {
        init: () => void;
        setup: () => void;
        ready: () => void | Promise<void>;
        renderJournalDirectory: (app: unknown, html: HTMLElement) => void;
        renderChatMessageHTML: (
            message: import("../foundry/chat").ChatMessage,
            html: HTMLElement,
        ) => void;
        /** Fires for every actor sheet, not only dnd5e's. */
        closeActorSheetV2: (sheet: object) => void;

        updateActor: DocumentHook;
        updateActorDelta: DocumentHook;
        updateToken: DocumentHook;
        createItem: DocumentHook;
        updateItem: DocumentHook;
        deleteItem: DocumentHook;
        createActiveEffect: DocumentHook;
        updateActiveEffect: DocumentHook;
        deleteActiveEffect: DocumentHook;
        createJournalEntry: DocumentHook;
        updateJournalEntry: DocumentHook;
        deleteJournalEntry: DocumentHook;
        createJournalEntryPage: DocumentHook;
        updateJournalEntryPage: DocumentHook;
        deleteJournalEntryPage: DocumentHook;

        renderCharacterActorSheet: SheetRenderHook;
        renderNPCActorSheet: SheetRenderHook;

        "tidy5e-sheet.ready": (api: Tidy5e.Api) => void;
        /** dnd5e BasicRoll.buildConfigure; `message` is dnd5e's own (mutable) message config. */
        "dnd5e.postRollConfiguration": (
            rolls: unknown[],
            config: unknown,
            dialog: unknown,
            message: import("./rolls").RollMessageConfig,
        ) => void;

        /** Fired on the client that used a method, with the updated item and the METHOD event it recorded. */
        "downtime-dnd5e.methodUsed": (
            item: TrackedItem,
            event: HistoryEvent,
        ) => void;
        /** Fired once on ready so other modules can register activity adapters. */
        "downtime-dnd5e.registerActivityAdapters": (
            registry: typeof import("../dnd5e/activityAdapters").activityAdapters,
        ) => void;
    }
}

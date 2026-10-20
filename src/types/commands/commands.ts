/** Commands: every write to downtime data. Clients send these to the active GM, who validates and applies them. They must be JSON-safe. */
import type {
    CategoryData,
    Id,
    RollSummary,
    StoreRef,
    TrackedItemData,
} from "../data";
import type { TransferChoices, TransferMode } from "../transfer";

/** A roll made on the player's client. The GM resolves bands and deltas from it. */
export interface ClientRoll {
    formula: string;
    total: number;
    natural: number | null;
    /** DC of the rolled activity, if any; used only when the method has none. */
    activityDc: number | null;
    rolled: RollSummary["rolled"];
    rollMode: string;
    messageId: string | null;
}

/** A MACRO method's macro returned an amount. */
export interface MacroDeltaResult {
    delta: number;
}

/** A MACRO method's macro returned a roll, resolved against the method's results. */
export interface MacroRollResult {
    roll: ClientRoll;
}

export type MacroMethodResult = MacroDeltaResult | MacroRollResult;

/** Editable item fields: everything except identity, history and quarantine. */
export type ItemChanges = Partial<
    Omit<TrackedItemData, "id" | "schemaVersion" | "history" | "quarantine">
>;

/** Use a method with an already-made roll / amount / macro result. */
export interface UseMethodCommand {
    type: "USE_METHOD";
    store: StoreRef;
    itemId: Id;
    methodId: Id;
    /** Acting actor. Forced to the store's actor for actor stores. */
    actorUuid: string | null;
    /** Check methods. */
    roll?: ClientRoll | null;
    /** MANUAL methods. */
    amount?: number | null;
    /** MACRO methods (the macro runs on the client). */
    macroResult?: MacroMethodResult | null;
    /** MACRO requirement results from the client, keyed by requirement id. */
    macroRequirements?: Record<Id, boolean>;
}

/** GM: change progress by `delta`. */
export interface AdjustCommand {
    type: "ADJUST";
    store: StoreRef;
    itemId: Id;
    delta: number;
    actorUuid?: string | null;
    note?: string | null;
}

/** GM (or the owner, for reason API): set progress to `value`. */
export interface SetCommand {
    type: "SET";
    store: StoreRef;
    itemId: Id;
    value: number;
    reason?: "MANUAL" | "API";
    note?: string | null;
}

/** GM: revert the latest progress change and what it caused. */
export interface RevertLatestCommand {
    type: "REVERT_LATEST";
    store: StoreRef;
    itemId: Id;
}

/** GM: approve or reject a milestone action waiting for approval. */
export interface ResolveApprovalCommand {
    type: "RESOLVE_APPROVAL";
    store: StoreRef;
    itemId: Id;
    milestoneEventId: Id;
    actionId: Id;
    approved: boolean;
    /** For GM_PICKS recipients: the actors chosen by the GM. */
    recipientUuids?: string[];
}

/** GM: mark history entries as reviewed (or not). */
export interface SetDismissedCommand {
    type: "SET_DISMISSED";
    store: StoreRef;
    itemId: Id;
    eventIds: Id[];
    dismissed: boolean;
}

/** GM: set or clear a history entry's note. */
export interface SetNoteCommand {
    type: "SET_NOTE";
    store: StoreRef;
    itemId: Id;
    eventId: Id;
    note: string | null;
}

/** GM: lock / unlock, or mark complete / incomplete. */
export interface SetStateCommand {
    type: "SET_STATE";
    store: StoreRef;
    itemId: Id;
    locked?: boolean;
    completed?: boolean;
    note?: string | null;
}

/** GM: create a tracked item from (partial) data. */
export interface CreateItemCommand {
    type: "CREATE_ITEM";
    store: StoreRef;
    data: unknown;
}

/** GM: change an item's configuration. */
export interface UpdateItemCommand {
    type: "UPDATE_ITEM";
    store: StoreRef;
    itemId: Id;
    changes: ItemChanges;
}

/** GM: delete an item and its history. */
export interface DeleteItemCommand {
    type: "DELETE_ITEM";
    store: StoreRef;
    itemId: Id;
}

/** GM: set a store's item order. */
export interface ReorderItemsCommand {
    type: "REORDER_ITEMS";
    store: StoreRef;
    order: Id[];
}

/** GM: replace a store's categories. */
export interface SetCategoriesCommand {
    type: "SET_CATEGORIES";
    store: StoreRef;
    categories: CategoryData[];
}

/** GM: move or copy a method to a position in an item (the same one, or another in any store). */
export interface MoveMethodCommand {
    type: "MOVE_METHOD";
    store: StoreRef;
    itemId: Id;
    methodId: Id;
    dest: StoreRef;
    destItemId: Id;
    index: number;
    copy: boolean;
}

/**
 * GM: add imported items (already converted to V3 by the client).
 * The GM re-parses them; quarantined parts are kept.
 */
export interface ImportItemsCommand {
    type: "IMPORT_ITEMS";
    store: StoreRef;
    items: unknown[];
    categories: unknown[];
}

/** GM: move or copy items from `store` to `dest`. The GM re-plans from current data. */
export interface TransferCommand {
    type: "TRANSFER";
    store: StoreRef;
    dest: StoreRef;
    mode: TransferMode;
    itemIds: Id[];
    choices: TransferChoices;
}

export type Command =
    | UseMethodCommand
    | AdjustCommand
    | SetCommand
    | RevertLatestCommand
    | ResolveApprovalCommand
    | SetDismissedCommand
    | SetNoteCommand
    | SetStateCommand
    | CreateItemCommand
    | UpdateItemCommand
    | DeleteItemCommand
    | ReorderItemsCommand
    | SetCategoriesCommand
    | MoveMethodCommand
    | ImportItemsCommand
    | TransferCommand;

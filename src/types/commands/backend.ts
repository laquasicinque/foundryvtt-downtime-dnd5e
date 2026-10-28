/** Where commands read and write stores (Foundry documents at runtime, memory in tests). */
import type { LocalizedText } from "../i18n";
import type { CategoryData, Id, StoreRef, TrackedItemData } from "../data";

export interface StoreSnapshot {
    items: TrackedItemData[];
    categories: CategoryData[];
    order: Id[];
    /** Why the store can't be written (e.g. a locked compendium), if it can't. */
    readOnly?: LocalizedText;
}

export interface StoreCommit {
    items: { before: TrackedItemData | null; after: TrackedItemData | null }[];
    /** null = unchanged. */
    order: Id[] | null;
    /** null = unchanged. */
    categories: CategoryData[] | null;
}

export interface StoreBackend {
    /** null when the store doesn't exist (e.g. the actor was deleted). */
    load(store: StoreRef): Promise<StoreSnapshot | null>;
    commit(store: StoreRef, commit: StoreCommit): Promise<void>;
}

/** A store loaded into a unit of work: its items as loaded and as changed so far. */
export interface LoadedStore {
    ref: StoreRef;
    original: Map<Id, TrackedItemData>;
    items: Map<Id, TrackedItemData | null>;
    order: Id[];
    categories: CategoryData[];
    readOnly: LocalizedText | null;
    orderChanged: boolean;
    categoriesChanged: boolean;
}

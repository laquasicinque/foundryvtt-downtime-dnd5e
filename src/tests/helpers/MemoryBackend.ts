import type {
    StoreBackend,
    StoreCommit,
    StoreSnapshot,
} from "../../types/commands";
import type { StoreRef, TrackedItemData } from "../../types/data";
import { storeKey } from "../../model/storage/stores";

/** In-memory store backend that records every commit. */
export class MemoryBackend implements StoreBackend {
    readonly stores = new Map<string, StoreSnapshot>();
    readonly commits: { store: StoreRef; commit: StoreCommit }[] = [];

    seed(
        store: StoreRef,
        items: TrackedItemData[],
        extra: Partial<StoreSnapshot> = {},
    ) {
        this.stores.set(storeKey(store), {
            items,
            categories: [],
            order: items.map((i) => i.id),
            ...extra,
        });
        return this;
    }

    async load(store: StoreRef) {
        const snapshot = this.stores.get(storeKey(store));
        return snapshot ? structuredClone(snapshot) : null;
    }

    async commit(store: StoreRef, commit: StoreCommit) {
        this.commits.push({ store, commit: structuredClone(commit) });
        const snapshot = this.stores.get(storeKey(store)) ?? {
            items: [],
            categories: [],
            order: [],
        };
        const items = new Map(snapshot.items.map((i) => [i.id, i]));
        for (const { before, after } of commit.items) {
            if (after) items.set(after.id, structuredClone(after));
            else if (before) items.delete(before.id);
        }
        this.stores.set(storeKey(store), {
            items: [...items.values()],
            categories: commit.categories ?? snapshot.categories,
            order: commit.order ?? snapshot.order,
        });
    }

    item(store: StoreRef, id: string): TrackedItemData | undefined {
        return this.stores.get(storeKey(store))?.items.find((i) => i.id === id);
    }
}

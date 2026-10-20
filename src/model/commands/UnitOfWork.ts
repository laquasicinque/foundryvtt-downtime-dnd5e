import { nextSeq } from "../rules/derive";
import type {
    CategoryData,
    Contributor,
    EventBaseData,
    HistoryEventData,
    Id,
    ItemLocation,
    StoreRef,
    TrackedItemData,
} from "../../types/data";
import { storeKey } from "../storage/stores";
import { CommandError, localized } from "./CommandError";
import type { LoadedStore, StoreBackend } from "../../types/commands";

/**
 * Loads stores lazily, collects every change made by one command (including
 * chained effects on other items/stores), and commits them together.
 * Items are immutable: every change replaces the item object.
 */
export class UnitOfWork {
    readonly #stores = new Map<string, LoadedStore>();
    private readonly backend: StoreBackend;

    constructor(backend: StoreBackend) {
        this.backend = backend;
    }

    async store(ref: StoreRef): Promise<LoadedStore> {
        const key = storeKey(ref);
        const cached = this.#stores.get(key);
        if (cached) return cached;
        const snapshot = await this.backend.load(ref);
        if (!snapshot)
            throw new CommandError(
                "NOT_FOUND",
                localized("downtime-dnd5e.Error.StoreNotFound", { store: key }),
            );
        const loaded: LoadedStore = {
            ref,
            original: new Map(snapshot.items.map((item) => [item.id, item])),
            items: new Map(snapshot.items.map((item) => [item.id, item])),
            order: [...snapshot.order],
            categories: [...snapshot.categories],
            readOnly: snapshot.readOnly ?? null,
            orderChanged: false,
            categoriesChanged: false,
        };
        this.#stores.set(key, loaded);
        return loaded;
    }

    async items(ref: StoreRef): Promise<TrackedItemData[]> {
        const store = await this.store(ref);
        return [...store.items.values()].filter(
            (item): item is TrackedItemData => item !== null,
        );
    }

    /** Like `items`, but a missing store is an empty list rather than an error. */
    async itemsIfExists(ref: StoreRef): Promise<TrackedItemData[] | null> {
        try {
            return await this.items(ref);
        } catch (error) {
            if (error instanceof CommandError && error.code === "NOT_FOUND")
                return null;
            throw error;
        }
    }

    async find(location: ItemLocation): Promise<TrackedItemData | null> {
        try {
            const store = await this.store(location.store);
            return store.items.get(location.itemId) ?? null;
        } catch {
            return null;
        }
    }

    async get(location: ItemLocation): Promise<TrackedItemData> {
        const item = await this.find(location);
        if (!item)
            throw new CommandError(
                "NOT_FOUND",
                localized("downtime-dnd5e.Error.ItemNotFound", {
                    id: location.itemId,
                }),
            );
        return item;
    }

    /** A store about to be changed: refused before anything else happens if it's read-only. */
    private async writable(ref: StoreRef): Promise<LoadedStore> {
        const store = await this.store(ref);
        if (store.readOnly) throw new CommandError("LOCKED", store.readOnly);
        return store;
    }

    async put(ref: StoreRef, item: TrackedItemData): Promise<void> {
        const store = await this.writable(ref);
        const isNew = !store.items.get(item.id);
        store.items.set(item.id, item);
        if (isNew && !store.order.includes(item.id)) {
            store.order.push(item.id);
            store.orderChanged = true;
        }
    }

    async remove(location: ItemLocation): Promise<void> {
        const store = await this.writable(location.store);
        store.items.set(location.itemId, null);
        const index = store.order.indexOf(location.itemId);
        if (index >= 0) {
            store.order.splice(index, 1);
            store.orderChanged = true;
        }
    }

    async setOrder(ref: StoreRef, order: Id[]): Promise<void> {
        const store = await this.writable(ref);
        store.order = [...order];
        store.orderChanged = true;
    }

    async setCategories(
        ref: StoreRef,
        categories: CategoryData[],
    ): Promise<void> {
        const store = await this.writable(ref);
        store.categories = [...categories];
        store.categoriesChanged = true;
    }

    async categories(ref: StoreRef): Promise<CategoryData[]> {
        return (await this.store(ref)).categories;
    }

    /** Append an event, assigning the next seq. Returns the stored event. */
    async append<E extends HistoryEventData>(
        location: ItemLocation,
        event: Omit<E, "seq">,
    ): Promise<E> {
        const item = await this.get(location);
        const stored = { ...event, seq: nextSeq(item) } as E;
        await this.put(location.store, {
            ...item,
            history: [...item.history, stored],
        });
        return stored;
    }

    /** Items changed so far, for the command result. */
    changed(): ItemLocation[] {
        const changed: ItemLocation[] = [];
        for (const store of this.#stores.values()) {
            for (const [itemId, item] of store.items) {
                if (item !== (store.original.get(itemId) ?? null))
                    changed.push({ store: store.ref, itemId });
            }
        }
        return changed;
    }

    async commit(): Promise<void> {
        for (const store of this.#stores.values()) {
            const items: {
                before: TrackedItemData | null;
                after: TrackedItemData | null;
            }[] = [];
            for (const [itemId, item] of store.items) {
                const before = store.original.get(itemId) ?? null;
                if (item !== before) items.push({ before, after: item });
            }
            if (
                items.length === 0 &&
                !store.orderChanged &&
                !store.categoriesChanged
            )
                continue;
            await this.backend.commit(store.ref, {
                items,
                order: store.orderChanged ? store.order : null,
                categories: store.categoriesChanged ? store.categories : null,
            });
        }
    }
}

export function eventBase(
    id: Id,
    timestamp: number,
    contributor: Contributor,
    note: string | null = null,
): Omit<EventBaseData, "seq"> {
    return { id, timestamp, contributor, dismissed: false, note };
}

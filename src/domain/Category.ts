import type { CategoryData, Id, StoreRef } from "../types/data";
import { deepFreeze } from "./context";

/** A category in a store. Read-only; edit via the API's setCategories. */
export class Category {
    readonly data: Readonly<CategoryData>;
    readonly store: StoreRef;

    constructor(data: CategoryData, store: StoreRef) {
        this.data = deepFreeze(structuredClone(data));
        this.store = store;
    }

    get id(): Id {
        return this.data.id;
    }
    get name(): string {
        return this.data.name;
    }
    get description(): string {
        return this.data.description;
    }

    toJSON(): CategoryData {
        return structuredClone(this.data) as CategoryData;
    }
}

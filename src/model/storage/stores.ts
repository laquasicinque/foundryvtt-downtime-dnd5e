import type { StoreRef, WorldStoreRef } from "../../types/data";

/** The world's store. */
export const WORLD_STORE: WorldStoreRef = Object.freeze({ kind: "WORLD" });

/** A stable key per store, e.g. for maps and cache entries. */
export function storeKey(store: StoreRef): string {
    return store.kind === "WORLD" ? "world" : `actor:${store.actorUuid}`;
}

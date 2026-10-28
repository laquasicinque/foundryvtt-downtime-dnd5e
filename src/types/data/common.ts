/** Shared basics: ids, store references and item locations. */
export type Id = string;

/** A character's (or NPC's, or unlinked token's) own tracked items. */
export interface ActorStoreRef {
    kind: "ACTOR";
    actorUuid: string;
}

/** The world's shared tracked items. */
export interface WorldStoreRef {
    kind: "WORLD";
}

/** Where a tracked item lives. Not part of the item's data. */
export type StoreRef = ActorStoreRef | WorldStoreRef;

/**
 * dnd5e ability and skill keys ("str", "ath", …). The normaliser doesn't
 * check them; rolls do (`isAbilityKey`/`isSkillKey`), so keys a module adds
 * to CONFIG.DND5E still work.
 */
export type { AbilityKey, SkillKey } from "../../dnd5e/config";

export type CompareOp = "lt" | "lte" | "eq" | "gte" | "gt";

export interface ItemLocation {
    store: StoreRef;
    itemId: Id;
}

export type SchemaVersion = 3;

/** Generates ids (foundry.utils.randomID at runtime, counters in tests). */
export type IdGenerator = () => Id;

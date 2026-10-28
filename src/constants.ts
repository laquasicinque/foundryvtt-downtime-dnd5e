const MODULE_ID: Downtime.MODULE_ID = "downtime-dnd5e";

export const CONSTANTS = {
    MODULE_ID,
    PATH: `modules/${MODULE_ID}/`,
    FLAGS: {
        /** V1 actor data: migrated once, then left untouched as the backup. */
        trainingItems: "trainingItems",
        categories: "categories",
        /** V3 actor store (StoredActorCollection). */
        store: "store",
        /**
         * V3 store of an unlinked token actor, in its ActorDelta. Separate from `store`
         * because Foundry deep-merges delta flags over the base actor's, so a token's
         * `store` would merge with (not replace) its base actor's items.
         */
        tokenStore: "tokenStore",
        /** V3 world store: marks the module's journal entry; holds StoredWorldCollection. */
        worldStore: "worldStore",
        /** V3 world store: the tracked item on a journal page. */
        item: "item",
    },
    SETTINGS: {
        worldActivities: "activities",
        worldCategories: "categories",
        worldJournalId: "worldJournalId",
        milestoneApprovalDefault: "milestoneApprovalDefault",
    },
    QUERIES: {
        command: "downtime-dnd5e.command",
    },
} as const;

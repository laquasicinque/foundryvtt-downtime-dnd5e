/** The command executor's view of actors (ActorLookup), backed by Foundry. */
import { actorRollData, actorView } from "../dnd5e/actors";
import { actorFromUuid, isOwnedBy } from "../foundry/actors";
import type { ActorLookup } from "../types/commands";

export const foundryActors: ActorLookup = {
    exists: async (uuid) => (await actorFromUuid(uuid)) !== null,
    name: async (uuid) => (await actorFromUuid(uuid))?.name ?? null,
    isOwner: async (uuid, userId) => {
        const actor = await actorFromUuid(uuid);
        return !!actor && isOwnedBy(actor, userId);
    },
    view: async (uuid) => {
        const actor = await actorFromUuid(uuid);
        return actor ? actorView(actor) : null;
    },
    rollData: async (uuid) => {
        const actor = await actorFromUuid(uuid);
        return actor ? actorRollData(actor) : {};
    },
};

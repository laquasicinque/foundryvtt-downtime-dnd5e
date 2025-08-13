export function getActor(actorOrId: string | dnd5e.documents.Actor5e | foundry.documents.Actor.Stored): dnd5e.documents.Actor5e {
    if (typeof actorOrId === 'string') {
        const actor = fromUuidSync(actorOrId) ?? game.actors.get(actorOrId)
        if (!actor) throw new Error(`Could not find actor when given string "${actorOrId}"`)
        return actor as dnd5e.documents.Actor5e
    }

    return actorOrId as dnd5e.documents.Actor5e
}

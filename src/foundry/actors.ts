/** Actors: lookups, and what code outside the compat layer can read from one. */

/** Every actor in a dnd5e world is an Actor5e. */
type Actor5e = Dnd5e.latest.Actor;

declare const brand: unique symbol;

/**
 * An actor as code outside the compat layer sees it. At runtime it's the
 * actor document itself; anything beyond these fields goes through the
 * layer's functions.
 */
export interface Actor {
    readonly uuid: string;
    readonly name: string;
    readonly [brand]: "Actor";
}

/** The document behind an `Actor`. Compat layer only. */
export function actorDocument(actor: Actor): Actor5e {
    return actor as unknown as Actor5e;
}

/** An actor document as an `Actor`. Compat layer only. */
export function asActor(document: Foundry.latest.Actor): Actor {
    return document as unknown as Actor;
}

const asActorOrNull = (document: Foundry.latest.Actor | null | undefined) =>
    document ? asActor(document) : null;

/** `value` as an `Actor` if it's an actor document. */
function actorOrNull(value: unknown): Actor | null {
    return value instanceof dnd5e.documents.Actor5e ? asActor(value) : null;
}

/** Resolve an actor uuid, loading it from its compendium if needed. */
export async function actorFromUuid(uuid: string): Promise<Actor | null> {
    try {
        return actorOrNull(await fromUuid(uuid));
    } catch {
        return null;
    }
}

/**
 * Resolve an actor uuid from memory only. Always finds world actors and
 * unlinked token actors; a compendium actor only while it's loaded (its sheet
 * is open, or for a few minutes after `actorFromUuid` loaded it).
 */
export function actorFromUuidSync(uuid: string): Actor | null {
    try {
        return actorOrNull(fromUuidSync(uuid));
    } catch {
        return null;
    }
}

export function actorById(id: string): Actor | null {
    return asActorOrNull(game.actors.get(id));
}

export function actorByName(name: string): Actor | null {
    return asActorOrNull(game.actors.getName(name));
}

/** An actor by uuid, then id, then name. */
export async function findActor(key: string): Promise<Actor | null> {
    return (await actorFromUuid(key)) ?? actorById(key) ?? actorByName(key);
}

/** `findActor` from memory only (see `actorFromUuidSync`). */
export function findActorSync(key: string): Actor | null {
    return actorFromUuidSync(key) ?? actorById(key) ?? actorByName(key);
}

export function isActor(value: unknown): value is Actor {
    return value instanceof foundry.documents.Actor;
}

/** Every world actor (not unlinked token actors). */
export function worldActors(): Actor[] {
    return [...game.actors].map(asActor);
}

/** An unlinked token's actor (its data is the base actor's plus the token's delta). */
export function isTokenActor(actor: Actor): boolean {
    return actorDocument(actor).isToken;
}

/** For an unlinked token actor, the world actor it's based on. */
export function baseActor(actor: Actor): Actor | null {
    const doc = actorDocument(actor);
    return doc.isToken ? actorById(doc.id!) : actor;
}

/** The actor's flags in `scope`. For a token actor, the base actor's merged with the token's own. */
export function actorFlags(
    actor: Actor,
    scope: string,
): Record<string, unknown> | undefined {
    const flags = actorDocument(actor).flags as Record<string, unknown>;
    return flags[scope] as Record<string, unknown> | undefined;
}

/** The flags in `scope` the actor holds itself: for a token actor, only its delta's. */
export function ownActorFlags(
    actor: Actor,
    scope: string,
): Record<string, unknown> | undefined {
    const doc = actorDocument(actor);
    const flags = (doc.isToken ? doc.token?.delta?.flags : doc.flags) as
        | Record<string, unknown>
        | undefined;
    return flags?.[scope] as Record<string, unknown> | undefined;
}

/** Owned by a player (not only GMs). */
export function hasPlayerOwner(actor: Actor): boolean {
    return actorDocument(actor).hasPlayerOwner;
}

/** This client's user owns the actor. */
export function isOwnedByCurrentUser(actor: Actor): boolean {
    return actorDocument(actor).isOwner;
}

export function isOwnedBy(actor: Actor, userId: string): boolean {
    const user = game.users.get(userId);
    return !!user && actorDocument(actor).testUserPermission(user, "OWNER");
}

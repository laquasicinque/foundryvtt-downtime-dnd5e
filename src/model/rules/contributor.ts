import type { Contributor } from "../../types/data";

/**
 * Stable grouping key for a contributor: actor first, then user, then name.
 * Used for usage counting (per: ACTOR) and contribution breakdowns.
 */
export function contributorKey(contributor: Contributor): string {
    if (contributor.actorUuid) return `actor:${contributor.actorUuid}`;
    return userKey(contributor);
}

/** Grouping key ignoring the actor (per: USER). */
export function userKey(contributor: Contributor): string {
    if (contributor.userId) return `user:${contributor.userId}`;
    const name = contributor.userName ?? contributor.actorName;
    return name ? `name:${name}` : "unknown";
}

/** Live lookups, injected so this stays pure. Return null/undefined when not found. */
export interface NameLookup {
    actorName(uuid: string): string | null | undefined;
    userName(id: string): string | null | undefined;
    /** Shown when neither is known. */
    unknown(): string;
}

function resolveActorName(c: Contributor, lookup: NameLookup): string | null {
    return (
        (c.actorUuid && lookup.actorName(c.actorUuid)) || c.actorName || null
    );
}

function resolveUserName(c: Contributor, lookup: NameLookup): string | null {
    return (c.userId && lookup.userName(c.userId)) || c.userName || null;
}

/**
 * Display rule:
 *   actor name from id → stored actor name → user name from id → stored user name → unknown.
 * GM events show the user first with the actor in brackets: `Gamemaster (Thorin)`.
 */
export function contributorDisplayName(
    contributor: Contributor,
    lookup: NameLookup,
): string {
    const actor = resolveActorName(contributor, lookup);
    const user = resolveUserName(contributor, lookup);

    if (contributor.userWasGM && user) {
        return actor ? `${user} (${actor})` : user;
    }
    return actor ?? user ?? lookup.unknown();
}

/** Whether this contributor counts as "the viewer" for player-filtered history. */
export function isOwnContribution(
    contributor: Contributor,
    viewer: { userId: string; ownedActorUuids: ReadonlySet<string> },
): boolean {
    if (contributor.userId === viewer.userId) return true;
    return (
        contributor.actorUuid !== null &&
        viewer.ownedActorUuids.has(contributor.actorUuid)
    );
}

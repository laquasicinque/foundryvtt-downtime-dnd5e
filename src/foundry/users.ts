/** Users: who this client is, lookups, and what code outside the compat layer can read from one. */

type UserDocument = Foundry.latest.User;

declare const brand: unique symbol;

/**
 * A user as code outside the compat layer sees it. At runtime it's the user
 * document itself; anything beyond these fields goes through the layer's
 * functions.
 */
export interface User {
    readonly id: string;
    readonly name: string;
    readonly isGM: boolean;
    readonly [brand]: "User";
}

/** The document behind a `User`. Compat layer only. */
export function userDocument(user: User): UserDocument {
    return user as unknown as UserDocument;
}

/** A user document as a `User`. Compat layer only. */
export function asUser(document: UserDocument): User {
    return document as unknown as User;
}

/** This client's user (for APIs that take a User). */
export function currentUser(): User {
    return asUser(game.user);
}

export function currentUserId(): string {
    return game.user.id!;
}

export function currentUserName(): string {
    return game.user.name ?? "";
}

export function isGM(): boolean {
    return game.user.isGM;
}

/** This client is the active GM (the one that runs commands). */
export function isActiveGM(): boolean {
    return game.user.isActiveGM;
}

/** The active GM user, if one is connected. */
export function activeGM(): User | null {
    const gm = game.users.activeGM;
    return gm ? asUser(gm) : null;
}

export function userName(id: string): string | null {
    return game.users.get(id)?.name ?? null;
}

/** Whether the user with this id (or, failing that, this name) is a GM. */
export function isGMUser(id: string | null, name?: string | null): boolean {
    if (id) return !!game.users.get(id)?.isGM;
    return !!name && !!game.users.getName(name)?.isGM;
}

export function userById(id: string): User | null {
    const user = game.users.get(id);
    return user ? asUser(user) : null;
}

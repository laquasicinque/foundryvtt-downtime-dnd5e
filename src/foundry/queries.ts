/**
 * Queries (`CONFIG.queries`): ask another user's client to run a handler and
 * reply. The sender comes from Foundry's query context, not the payload.
 */

import { asUser, type User, userDocument } from "./users";

export type QueryHandler = (data: unknown, sender: User) => Promise<unknown>;

export function registerQuery(name: string, handler: QueryHandler): void {
    CONFIG.queries[name] = (
        data: unknown,
        { user }: { user: Foundry.latest.User },
    ) => handler(data, asUser(user));
}

export function sendQuery<T>(
    user: User,
    name: string,
    data: unknown,
    timeoutMs: number,
): Promise<T> {
    return userDocument(user).query(name, data, {
        timeout: timeoutMs,
    }) as Promise<T>;
}

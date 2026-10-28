/** What the module reads from an actor, as plain data. */

/**
 * A plain snapshot of the acting actor, built from an Actor5e at runtime so the
 * evaluation stays pure and testable.
 */
export interface ActorView {
    /** Proficiency multiplier: 0 none, 0.5 half, 1 proficient, 2 expertise. */
    skills: Record<string, { proficiency: number; total: number }>;
    abilities: Record<string, { score: number; mod: number }>;
    /** Tool keys the actor is proficient in (proficiency >= 1). */
    toolProficiencies: ReadonlySet<string>;
    items: readonly ActorItemView[];
}

export interface ActorItemView {
    name: string;
    identifier: string | null;
    sourceUuid: string | null;
    quantity: number;
}

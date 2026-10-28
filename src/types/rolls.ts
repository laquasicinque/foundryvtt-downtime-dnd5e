/** Rolls: the roll shape the module reads, dnd5e roll plumbing, and band formulas. */

/** The parts of a dnd5e D20Roll / BasicRoll we read. */
export interface RollLike {
    formula: string;
    total?: number | null;
    /** D20Roll: the d20 term; `total` is the kept face (after adv/dis, rerolls). */
    d20?: { total?: number | null } | null;
    /** BasicRoll: dice terms, to find a d20 in a formula roll. */
    dice?: readonly {
        faces?: number;
        total?: number | null;
        number?: number;
    }[];
    options?: { rollMode?: string };
    /** The chat message the roll was posted in. */
    parent?: { id?: string | null } | null;
}

/** dnd5e's message config for a roll (BasicRollMessageConfiguration); mutable during a roll. */
export interface RollMessageConfig {
    create?: boolean;
    data?: Record<string, unknown>;
    rollMode?: string;
}

export interface FormulaData {
    total: number | null;
    natural: number | null;
    dc: number | null;
    margin: number | null;
    [key: string]: unknown;
}

/**
 * Evaluates a FORMULA delta. The runtime implementation wraps Foundry's Roll;
 * tests inject a stub. Must return a finite number.
 */
export type FormulaEvaluator = (
    formula: string,
    data: FormulaData,
) => number | Promise<number>;

/** Dice: formulas and stored rolls. */

/** Evaluate a formula against roll data; NaN if it has no total. */
export async function evaluateFormula(
    formula: string,
    data: Record<string, unknown>,
): Promise<number> {
    const roll = await new foundry.dice.Roll(formula, data).evaluate();
    return roll.total ?? Number.NaN;
}

/** Render a roll stored on a message (its JSON string or data) as HTML. */
export async function renderStoredRoll(stored: unknown): Promise<string> {
    const roll =
        typeof stored === "string"
            ? foundry.dice.Roll.fromJSON(stored)
            : foundry.dice.Roll.fromData(stored as object);
    return roll.render();
}

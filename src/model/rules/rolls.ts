/**
 * Turning a dnd5e roll into the command's ClientRoll. Structural types only,
 * so this stays testable without Foundry.
 */
import type { ClientRoll } from "../../types/commands";
import type { RollSummary } from "../../types/data";
import type { RollLike } from "../../types/rolls";
import { isFiniteNumber } from "../../lib/values";

/** Kept d20 face, or null when the roll has no d20. */
export function naturalOf(roll: RollLike): number | null {
    const fromD20 = roll.d20?.total;
    if (typeof fromD20 === "number") return fromD20;
    // Formula rolls: only treat a single d20 term as "natural".
    const d20s = (roll.dice ?? []).filter((die) => die.faces === 20);
    if (d20s.length === 1 && typeof d20s[0]!.total === "number")
        return d20s[0]!.total;
    return null;
}

export function toClientRoll(
    roll: RollLike,
    rolled: RollSummary["rolled"],
    activityDc: number | null,
    defaultRollMode: string,
): ClientRoll {
    const total = roll.total;
    if (!isFiniteNumber(total)) {
        throw new Error("The roll has no total (was it evaluated?)");
    }
    return {
        formula: roll.formula,
        total,
        natural: naturalOf(roll),
        activityDc,
        rolled,
        rollMode: roll.options?.rollMode ?? defaultRollMode,
        messageId: roll.parent?.id ?? null,
    };
}

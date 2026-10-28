/** dnd5e checks, and capturing the chat message dnd5e would post for them. */
import { offHook, onHook } from "../foundry/hooks";
import type { RollLike } from "../types/rolls";
import type { RollMessageConfig } from "../types/rolls";
import { type Actor, actorDocument } from "../foundry/actors";
import type { Item } from "../foundry/items";
import { toolDocument } from "./actors";
import type { AbilityKey, SkillKey } from "./config";

type Rolls = Promise<RollLike[] | null>;

const target = (dc: number | null) => (dc === null ? {} : { target: dc });

export function rollAbilityCheck(
    actor: Actor,
    ability: AbilityKey,
    dc: number | null,
): Rolls {
    return actorDocument(actor).rollAbilityCheck({ ability, ...target(dc) });
}

export function rollSkillCheck(
    actor: Actor,
    skill: SkillKey,
    dc: number | null,
): Rolls {
    return actorDocument(actor).rollSkill({ skill, ...target(dc) });
}

/** The tool item's own check (its ability, bonus and proficiency). */
export function rollToolItemCheck(item: Item, dc: number | null): Rolls {
    return toolDocument(item).rollToolCheck(target(dc));
}

/** Resolve `@` references in a formula against roll data (missing ones become 0). */
export function replaceFormulaData(
    formula: string,
    data: Record<string, unknown>,
): string {
    return CONFIG.Dice.BasicRoll.replaceFormulaData(formula, data, {
        missing: "0",
    });
}

/**
 * Run `fn` with dnd5e's roll messages suppressed: the first roll's message
 * config is captured (with `create: false`, dnd5e prepares the message data
 * instead of posting it) so the downtime card can carry the roll instead.
 * Works for any roll that goes through dnd5e's BasicRoll.build, including
 * activity adapters from other modules.
 */
export async function captureRollMessage<T>(
    fn: () => Promise<T>,
): Promise<{ value: T; message: RollMessageConfig | null }> {
    let captured: RollMessageConfig | null = null;
    const id = onHook(
        "dnd5e.postRollConfiguration",
        (_rolls, _config, _dialog, message) => {
            if (captured) return;
            captured = message;
            message.create = false;
        },
    );
    try {
        const value = await fn();
        return { value, message: captured };
    } finally {
        offHook("dnd5e.postRollConfiguration", id);
    }
}

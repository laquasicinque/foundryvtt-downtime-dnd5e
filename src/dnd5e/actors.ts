/** What the module reads from a dnd5e actor: skills, abilities, tools and items. */
import type { ActorItemView, ActorView } from "../types/actors";
import type { Activity5e } from "../types/activities";
import { type Actor, actorDocument } from "../foundry/actors";
import { localize } from "../foundry/i18n";
import { asItem, type Item, itemDocument } from "../foundry/items";

type ToolItem = Dnd5e.latest.ToolItem;

export const isToolItem = (item: Dnd5e.latest.Item): item is ToolItem =>
    item.type === "tool";

/** The tool document behind an `Item` (from `toolItems`). Compat layer only. */
export function toolDocument(item: Item): ToolItem {
    const doc = itemDocument(item);
    if (!isToolItem(doc))
        throw new Error(
            localize("downtime-dnd5e.Use.NotATool", { item: doc.name }),
        );
    return doc;
}

/** Plain snapshot of an actor for requirement checks. */
export function actorView(actor: Actor): ActorView {
    return viewOf(actorDocument(actor));
}

function viewOf(actor: Dnd5e.latest.Actor): ActorView {
    const { system } = actor;
    const skills: ActorView["skills"] = {};
    for (const [key, skill] of Object.entries(system.skills ?? {})) {
        skills[key] = {
            proficiency: skill.value ?? 0,
            total: skill.total ?? 0,
        };
    }
    const abilities: ActorView["abilities"] = {};
    for (const [key, ability] of Object.entries(system.abilities ?? {})) {
        abilities[key] = { score: ability.value ?? 0, mod: ability.mod ?? 0 };
    }
    const toolProficiencies = new Set(
        Object.entries(system.tools ?? {})
            .filter(([, tool]) => (tool.value ?? 0) >= 1)
            .map(([key]) => key),
    );
    const items: ActorItemView[] = [...actor.items].map((item) => ({
        name: item.name,
        identifier: item.system.identifier || null,
        sourceUuid: item._stats?.compendiumSource ?? null,
        quantity:
            typeof item.system.quantity === "number" ? item.system.quantity : 1,
    }));
    return { skills, abilities, toolProficiencies, items };
}

export function actorRollData(actor: Actor): Record<string, unknown> {
    return actorDocument(actor).getRollData();
}

/** A player-owned character (not an NPC). */
export function isPlayerCharacter(actor: Actor): boolean {
    const doc = actorDocument(actor);
    return doc.hasPlayerOwner && doc.type === "character";
}

/** A character or NPC (not a vehicle or group). */
export function isCharacterOrNpc(actor: Actor): boolean {
    const { type } = actorDocument(actor);
    return type === "character" || type === "npc";
}

/** The actor's tool items of this tool type (e.g. "smith"). */
export function toolItems(actor: Actor, toolKey: string): Item[] {
    const tools: Item[] = [];
    for (const item of actorDocument(actor).items) {
        if (isToolItem(item) && item.system.type.baseItem === toolKey)
            tools.push(asItem(item));
    }
    return tools;
}

/** The tool type of one of the actor's tool items, if it is one. */
export function toolKeyOf(actor: Actor | null, itemId: string): string | null {
    const item = actor ? actorDocument(actor).items.get(itemId) : undefined;
    return item && isToolItem(item) ? item.system.type.baseItem || null : null;
}

/** A tool item's activities. */
export function toolActivities(item: Item): Activity5e[] {
    const tool = toolDocument(item);
    return [...tool.system.activities];
}

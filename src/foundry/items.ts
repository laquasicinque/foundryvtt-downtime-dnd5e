/** World and compendium Items, and what code outside the compat layer can read from one. */

import { Iter } from "it-al";

/** Every item in a dnd5e world is an Item5e. */
type ItemDocument = Dnd5e.latest.Item;

declare const brand: unique symbol;

/**
 * An item as code outside the compat layer sees it. At runtime it's the item
 * document itself; anything beyond these fields goes through the layer's
 * functions.
 */
export interface Item {
    readonly uuid: string;
    readonly name: string;
    readonly [brand]: "Item";
}

/** The document behind an `Item`. Compat layer only. */
export function itemDocument(item: Item): ItemDocument {
    return item as unknown as ItemDocument;
}

/** An item document as an `Item`. Compat layer only. */
export function asItem(document: Foundry.latest.Item): Item {
    return document as unknown as Item;
}

export function worldItemByName(name: string): Item | null {
    const item = game.items.getName(name);
    return item ? asItem(item) : null;
}

export async function createWorldItem(data: object): Promise<Item | null> {
    const item = await foundry.documents.Item.create(data);
    return item ? asItem(item) : null;
}

/** uuid of an item's first Active Effect. */
export function firstEffectUuid(item: Item): string | null {
    return itemDocument(item).effects.contents[0]?.uuid ?? null;
}

/** uuid of the first item in a compendium with one of these names. */
export async function compendiumItemUuid(
    packId: string,
    ...names: string[]
): Promise<string | null> {
    const pack = game.packs.get(packId);
    if (!pack) return null;
    const indexByName = Iter.from(await pack.getIndex()).groupBy((e) => e.name);
    for (const name of names) {
        const entry = indexByName.get(name)?.at(0);
        if (entry?.uuid) return entry.uuid;
    }
    return null;
}

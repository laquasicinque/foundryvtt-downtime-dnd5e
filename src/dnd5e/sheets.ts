/** dnd5e's actor sheets (and Tidy5e's), and what code outside the compat layer can read from one. */
import { type Actor, asActor } from "../foundry/actors";

declare const brand: unique symbol;

/** A dnd5e or Tidy5e actor sheet as code outside the compat layer sees it (at runtime, the sheet itself). */
export interface ActorSheet {
    readonly [brand]: "ActorSheet";
}

const sheetApplication = (sheet: ActorSheet) =>
    sheet as unknown as Dnd5e.latest.ActorSheet;

export interface ActorSheetClass {
    TABS: { label: string; tab: string; icon: string }[];
    PARTS: Record<string, { template: string }>;
}

/** The core character and NPC sheets (across the ActorSheet5eCharacter2 → CharacterActorSheet rename). */
export function coreActorSheets(): ActorSheetClass[] {
    const sheets = dnd5e.applications.actor as unknown as Record<
        string,
        ActorSheetClass | undefined
    >;
    return [
        sheets.CharacterActorSheet ?? sheets.ActorSheet5eCharacter2,
        sheets.NPCActorSheet ?? sheets.ActorSheet5eNPC2,
    ].filter((sheet): sheet is ActorSheetClass => !!sheet);
}

/** The actor the sheet shows. */
export function sheetActor(sheet: ActorSheet): Actor {
    return asActor(sheetApplication(sheet).actor);
}

/** The sheet is in edit mode. */
export function isSheetEditing(sheet: ActorSheet): boolean {
    return !!sheetApplication(sheet).isEditMode;
}

/** The sheet's window element, once rendered. */
export function sheetElement(sheet: ActorSheet): HTMLElement | null {
    return sheetApplication(sheet).element ?? null;
}

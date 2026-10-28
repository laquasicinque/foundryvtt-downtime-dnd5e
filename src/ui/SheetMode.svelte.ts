import { type ActorSheet, isSheetEditing, sheetElement } from "../dnd5e/sheets";

/**
 * Whether the host sheet (core dnd5e or Tidy5e) is in edit mode. Both expose
 * `isEditMode`; toggling it changes the sheet element's classes, so a
 * MutationObserver keeps this live even when the sheet doesn't re-render our
 * tab.
 */
export class SheetMode {
    editing = $state(false);
    private readonly sheet: ActorSheet | null;

    constructor(sheet: ActorSheet | null | undefined) {
        this.sheet = sheet ?? null;
    }

    #read() {
        this.editing = !!this.sheet && isSheetEditing(this.sheet);
    }

    /** Start watching; returns the stop function (use in $effect). */
    subscribe(): () => void {
        this.#read();
        const element = this.sheet ? sheetElement(this.sheet) : null;
        if (!element) return () => {};
        const observer = new MutationObserver(() => this.#read());
        observer.observe(element, {
            attributes: true,
            attributeFilter: ["class"],
        });
        return () => observer.disconnect();
    }
}

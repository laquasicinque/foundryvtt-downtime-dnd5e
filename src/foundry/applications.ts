/** Application windows and the UI helpers Foundry provides. */

/** Base class of the module's windows (see `SvelteApplication`). */
export const { ApplicationV2 } = foundry.applications.api;

interface IsRenderable {
    render(options: { force: boolean }): unknown;
    bringToFront(): unknown;
}

/** Bring the window with this id to the front, or create and render it. */
export function showApplication(id: string, create: () => IsRenderable): void {
    const existing = foundry.applications.instances.get(id);
    if (existing) {
        void existing.render({ force: true });
        existing.bringToFront();
        return;
    }
    void create().render({ force: true });
}

export interface ContextMenuEntry {
    label: string;
    /** A Font Awesome class, e.g. "fa-pen". */
    icon: string;
    onClick: () => void;
    visible?: () => boolean;
}

/** A right-click menu on `selector` within `container`. Returns a cleanup function. */
export function createContextMenu(
    container: HTMLElement,
    selector: string,
    entries: ContextMenuEntry[],
): () => void {
    const { ContextMenu } = foundry.applications.ux;
    const menu = new ContextMenu(
        container,
        selector,
        entries.map((entry) => ({
            label: entry.label,
            icon: `<i class="fas ${entry.icon}"></i>`,
            onClick: entry.onClick,
            visible: entry.visible ?? (() => true),
        })),
        { jQuery: false, fixed: true },
    );
    return () => {
        // close() throws for a menu that was never opened.
        if (menu.element) void menu.close({ animate: false });
    };
}

/** Open the image picker. */
export function pickImage(
    current: string,
    onPick: (path: string) => void,
): void {
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    void new FilePicker({
        type: "image",
        current,
        callback: onPick,
    }).render({ force: true });
}

/** The document reference carried by a Foundry drag event, if any. */
export function dragEventDocument(
    event: DragEvent,
): { type: string; uuid: string } | null {
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const data = TextEditor.getDragEventData(event) as {
        type?: string;
        uuid?: string;
    };
    return data?.uuid && data.type
        ? { type: data.type, uuid: data.uuid }
        : null;
}

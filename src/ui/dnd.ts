/**
 * Drag and drop of tracked items and methods (GM). The payload's kind is in
 * the MIME type, because `dragover` can only see the types, not the data.
 * Holding Ctrl (Cmd on macOS) while dropping copies instead of moving.
 */
import type { Id, StoreRef } from "../types/data";

export interface ItemDragPayload {
    kind: "item";
    store: StoreRef;
    itemId: Id;
}

export interface MethodDragPayload {
    kind: "method";
    store: StoreRef;
    itemId: Id;
    methodId: Id;
}

export type DragPayload = ItemDragPayload | MethodDragPayload;

const mime = (kind: DragPayload["kind"]) =>
    `application/x-downtime-dnd5e-${kind}`;

export function startDrag(event: DragEvent, payload: DragPayload) {
    if (!event.dataTransfer) return;
    event.stopPropagation();
    event.dataTransfer.setData(mime(payload.kind), JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "copyMove";
}

/** Whether the drag carries a payload of this kind (usable during dragover). */
export function isDragging(
    event: DragEvent,
    kind: DragPayload["kind"],
): boolean {
    return event.dataTransfer?.types.includes(mime(kind)) ?? false;
}

export function readDrag<K extends DragPayload["kind"]>(
    event: DragEvent,
    kind: K,
): Extract<DragPayload, { kind: K }> | null {
    const raw = event.dataTransfer?.getData(mime(kind));
    if (!raw) return null;
    try {
        return JSON.parse(raw) as Extract<DragPayload, { kind: K }>;
    } catch {
        return null;
    }
}

/** Ctrl, or Cmd on macOS: copy instead of move. */
export const wantsCopy = (event: DragEvent | MouseEvent) =>
    event.ctrlKey || event.metaKey;

/** Accept a drag of `kind` over this element (call from dragover). */
export function allowDrop(
    event: DragEvent,
    kind: DragPayload["kind"],
): boolean {
    if (!isDragging(event, kind)) return false;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer)
        event.dataTransfer.dropEffect = wantsCopy(event) ? "copy" : "move";
    return true;
}

/** Whether the pointer is in the lower half of `element` (drop after it). */
export function isLowerHalf(event: DragEvent, element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2;
}

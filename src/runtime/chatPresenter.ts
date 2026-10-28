/**
 * Chat presentation of method uses. The pipeline hands a
 * `MethodUseResult` to the active `ChatPresenter`, which produces the message
 * data and later re-renders its live parts from current data. Swap the
 * presenter (e.g. "dnd5e roll card + follow-up") without touching the pipeline.
 */
import type { TrackedItem } from "../domain/TrackedItem";
import type { Id, StoreRef } from "../types/data";

/** Stored on the message as `flags["downtime-dnd5e"].card`. */
export interface ChatCardRef {
    store: StoreRef;
    itemId: Id;
    eventId: Id;
}

export interface MethodUseResult {
    /** The item after the use. */
    item: TrackedItem;
    /** The METHOD event recorded by the use. */
    eventId: Id;
    /** Acting actor (speaker). */
    actorUuid: string | null;
    /**
     * dnd5e's prepared roll message (rolls, flavor, speaker, message mode
     * applied), when the roll went through dnd5e without posting its own.
     */
    rollMessage: Record<string, unknown> | null;
}

export interface ChatPresenter {
    /** Message data for a method use; the caller creates the message. */
    methodUseMessage(
        result: MethodUseResult,
        ref: ChatCardRef,
    ): Promise<Record<string, unknown>>;
    /**
     * Fill in the live parts of a rendered card from current data. Called on
     * every render of the message and whenever the item's store changes.
     */
    renderLive(element: HTMLElement, ref: ChatCardRef): Promise<void>;
}

let active: ChatPresenter | null = null;

export function setChatPresenter(presenter: ChatPresenter) {
    active = presenter;
}

export function chatPresenter(): ChatPresenter {
    if (!active) throw new Error("No chat presenter registered");
    return active;
}

/**
 * Chat card wiring: renders the live part of downtime cards,
 * handles their buttons, and re-renders visible cards when downtime data
 * changes.
 */
import { CONSTANTS } from "../../constants";
import {
    type ChatMessage,
    chatMessageById,
    messageFlags,
} from "../../foundry/chat";
import { onHook } from "../../foundry/hooks";
import { isGM } from "../../foundry/users";
import { getTrackedItem } from "../../runtime/api";
import { revertLatest } from "../actions";
import { resolveApproval } from "../approvals";
import { openHistory } from "../history/HistoryApp";
import { CombinedCardPresenter } from "./CombinedCardPresenter";
import {
    chatPresenter,
    setChatPresenter,
    type ChatCardRef,
} from "../../runtime/chatPresenter";

/** The card ref on a message, if it's a downtime card. */
function cardRef(message: ChatMessage | null): ChatCardRef | null {
    const ref = message
        ? (messageFlags(message, CONSTANTS.MODULE_ID)?.card as
              | ChatCardRef
              | undefined)
        : undefined;
    return ref && ref.store && ref.itemId && ref.eventId ? ref : null;
}

async function onClick(event: MouseEvent, ref: ChatCardRef) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-dt-action]",
    );
    if (!button || !isGM()) return;
    event.preventDefault();
    event.stopPropagation();
    const item = await getTrackedItem(ref.store, ref.itemId);
    if (!item) return;
    button.disabled = true;
    try {
        switch (button.dataset.dtAction) {
            case "approve":
            case "reject":
                await resolveApproval(
                    item,
                    button.dataset.milestoneEvent!,
                    button.dataset.actionId!,
                    button.dataset.dtAction === "approve",
                );
                break;
            case "revert":
                await revertLatest(item);
                break;
            case "history":
                openHistory(item);
                break;
        }
    } finally {
        button.disabled = false;
    }
}

async function renderLive(element: HTMLElement, ref: ChatCardRef) {
    try {
        await chatPresenter().renderLive(element, ref);
    } catch {
        // Leave the stored content; the card still reads as of the use.
    }
}

/** Re-render the live part of every downtime card in the DOM (chat log, popout, notifications). */
function refreshVisibleCards() {
    for (const element of document.querySelectorAll<HTMLElement>(
        ".chat-message[data-message-id]",
    )) {
        if (!element.querySelector(".downtime-dnd5e-card")) continue;
        const ref = cardRef(chatMessageById(element.dataset.messageId!));
        if (ref) void renderLive(element, ref);
    }
}

const DATA_HOOKS = [
    "updateActor",
    "updateActorDelta",
    "updateToken",
    "createJournalEntryPage",
    "updateJournalEntryPage",
    "deleteJournalEntryPage",
] as const;

/** Call from `init` (V3 only). */
export function registerChatCards() {
    setChatPresenter(new CombinedCardPresenter());

    onHook("renderChatMessageHTML", (message, html) => {
        const ref = cardRef(message);
        if (!ref || !html.querySelector(".downtime-dnd5e-card")) return;
        void renderLive(html, ref);
        html.addEventListener("click", (event) => void onClick(event, ref));
    });

    let pending: number | null = null;
    const schedule = () => {
        if (pending !== null) return;
        pending = window.setTimeout(() => {
            pending = null;
            refreshVisibleCards();
        }, 50);
    };
    for (const hook of DATA_HOOKS) onHook(hook, schedule);
}

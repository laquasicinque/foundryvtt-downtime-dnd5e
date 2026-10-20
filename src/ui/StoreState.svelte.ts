/**
 * Headless, reactive view of one store for the UI. Re-reads the
 * store whenever a relevant Foundry document changes; the stores' read cache
 * makes that cheap. Components render from `items` / `categories` / `groups`.
 */
import type { Category } from "../domain/Category";
import { touchesActor, touchesJournal } from "../foundry/documents";
import { offHook, onHook } from "../foundry/hooks";
import type { TrackedItem } from "../domain/TrackedItem";
import {
    groupByCategory,
    type CategoryGroup,
} from "../model/authoring/editing";
import type { StoreRef } from "../types/data";
import { getCategoriesSync, getTrackedItemsSync } from "../runtime/api";
import { getWorldJournal } from "../runtime/stores";

const ACTOR_HOOKS = [
    "updateActor",
    "updateActorDelta",
    "updateToken",
    // Requirements can depend on the actor's items and effects.
    "createItem",
    "updateItem",
    "deleteItem",
    "createActiveEffect",
    "updateActiveEffect",
    "deleteActiveEffect",
] as const;
const JOURNAL_HOOKS = [
    "createJournalEntry",
    "updateJournalEntry",
    "deleteJournalEntry",
    "createJournalEntryPage",
    "updateJournalEntryPage",
    "deleteJournalEntryPage",
] as const;

export class StoreState {
    readonly ref: StoreRef;
    #version = $state(0);

    // Synchronous for reactivity: the store's actor has its sheet open, so it's in memory.
    readonly items: TrackedItem[] = $derived.by(() => {
        void this.#version;
        return getTrackedItemsSync(this.ref);
    });

    readonly categories: Category[] = $derived.by(() => {
        void this.#version;
        return getCategoriesSync(this.ref);
    });

    readonly groups: CategoryGroup<TrackedItem>[] = $derived.by(() =>
        groupByCategory(
            this.items,
            this.categories.map((c) => c.data),
        ),
    );

    constructor(ref: StoreRef) {
        this.ref = ref;
    }

    refresh() {
        this.#version++;
    }

    #isRelevant(hook: string, doc: unknown): boolean {
        if (this.ref.kind === "WORLD") {
            const journal = getWorldJournal();
            if (!journal) return hook === "createJournalEntry";
            return touchesJournal(doc, journal.id);
        }
        return touchesActor(doc, this.ref.actorUuid);
    }

    /**
     * Subscribe to document hooks. `onChange` also runs on each relevant change
     * (e.g. to refresh another store whose requirements depend on this one).
     * Returns the unsubscribe function (use in $effect).
     */
    subscribe(onChange?: () => void): () => void {
        const hooks = this.ref.kind === "WORLD" ? JOURNAL_HOOKS : ACTOR_HOOKS;
        const ids = hooks.map(
            (hook) =>
                [
                    hook,
                    onHook(hook, (doc: unknown) => {
                        if (this.#isRelevant(hook, doc)) {
                            this.refresh();
                            onChange?.();
                        }
                    }),
                ] as const,
        );
        return () => {
            for (const [hook, id] of ids) offHook(hook, id);
        };
    }
}

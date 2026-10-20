/** Journal entries and their pages, and what code outside the compat layer can read from them. */
import { localize } from "./i18n";

type JournalDocument = Foundry.latest.JournalEntry;
type PageDocument = Foundry.latest.JournalEntryPage;

declare const brand: unique symbol;

/** A journal entry as code outside the compat layer sees it (at runtime, the document itself). */
export interface JournalEntry {
    readonly id: string;
    readonly [brand]: "JournalEntry";
}

/** A journal page as code outside the compat layer sees it (at runtime, the document itself). */
export interface JournalEntryPage {
    readonly id: string;
    readonly sort: number;
    readonly [brand]: "JournalEntryPage";
}

const journalDocument = (journal: JournalEntry) =>
    journal as unknown as JournalDocument;
const asJournalEntry = (document: JournalDocument) =>
    document as unknown as JournalEntry;
const asJournalEntryPage = (document: PageDocument) =>
    document as unknown as JournalEntryPage;

export function journalById(id: string): JournalEntry | null {
    const journal = game.journal.get(id);
    return journal ? asJournalEntry(journal) : null;
}

export function findJournal(
    test: (journal: JournalEntry) => boolean,
): JournalEntry | null {
    const journal = game.journal.find((j) => test(asJournalEntry(j)));
    return journal ? asJournalEntry(journal) : null;
}

export async function createJournal(data: object): Promise<JournalEntry> {
    const journal = await foundry.documents.JournalEntry.create(data);
    if (!journal)
        throw new Error(localize("downtime-dnd5e.Journal.NotCreated"));
    return asJournalEntry(journal);
}

export function journalPages(journal: JournalEntry): JournalEntryPage[] {
    return Array.from(journalDocument(journal).pages, asJournalEntryPage);
}

export function journalFlag(
    journal: JournalEntry,
    scope: string,
    key: string,
): unknown {
    return journalDocument(journal).getFlag(scope, key);
}

/** Default ownership for a page or journal. */
export function ownership(level: "NONE" | "INHERIT" | "OBSERVER"): {
    default: number;
} {
    return { default: CONST.DOCUMENT_OWNERSHIP_LEVELS[level] };
}

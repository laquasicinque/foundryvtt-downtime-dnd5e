/**
 * History view filtering. Presentation filtering only: clients receive the full data.
 */
import {
    contributorDisplayName,
    contributorKey,
    isOwnContribution,
    type NameLookup,
} from "../rules/contributor";
import { compareText } from "../../lib/text";
import type { I18nKey, Translate } from "../../types/i18n";
import { revertedEventIds } from "../rules/derive";
import type {
    Contributor,
    HistoryEventData,
    HistoryEventKind,
    Id,
    TrackedItemData,
} from "../../types/data";

export interface HistoryViewer {
    userId: string;
    ownedActorUuids: ReadonlySet<string>;
    /** GMs and Assistant GMs see everything. */
    isGM: boolean;
}

export interface HistoryFilter {
    /** Empty = all kinds. */
    kinds: HistoryEventKind[];
    /** Empty = all. Matches METHOD and attributed LEGACY events. */
    methodIds: Id[];
    /** Empty = all. Matches METHOD events. */
    bandIds: Id[];
    /** Empty = all. `contributorKey`s. */
    contributorKeys: string[];
    showReverted: boolean;
}

export const EMPTY_FILTER: HistoryFilter = {
    kinds: [],
    methodIds: [],
    bandIds: [],
    contributorKeys: [],
    showReverted: false,
};

export interface FilterOption {
    value: string;
    label: string;
}

export interface FilterOptions {
    kinds: FilterOption[];
    methods: FilterOption[];
    bands: FilterOption[];
    contributors: FilterOption[];
}

export const KIND_LABELS: Record<HistoryEventKind, I18nKey> = {
    METHOD: "downtime-dnd5e.EventKind.METHOD",
    ADJUST: "downtime-dnd5e.EventKind.ADJUST",
    SET: "downtime-dnd5e.EventKind.SET",
    LEGACY: "downtime-dnd5e.EventKind.LEGACY",
    MILESTONE: "downtime-dnd5e.EventKind.MILESTONE",
    APPROVAL: "downtime-dnd5e.EventKind.APPROVAL",
    REVERT: "downtime-dnd5e.EventKind.REVERT",
    STATE: "downtime-dnd5e.EventKind.STATE",
};

/** Events this viewer may see: everything for GMs, their own contributions otherwise. */
export function visibleEvents(
    history: readonly HistoryEventData[],
    viewer: HistoryViewer,
): HistoryEventData[] {
    return viewer.isGM
        ? [...history]
        : history.filter((e) => isOwnContribution(e.contributor, viewer));
}

function methodIdOf(event: HistoryEventData): Id | null {
    if (event.kind === "METHOD") return event.methodId;
    if (event.kind === "LEGACY") return event.methodId;
    return null;
}

/** Newest first. REVERT events and reverted entries only with `showReverted`. */
export function filterEvents(
    item: TrackedItemData,
    filter: HistoryFilter,
    viewer: HistoryViewer,
): HistoryEventData[] {
    const reverted = revertedEventIds(item.history);
    const kinds = new Set(filter.kinds);
    const methods = new Set(filter.methodIds);
    const bands = new Set(filter.bandIds);
    const contributors = new Set(filter.contributorKeys);
    return visibleEvents(item.history, viewer)
        .filter((e) => {
            if (
                !filter.showReverted &&
                (reverted.has(e.id) || e.kind === "REVERT")
            )
                return false;
            if (kinds.size && !kinds.has(e.kind)) return false;
            if (methods.size) {
                const id = methodIdOf(e);
                if (id === null || !methods.has(id)) return false;
            }
            if (
                bands.size &&
                (e.kind !== "METHOD" || !e.band || !bands.has(e.band.id))
            )
                return false;
            if (
                contributors.size &&
                !contributors.has(contributorKey(e.contributor))
            )
                return false;
            return true;
        })
        .sort((a, b) => b.seq - a.seq);
}

/**
 * What the filters can offer, from the events the viewer can see. Names come
 * from the current methods/bands first, then from event snapshots (deleted
 * methods keep their recorded name).
 */
export function filterOptions(
    item: TrackedItemData,
    viewer: HistoryViewer,
    names: NameLookup,
    t: Translate,
): FilterOptions {
    const events = visibleEvents(item.history, viewer);
    const kinds = new Map<string, string>();
    const methods = new Map<string, string>();
    const bands = new Map<string, string>();
    const contributors = new Map<string, string>();

    const liveMethod = (id: Id) => item.methods.find((m) => m.id === id);
    const liveBandLabel = (methodId: Id, bandId: Id) => {
        const method = liveMethod(methodId);
        const table = method && "results" in method ? method.results : null;
        return table?.bands.find((b) => b.id === bandId)?.label ?? null;
    };

    for (const e of events) {
        kinds.set(e.kind, t(KIND_LABELS[e.kind]));
        contributors.set(
            contributorKey(e.contributor),
            contributorDisplayName(e.contributor, names),
        );
        if (e.kind === "METHOD") {
            methods.set(
                e.methodId,
                liveMethod(e.methodId)?.name ?? e.method.name,
            );
            if (e.band)
                bands.set(
                    e.band.id,
                    liveBandLabel(e.methodId, e.band.id) ||
                        e.band.label ||
                        t("downtime-dnd5e.History.UnlabelledResult"),
                );
        } else if (e.kind === "LEGACY" && e.methodId) {
            methods.set(
                e.methodId,
                liveMethod(e.methodId)?.name ??
                    (e.actionName || t("downtime-dnd5e.History.UnknownMethod")),
            );
        }
    }
    const sorted = (map: Map<string, string>) =>
        Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) =>
            compareText(a.label, b.label),
        );
    return {
        kinds: Array.from(kinds, ([value, label]) => ({ value, label })),
        methods: sorted(methods),
        bands: sorted(bands),
        contributors: sorted(contributors),
    };
}

/**
 * Entries a GM hasn't reviewed yet: player-made, not dismissed and not
 * reverted. GM-made changes don't need reviewing; `isGM` also catches
 * entries migrated from V1, which recorded only the user's name.
 */
export function unreviewedEvents(
    item: TrackedItemData,
    isGM: (contributor: Contributor) => boolean = () => false,
): HistoryEventData[] {
    const reverted = revertedEventIds(item.history);
    return item.history
        .filter(
            (e) =>
                !e.dismissed &&
                !e.contributor.userWasGM &&
                !isGM(e.contributor) &&
                !reverted.has(e.id) &&
                e.kind !== "REVERT",
        )
        .sort((a, b) => b.seq - a.seq);
}

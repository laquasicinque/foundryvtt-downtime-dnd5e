import { contributorKey, isOwnContribution } from "./contributor";
import { effectiveEvents } from "./derive";
import type {
    Contributor,
    ContributorFilter,
    HistoryEventData,
    Id,
    TrackedItemData,
} from "../../types/data";

export interface ContributionTotals {
    /** Sum of applied deltas. */
    net: number;
    /** Sum of positive applied deltas. */
    gained: number;
    /** Sum of negative applied deltas (as a negative number). */
    lost: number;
    attempts: number;
    successes: number;
    failures: number;
}

export interface ContributorTotals extends ContributionTotals {
    key: string;
    /** Most recent contributor record seen for this key (freshest names). */
    contributor: Contributor;
}

/** Bucket for events with no method: ADJUST, and LEGACY entries we couldn't attribute. */
export const UNATTRIBUTED = "__unattributed__";

export interface Contributions {
    total: ContributionTotals;
    /** Keyed by method id, or UNATTRIBUTED. */
    byMethod: Record<string, ContributionTotals>;
    byBand: Record<Id, ContributionTotals>;
    byContributor: Record<string, ContributorTotals>;
    byContributorAndMethod: Record<string, Record<Id, ContributionTotals>>;
}

export interface ContributionOptions {
    /** Only events after this seq (exclusive). Used for SINCE_LAST_FIRE. */
    afterSeq?: number;
    /** Only these methods. Empty/undefined = all. */
    methodIds?: Id[];
    /** Restrict to the viewer's own contributions (non-GM history view). */
    viewer?: { userId: string; ownedActorUuids: ReadonlySet<string> };
}

const emptyTotals = (): ContributionTotals => ({
    net: 0,
    gained: 0,
    lost: 0,
    attempts: 0,
    successes: 0,
    failures: 0,
});

function add(
    totals: ContributionTotals,
    applied: number,
    attempt: boolean,
    countsAs: "SUCCESS" | "FAILURE" | null,
) {
    totals.net += applied;
    if (applied > 0) totals.gained += applied;
    if (applied < 0) totals.lost += applied;
    if (attempt) totals.attempts++;
    if (countsAs === "SUCCESS") totals.successes++;
    if (countsAs === "FAILURE") totals.failures++;
}

/**
 * Contribution breakdown calculated from history. SET events are not
 * contributions (they set an absolute value) and are excluded.
 */
export function contributions(
    history: HistoryEventData[],
    options: ContributionOptions = {},
): Contributions {
    const result: Contributions = {
        total: emptyTotals(),
        byMethod: {},
        byBand: {},
        byContributor: {},
        byContributorAndMethod: {},
    };
    const methodFilter =
        options.methodIds && options.methodIds.length > 0
            ? new Set(options.methodIds)
            : null;

    for (const event of effectiveEvents(history)) {
        if (
            event.kind !== "METHOD" &&
            event.kind !== "ADJUST" &&
            event.kind !== "LEGACY"
        )
            continue;
        if (options.afterSeq !== undefined && event.seq <= options.afterSeq)
            continue;
        if (
            options.viewer &&
            !isOwnContribution(event.contributor, options.viewer)
        )
            continue;

        const methodId = event.kind === "ADJUST" ? null : event.methodId;
        if (methodFilter && (methodId === null || !methodFilter.has(methodId)))
            continue;

        const applied = event.progress.applied;
        const attempt = event.kind === "METHOD";
        const countsAs =
            event.kind === "METHOD" ? (event.band?.countsAs ?? null) : null;
        const methodBucket = methodId ?? UNATTRIBUTED;
        const key = contributorKey(event.contributor);

        add(result.total, applied, attempt, countsAs);
        add(
            (result.byMethod[methodBucket] ??= emptyTotals()),
            applied,
            attempt,
            countsAs,
        );
        if (event.kind === "METHOD" && event.band) {
            add(
                (result.byBand[event.band.id] ??= emptyTotals()),
                applied,
                attempt,
                countsAs,
            );
        }
        const byContributor = (result.byContributor[key] ??= {
            ...emptyTotals(),
            key,
            contributor: event.contributor,
        });
        byContributor.contributor = event.contributor;
        add(byContributor, applied, attempt, countsAs);
        const perMethod = (result.byContributorAndMethod[key] ??= {});
        add(
            (perMethod[methodBucket] ??= emptyTotals()),
            applied,
            attempt,
            countsAs,
        );
    }
    return result;
}

/** seq of the most recent non-reverted firing of a milestone, if any. */
export function lastFireSeq(
    history: HistoryEventData[],
    milestoneId: Id,
): number | null {
    let last: number | null = null;
    for (const event of effectiveEvents(history)) {
        if (event.kind === "MILESTONE" && event.milestoneId === milestoneId) {
            last = event.seq;
        }
    }
    return last;
}

/**
 * Contributors eligible for a CONTRIBUTORS recipient.
 *
 * `beforeSeq` excludes the current firing itself when evaluating
 * SINCE_LAST_FIRE during milestone execution. Contributors without an actor
 * are returned too; callers skip them for item/effect grants.
 */
export function eligibleContributors(
    item: TrackedItemData,
    milestoneId: Id,
    filter: ContributorFilter,
    beforeSeq?: number,
): ContributorTotals[] {
    let afterSeq: number | undefined;
    if (filter.window === "SINCE_LAST_FIRE") {
        const history =
            beforeSeq === undefined
                ? item.history
                : item.history.filter((e) => e.seq < beforeSeq);
        afterSeq = lastFireSeq(history, milestoneId) ?? undefined;
    }
    const history =
        beforeSeq === undefined
            ? item.history
            : item.history.filter((e) => e.seq < beforeSeq);
    const { byContributor } = contributions(history, {
        afterSeq,
        methodIds: filter.methodIds,
    });

    return Object.values(byContributor).filter((c) => {
        const hasActivity =
            c.attempts > 0 || c.net !== 0 || c.gained !== 0 || c.lost !== 0;
        if (!hasActivity) return false;
        if (filter.minNet !== null && c.net < filter.minNet) return false;
        if (filter.minAttempts !== null && c.attempts < filter.minAttempts)
            return false;
        return true;
    });
}

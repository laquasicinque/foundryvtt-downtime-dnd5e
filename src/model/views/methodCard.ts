/**
 * The method-use chat card as pure data. Built from the item's
 * *current* data, so a re-render picks up approvals and reverts; anything
 * "as of the use" (progress, usage) is read from the event and the history up
 * to it.
 */
import {
    contributions,
    eligibleContributors,
    lastFireSeq,
} from "../rules/contributions";
import { contributorDisplayName, type NameLookup } from "../rules/contributor";
import { actionResults, revertedEventIds } from "../rules/derive";
import { actionRecipient } from "../rules/milestones";
import { latestProgressEvent } from "../rules/revert";
import { usageCount, usageSummary } from "../rules/usage";
import type {
    ActionStatus,
    CountsAs,
    Id,
    MethodEventData,
    MilestoneActionKind,
    MilestoneEventData,
    Recipient,
    RollSummary,
    TrackedItemData,
} from "../../types/data";
import type { I18nKey, Translate } from "../../types/i18n";
import { resolveText } from "../../lib/text";

/** What an action did, as shown on cards and in history. */
export const ACTION_LABELS: Record<MilestoneActionKind, I18nKey> = {
    COMPLETE: "downtime-dnd5e.ActionDone.COMPLETE",
    LOCK: "downtime-dnd5e.ActionDone.LOCK",
    ANNOUNCE: "downtime-dnd5e.ActionDone.ANNOUNCE",
    GRANT_ITEM: "downtime-dnd5e.ActionDone.GRANT_ITEM",
    APPLY_EFFECT: "downtime-dnd5e.ActionDone.APPLY_EFFECT",
    ADD_TRACKED_ITEM: "downtime-dnd5e.ActionDone.ADD_TRACKED_ITEM",
    ADJUST_PROGRESS: "downtime-dnd5e.ActionDone.ADJUST_PROGRESS",
    MACRO: "downtime-dnd5e.ActionDone.MACRO",
};

export const STATUS_LABELS: Record<ActionStatus, I18nKey> = {
    APPLIED: "downtime-dnd5e.ActionStatus.APPLIED",
    PENDING_APPROVAL: "downtime-dnd5e.ActionStatus.PENDING_APPROVAL",
    REJECTED: "downtime-dnd5e.ActionStatus.REJECTED",
    FAILED: "downtime-dnd5e.ActionStatus.FAILED",
    REVERTED: "downtime-dnd5e.ActionStatus.REVERTED",
};

export interface MethodCardAction {
    actionId: Id;
    kind: MilestoneActionKind;
    label: string;
    status: ActionStatus;
    statusLabel: string;
    /** Failure reason or similar. */
    message: string | null;
    /** GM_PICKS: the GM chooses recipients when approving. */
    gmPicks: boolean;
}

export interface MethodCardMilestone {
    eventId: Id;
    milestoneId: Id;
    label: string;
    reverted: boolean;
    actions: MethodCardAction[];
}

export interface MethodCard {
    itemId: Id;
    itemName: string;
    itemImg: string;
    methodName: string;
    methodImg: string | null;
    contributorName: string;
    reverted: boolean;
    /** The top of the revert stack (only the latest change can be reverted). */
    latest: boolean;
    roll: {
        formula: string;
        total: number;
        natural: number | null;
        dc: number | null;
    } | null;
    /** What was actually rolled, when it differs from the method (tool + activity, fallback). */
    rolledWith: string | null;
    band: { label: string; countsAs: CountsAs } | null;
    progress: {
        before: number;
        after: number;
        applied: number;
        requested: number;
        clamped: boolean;
        target: number | null;
        /** 0–100 at `after`, when there's a target. */
        percent: number | null;
    };
    /** Usage after this use ("2 uses left"), or null. */
    usage: { text: string; blocked: boolean } | null;
    milestones: MethodCardMilestone[];
    /** GM-only; null for players. */
    note: string | null;
}

export interface MethodCardOptions {
    isGM: boolean;
    names: NameLookup;
    t: Translate;
    /** Display label of a tool key (for "Smith's Tools not found, rolled Athletics"). */
    toolLabel?: (key: string) => string;
    /** Display label of what was rolled. Defaults to the label stored with the roll. */
    rolledLabel?: (rolled: RollSummary["rolled"]) => string;
}

function isGmPicks(recipient: Recipient | null | undefined): boolean {
    return (
        !!recipient &&
        "selection" in recipient &&
        recipient.selection === "GM_PICKS"
    );
}

export function rolledWith(
    item: TrackedItemData,
    event: MethodEventData,
    labels: {
        t: Translate;
        tool: (key: string) => string;
        rolled: (rolled: RollSummary["rolled"]) => string;
    },
): string | null {
    const rolled = event.roll?.rolled;
    if (!rolled) return null;
    const method = item.methods.find((m) => m.id === event.methodId);
    if (method?.kind === "TOOL" && rolled.kind !== "TOOL")
        return labels.t("downtime-dnd5e.Card.ToolFallback", {
            tool: labels.tool(method.tool),
            rolled: labels.rolled(rolled),
        });
    const parts = [rolled.toolItemName ?? null, rolled.activityName ?? null]
        .filter((p): p is string => !!p && p !== event.method.name)
        .filter((p, i, all) => all.indexOf(p) === i);
    if (rolled.kind === "SAVE" || rolled.kind === "CUSTOM")
        parts.push(labels.rolled(rolled));
    return parts.length ? `${parts.join(" · ")}` : null;
}

/** The card for the METHOD event `eventId`, or null when it no longer exists. */
export function buildMethodCard(
    item: TrackedItemData,
    eventId: Id,
    options: MethodCardOptions,
): MethodCard | null {
    const event = item.history.find(
        (e): e is MethodEventData => e.id === eventId && e.kind === "METHOD",
    );
    if (!event) return null;
    const reverted = revertedEventIds(item.history);
    const results = actionResults(item.history);
    const method = item.methods.find((m) => m.id === event.methodId);

    let usage: MethodCard["usage"] = null;
    if (method?.usage) {
        const upTo = item.history.filter((e) => e.seq <= event.seq);
        const summary = usageSummary(
            method.usage,
            usageCount(upTo, method.id, method.usage, event.contributor),
            options.t,
        );
        if (summary.text)
            usage = { text: summary.text, blocked: summary.blocked };
    }

    const milestones = item.history
        .filter(
            (e): e is MilestoneEventData =>
                e.kind === "MILESTONE" && e.causeEventId === event.id,
        )
        .map((e): MethodCardMilestone => {
            const milestone = item.milestones.find(
                (m) => m.id === e.milestoneId,
            );
            return {
                eventId: e.id,
                milestoneId: e.milestoneId,
                label:
                    milestone?.label ||
                    options.t("downtime-dnd5e.Card.Reached", {
                        at: milestone?.at ?? "?",
                    }),
                reverted: reverted.has(e.id),
                actions: e.actions.map((stored) => {
                    const current =
                        results.get(`${e.id}:${stored.actionId}`) ?? stored;
                    const status = reverted.has(e.id)
                        ? "REVERTED"
                        : current.status;
                    return {
                        actionId: stored.actionId,
                        kind: stored.kind,
                        label: options.t(ACTION_LABELS[stored.kind]),
                        status,
                        statusLabel: options.t(STATUS_LABELS[status]),
                        message: resolveText(current.message, options.t),
                        gmPicks: isGmPicks(
                            actionRecipient(
                                milestone?.actions.find(
                                    (a) => a.id === stored.actionId,
                                ),
                            ),
                        ),
                    };
                }),
            };
        });

    const target = item.progress.target;
    const p = event.progress;
    return {
        itemId: item.id,
        itemName: item.name,
        itemImg: item.img,
        methodName: event.method.name,
        methodImg: method?.img ?? null,
        contributorName: contributorDisplayName(
            event.contributor,
            options.names,
        ),
        reverted: reverted.has(event.id),
        latest: latestProgressEvent(item)?.id === event.id,
        roll: event.roll
            ? {
                  formula: event.roll.formula,
                  total: event.roll.total,
                  natural: event.roll.natural,
                  dc: event.roll.dc,
              }
            : null,
        rolledWith: rolledWith(item, event, {
            t: options.t,
            tool: options.toolLabel ?? ((key) => key),
            rolled: options.rolledLabel ?? ((rolled) => rolled.label),
        }),
        band:
            // Fixed methods record their own name as the result label; don't repeat it.
            event.band &&
            event.band.label &&
            event.band.label !== event.method.name
                ? { label: event.band.label, countsAs: event.band.countsAs }
                : null,
        progress: {
            before: p.before,
            after: p.after,
            applied: p.applied,
            requested: p.requested,
            clamped: p.requested !== p.applied,
            target,
            percent:
                target !== null && target > 0
                    ? Math.max(0, Math.min(100, (p.after / target) * 100))
                    : null,
        },
        usage,
        milestones,
        note: options.isGM ? event.note : null,
    };
}

export interface ApprovalCandidate {
    actorUuid: string;
    /** Passes the recipient's filter (pre-ticked). ACTOR lists: always true. */
    eligible: boolean;
    /** CONTRIBUTORS: stats over the filter's window and methods. */
    stats: { net: number; attempts: number } | null;
}

/**
 * Actors the GM can pick from when approving a GM_PICKS action: the listed
 * actors, or every contributor with an actor, those passing the filter
 * marked eligible. null when the action isn't GM_PICKS.
 */
export function approvalCandidates(
    item: TrackedItemData,
    milestoneEventId: Id,
    actionId: Id,
): ApprovalCandidate[] | null {
    const event = item.history.find(
        (e): e is MilestoneEventData =>
            e.id === milestoneEventId && e.kind === "MILESTONE",
    );
    const milestone = item.milestones.find((m) => m.id === event?.milestoneId);
    const recipient = actionRecipient(
        milestone?.actions.find((a) => a.id === actionId),
    );
    if (!event || !milestone || !recipient || !isGmPicks(recipient))
        return null;
    switch (recipient.type) {
        case "ACTOR":
            return Array.from(new Set(recipient.actorUuids), (actorUuid) => ({
                actorUuid,
                eligible: true,
                stats: null,
            }));
        case "CONTRIBUTORS": {
            const before = item.history.filter((e) => e.seq < event.seq);
            const afterSeq =
                recipient.filter.window === "SINCE_LAST_FIRE"
                    ? (lastFireSeq(before, milestone.id) ?? undefined)
                    : undefined;
            const all = contributions(before, {
                afterSeq,
                methodIds: recipient.filter.methodIds,
            }).byContributor;
            const eligible = new Set(
                eligibleContributors(
                    item,
                    milestone.id,
                    recipient.filter,
                    event.seq,
                ).map((c) => c.key),
            );
            return Object.values(all)
                .filter((c) => c.contributor.actorUuid !== null)
                .map((c) => ({
                    actorUuid: c.contributor.actorUuid!,
                    eligible: eligible.has(c.key),
                    stats: { net: c.net, attempts: c.attempts },
                }));
        }
        default:
            return null;
    }
}

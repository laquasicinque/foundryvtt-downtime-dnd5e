import type { Problem } from "./problems";
import type {
    Id,
    MilestoneAction,
    MilestoneData,
    ProgressConfig,
    Recipient,
    StoreRef,
    TrackedItemData,
} from "../../types/data";
import type { I18nKey, Translate } from "../../types/i18n";

/**
 * How many times a progress change from `before` to `after` (post-clamp) hits
 * the milestone, ignoring fire limits.
 *
 * - CROSS: upward only in v1, `before < at <= after` → 0 or 1.
 * - EXACT: lands on `at` after clamping, from any direction, and only when
 *   the value actually moved onto it (staying put at `at` doesn't re-fire) → 0 or 1.
 * - EVERY: once per positive multiple of `at` passed on the way up, so one big
 *   change can fire several times (repeating downtimes: "every 8 hours, a batch").
 */
export function milestoneHits(
    milestone: MilestoneData,
    before: number,
    after: number,
): number {
    switch (milestone.match) {
        case "CROSS":
            return before < milestone.at && after >= milestone.at ? 1 : 0;
        case "EXACT":
            return after === milestone.at && before !== milestone.at ? 1 : 0;
        case "EVERY": {
            if (milestone.at <= 0 || after <= before) return 0;
            const multiples = (value: number) =>
                Math.max(0, Math.floor(value / milestone.at));
            return multiples(after) - multiples(before);
        }
    }
}

export function hitsMilestone(
    milestone: MilestoneData,
    before: number,
    after: number,
): boolean {
    return milestoneHits(milestone, before, after) > 0;
}

/**
 * Milestone firings for this change, in definition order. A milestone appears
 * once per firing (EVERY can fire several times), capped by `maxTimes`.
 * `fires` is the current derived fire count per milestone.
 */
export function detectMilestones(
    milestones: MilestoneData[],
    before: number,
    after: number,
    fires: Record<Id, number>,
): MilestoneData[] {
    return milestones.flatMap((milestone) => {
        const hits = milestoneHits(milestone, before, after);
        const already = fires[milestone.id] ?? 0;
        const allowed =
            milestone.maxTimes === null
                ? hits
                : Math.max(0, Math.min(hits, milestone.maxTimes - already));
        return Array.from({ length: allowed }, () => milestone);
    });
}

/** The first repeating (EVERY) milestone, if the item has one. */
export function repeatingMilestone(
    milestones: readonly MilestoneData[],
): MilestoneData | null {
    return milestones.find((m) => m.match === "EVERY" && m.at > 0) ?? null;
}

/** Progress through the current batch of a repeating milestone. */
export function repeatProgress(
    value: number,
    every: number,
): { inBatch: number; size: number; batches: number } {
    const batches = Math.max(0, Math.floor(value / every));
    return {
        inBatch: value - batches * every,
        size: every,
        batches,
    };
}

/** Who an action gives something to, for the actions that have a recipient. */
export function actionRecipient(
    action: MilestoneAction | undefined,
): Recipient | null {
    switch (action?.kind) {
        case "GRANT_ITEM":
        case "APPLY_EFFECT":
        case "ADD_TRACKED_ITEM":
            return action.recipient;
        default:
            return null;
    }
}

export interface MilestoneCheckContext {
    store: StoreRef;
    progress: ProgressConfig;
    /** Other items in the same store (ADJUST_PROGRESS targets). */
    items: readonly TrackedItemData[];
    t: Translate;
}

const P = "downtime-dnd5e.Milestone.Problem";

function recipientProblems(
    recipient: Recipient | null,
    ctx: MilestoneCheckContext,
): Problem[] {
    if (!recipient) return [];
    if (recipient.type === "OWNING_ACTOR" && ctx.store.kind === "WORLD")
        return [{ message: ctx.t(`${P}.WorldOwner`), blocking: true }];
    if (recipient.type === "ACTOR" && recipient.actorUuids.length === 0)
        return [{ message: ctx.t(`${P}.AddCharacter`), blocking: true }];
    return [];
}

/** Problems with one action as configured, for the editor. */
export function actionProblems(
    action: MilestoneAction,
    ctx: MilestoneCheckContext,
): Problem[] {
    const block = (key: I18nKey): Problem => ({
        message: ctx.t(key),
        blocking: true,
    });
    const warn = (key: I18nKey): Problem => ({
        message: ctx.t(key),
        blocking: false,
    });
    switch (action.kind) {
        case "GRANT_ITEM":
            return [
                ...(action.sourceUuid ? [] : [block(`${P}.DropItem`)]),
                ...recipientProblems(action.recipient, ctx),
            ];
        case "APPLY_EFFECT":
            return [
                ...(action.sourceUuid ? [] : [block(`${P}.DropEffect`)]),
                ...recipientProblems(action.recipient, ctx),
            ];
        case "ADD_TRACKED_ITEM":
            return [
                ...(action.template.name.trim()
                    ? []
                    : [block(`${P}.PickTemplate`)]),
                ...(action.store === "RECIPIENT_ACTOR"
                    ? action.recipient
                        ? recipientProblems(action.recipient, ctx)
                        : [block(`${P}.ChooseRecipient`)]
                    : []),
            ];
        case "ADJUST_PROGRESS": {
            if (action.ref.kind === "SELF") return [block(`${P}.AdjustSelf`)];
            const problems: Problem[] = [];
            const targetId = action.ref.id;
            if (!ctx.items.some((i) => i.id === targetId))
                problems.push(warn(`${P}.AdjustTargetMissing`));
            if (action.delta === 0) problems.push(warn(`${P}.AdjustZero`));
            return problems;
        }
        case "MACRO":
            return [
                ...(action.macroUuid ? [] : [block(`${P}.DropMacro`)]),
                ...(action.undoMacroUuid ? [] : [warn(`${P}.NoUndoMacro`)]),
            ];
        default:
            return [];
    }
}

/** Problems with a milestone's own settings (not its actions), for the editor. */
export function milestoneProblems(
    milestone: MilestoneData,
    ctx: MilestoneCheckContext,
): Problem[] {
    const { t } = ctx;
    const problems: Problem[] = [];
    const { min, max } = ctx.progress;
    if (milestone.match === "EVERY" && !(milestone.at > 0))
        problems.push({ message: t(`${P}.RepeatStep`), blocking: true });
    if (max !== null && milestone.at > max)
        problems.push({
            message: t(`${P}.AboveMax`, { max }),
            blocking: false,
        });
    if (milestone.match === "CROSS" && min !== null && milestone.at <= min)
        problems.push({
            message: t(`${P}.CrossBelowMin`, { min, at: milestone.at }),
            blocking: false,
        });
    if (milestone.match === "EXACT" && min !== null && milestone.at < min)
        problems.push({
            message: t(`${P}.BelowMin`, { min }),
            blocking: false,
        });
    return problems;
}

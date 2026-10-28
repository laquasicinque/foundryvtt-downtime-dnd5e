/**
 * UI actions shared by the downtime tab and editors. All writes go through the
 * domain classes / API (and so the GM command pipeline); failures become
 * notifications.
 */
import type { TrackedItem } from "../domain/TrackedItem";
import type { AnyMethod } from "../domain/Method";
import {
    ACTION_KIND_LABELS,
    duplicateData,
    placeInOrder,
} from "../model/authoring/editing";
import type { RevertBlocker, RevertPlan } from "../types/revert";
import type { CategoryData, StoreRef, TrackedItemData } from "../types/data";
import type { I18nKey } from "../types/i18n";
import { storeKey } from "../model/storage/stores";
import { getTrackedItem, getTrackedItems, v3Api } from "../runtime/api";
import { confirm } from "../foundry/dialogs";
import { localize, localizeText } from "../foundry/i18n";
import { localized } from "../lib/text";
import { notifyInfo, notifyWarn } from "../foundry/notifications";
import { escapeHTML as escape } from "../foundry/utils";
import { useMethodInteractive } from "../runtime/methodUse";

async function guarded<T>(
    label: string,
    fn: () => Promise<T>,
): Promise<T | null> {
    try {
        return await fn();
    } catch (error) {
        notifyWarn(
            localize("downtime-dnd5e.Notify.ItemError", {
                item: label,
                error: error instanceof Error ? error.message : String(error),
            }),
        );
        return null;
    }
}

export function useMethod(method: AnyMethod, actingActorUuid: string | null) {
    return useMethodInteractive(method, actingActorUuid);
}

/** GM: change progress by `delta` without a prompt (the progress bar's −/+). */
export async function nudgeProgress(item: TrackedItem, delta: number) {
    await guarded(item.name, () => item.adjust(delta));
}

/** GM: set progress to `value` without a prompt (the progress bar's inline field). */
export async function setProgressTo(item: TrackedItem, value: number) {
    await guarded(item.name, () => item.set(value));
}

export const BLOCKER_TEXT: Record<RevertBlocker["kind"], I18nKey> = {
    MACRO_WITHOUT_UNDO: "downtime-dnd5e.Revert.Blocker.MACRO_WITHOUT_UNDO",
    TRACKED_ITEM_HAS_HISTORY:
        "downtime-dnd5e.Revert.Blocker.TRACKED_ITEM_HAS_HISTORY",
    ADJUSTMENT_NOT_LATEST:
        "downtime-dnd5e.Revert.Blocker.ADJUSTMENT_NOT_LATEST",
    ADJUSTMENT_BLOCKED: "downtime-dnd5e.Revert.Blocker.ADJUSTMENT_BLOCKED",
};

/** "Milestone "Party!" (Run a macro): a macro ran that has no undo macro" — one line per blocker. */
export function blockerReasons(item: TrackedItem, plan: RevertPlan): string[] {
    const lines = plan.blockers.map((blocker) => {
        const event = item.event(blocker.milestoneEventId);
        const milestone =
            event?.data.kind === "MILESTONE"
                ? item.milestone(event.data.milestoneId)
                : undefined;
        const action = milestone?.actions.find(
            (a) => a.id === blocker.actionId,
        );
        const name =
            milestone &&
            (milestone.label ||
                localize("downtime-dnd5e.Revert.MilestoneAt", {
                    at: milestone.at,
                }));
        const where = !name
            ? localize("downtime-dnd5e.Revert.AMilestone")
            : action
              ? localize("downtime-dnd5e.Revert.MilestoneAction", {
                    milestone: name,
                    action: localize(ACTION_KIND_LABELS[action.kind]),
                })
              : localize("downtime-dnd5e.Revert.Milestone", {
                    milestone: name,
                });
        return localize("downtime-dnd5e.Revert.BlockerLine", {
            where,
            reason: localize(BLOCKER_TEXT[blocker.kind]),
        });
    });
    return [...new Set(lines)];
}

export async function revertLatest(item: TrackedItem) {
    const plan = await item.planRevert();
    if (!plan) {
        notifyInfo(
            localize("downtime-dnd5e.Revert.Nothing", { item: item.name }),
        );
        return;
    }
    if (plan.blockers.length > 0) {
        const reasons = blockerReasons(item, plan);
        notifyWarn(
            localize("downtime-dnd5e.Revert.Blocked", {
                item: item.name,
                reasons: reasons.join("; "),
            }),
        );
        return;
    }
    const undo = plan.undo.filter(
        (step) => step.kind !== "DERIVED" && step.kind !== "NONE",
    );
    const milestones = plan.revertedMilestoneEventIds.length;
    const ok = await confirm(
        localize("downtime-dnd5e.Revert.ConfirmTitle"),
        `<p>${localize("downtime-dnd5e.Revert.Confirm", { item: `<strong>${escape(item.name)}</strong>` })}</p>` +
            (milestones
                ? `<p>${localize(
                      undo.length
                          ? "downtime-dnd5e.Revert.AlsoMilestonesAndActions"
                          : "downtime-dnd5e.Revert.AlsoMilestones",
                      {
                          milestones: localized(
                              "downtime-dnd5e.Count.Milestones",
                              {
                                  count: milestones,
                              },
                          ),
                          actions: localized("downtime-dnd5e.Count.Actions", {
                              count: undo.length,
                          }),
                      },
                  )}</p>`
                : ""),
    );
    if (ok) await guarded(item.name, () => item.revertLatest());
}

export async function deleteTrackedItem(item: TrackedItem) {
    const ok = await confirm(
        localize("downtime-dnd5e.Item.DeleteTitle"),
        `<p>${localize("downtime-dnd5e.Item.DeleteConfirm", { item: `<strong>${escape(item.name)}</strong>` })}</p>`,
    );
    if (ok) await guarded(item.name, () => item.delete());
}

/** GM: a fresh copy (no history) in the same store, opened in the editor unless `quiet`. */
export async function duplicateTrackedItem(
    item: TrackedItem,
    options: {
        categoryId?: string | null;
        beforeId?: string | null;
        quiet?: boolean;
    } = {},
) {
    const data = duplicateData(item.data as TrackedItemData);
    if (options.categoryId !== undefined) data.categoryId = options.categoryId;
    const created = await guarded(item.name, () =>
        v3Api.createItem(item.store, data),
    );
    if (!created) return null;
    if (options.beforeId !== undefined)
        await placeTrackedItem(created, options.beforeId);
    if (!options.quiet) {
        const { openTrackedItemEditor } =
            await import("./editors/ItemEditorApp");
        openTrackedItemEditor(created);
    }
    return created;
}

/** GM: put `item` just before `beforeId` (null: at the end) in its store's order. */
async function placeTrackedItem(item: TrackedItem, beforeId: string | null) {
    const order = (await getTrackedItems(item.store)).map((i) => i.id);
    const next = placeInOrder(order, item.id, beforeId);
    if (next.join() !== order.join())
        await guarded(item.name, () => v3Api.reorderItems(item.store, next));
}

/** GM: open the move dialog (choices about links and categories before anything changes). */
export async function openMoveDialog(
    item: TrackedItem,
    options: { dest?: StoreRef; mode?: "MOVE" | "COPY" } = {},
) {
    const { openTransfer } = await import("./transfer/TransferApp");
    openTransfer(item, options);
}

/**
 * GM: an item dropped on a store's list, before `beforeId` (null: the end)
 * in `categoryId`. Within a store it's reordered (or duplicated with `copy`);
 * to another store it goes through the move dialog (a copy is a duplicate
 * that's then moved), and nothing happens if that's cancelled.
 */
export async function dropTrackedItem(
    payload: { store: StoreRef; itemId: string },
    dest: StoreRef,
    categoryId: string | null,
    beforeId: string | null,
    copy: boolean,
) {
    const item = await getTrackedItem(payload.store, payload.itemId);
    if (!item) return;
    if (storeKey(payload.store) !== storeKey(dest)) {
        await openMoveDialog(item, { dest, mode: copy ? "COPY" : "MOVE" });
        return;
    }
    if (copy) {
        await duplicateTrackedItem(item, { categoryId, beforeId, quiet: true });
        return;
    }
    if (beforeId === item.id) return;
    if (item.categoryId !== categoryId)
        await guarded(item.name, () => item.update({ categoryId }));
    await placeTrackedItem(item, beforeId);
}

/** GM: a method dropped at `index` in an item (any store); `copy` keeps the original. */
export async function dropMethod(
    payload: { store: StoreRef; itemId: string; methodId: string },
    dest: StoreRef,
    destItemId: string,
    index: number,
    copy: boolean,
) {
    await guarded(localize("downtime-dnd5e.Method.Move"), async () => {
        const result = await v3Api.dispatch({
            type: "MOVE_METHOD",
            store: payload.store,
            itemId: payload.itemId,
            methodId: payload.methodId,
            dest,
            destItemId,
            index,
            copy,
        });
        if (!result.ok) throw new Error(localizeText(result.error.message));
    });
}

export async function setLocked(item: TrackedItem, locked: boolean) {
    await guarded(item.name, () => item.setState({ locked }));
}

/** GM: open the form for a new item (presets are on its first tab). */
export async function createTrackedItem(
    store: StoreRef,
    categoryId: string | null = null,
) {
    const { openNewTrackedItemEditor } =
        await import("./editors/ItemEditorApp");
    openNewTrackedItemEditor(store, categoryId);
}

export async function saveCategories(
    store: StoreRef,
    categories: CategoryData[],
) {
    await guarded(localize("downtime-dnd5e.Category.Title"), () =>
        v3Api.setCategories(store, categories),
    );
}

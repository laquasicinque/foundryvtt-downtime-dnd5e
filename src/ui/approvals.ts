/**
 * GM approval of pending milestone actions, shared by the chat
 * card and the history window. GM_PICKS actions ask who receives them.
 */
import { MilestoneEvent } from "../domain/HistoryEvent";
import type { TrackedItem } from "../domain/TrackedItem";
import { approvalCandidates } from "../model/views/methodCard";
import type { Id, TrackedItemData } from "../types/data";
import { isPlayerCharacter } from "../dnd5e/actors";
import { actorFromUuid, worldActors } from "../foundry/actors";
import { pickMany } from "../foundry/dialogs";
import { localize } from "../foundry/i18n";
import { notifyWarn } from "../foundry/notifications";

/** Player characters, offered when a GM_PICKS action has no eligible candidates. */
function playerCharacters() {
    return worldActors().filter(isPlayerCharacter);
}

/** "+3 progress, 2 uses", and whether the filter excludes them. */
function candidateStats(candidate: {
    eligible: boolean;
    stats: { net: number; attempts: number } | null;
}): string {
    const { net, attempts } = candidate.stats!;
    const stats = localize("downtime-dnd5e.Approval.Stats", {
        net: `${net >= 0 ? "+" : ""}${net}`,
        count: attempts,
    });
    return candidate.eligible
        ? stats
        : localize("downtime-dnd5e.Approval.NotEligible", { stats });
}

/** Approve or reject a pending action. Resolves to false if cancelled or it failed. */
export async function resolveApproval(
    item: TrackedItem,
    milestoneEventId: Id,
    actionId: Id,
    approved: boolean,
): Promise<boolean> {
    const event = item.event(milestoneEventId);
    if (!(event instanceof MilestoneEvent)) {
        notifyWarn(
            localize("downtime-dnd5e.Approval.MilestoneGone", {
                item: item.name,
            }),
        );
        return false;
    }
    let picks: string[] | undefined;
    const candidates = approved
        ? approvalCandidates(
              item.data as TrackedItemData,
              milestoneEventId,
              actionId,
          )
        : null;
    if (candidates) {
        const options = candidates.length
            ? await Promise.all(
                  candidates.map(async (c) => {
                      const actor = await actorFromUuid(c.actorUuid);
                      return {
                          label:
                              actor?.name ??
                              localize(
                                  "downtime-dnd5e.Approval.ActorNotFound",
                                  {
                                      uuid: c.actorUuid,
                                  },
                              ),
                          value: c.actorUuid,
                          checked: c.eligible,
                          disabled: !actor,
                          detail: c.stats ? candidateStats(c) : undefined,
                      };
                  }),
              )
            : playerCharacters().map((actor) => ({
                  label: actor.name ?? actor.uuid!,
                  value: actor.uuid!,
                  checked: false,
              }));
        const chosen = await pickMany(
            localize("downtime-dnd5e.Approval.WhoReceives"),
            localize(
                candidates.length
                    ? "downtime-dnd5e.Approval.FilterTicked"
                    : "downtime-dnd5e.Approval.NoContributors",
            ),
            options,
        );
        if (!chosen) return false;
        if (chosen.length === 0) {
            notifyWarn(localize("downtime-dnd5e.Approval.PickRecipient"));
            return false;
        }
        picks = chosen;
    }
    try {
        await event.resolve(actionId, approved, picks);
        return true;
    } catch (error) {
        notifyWarn(
            localize("downtime-dnd5e.Notify.ItemError", {
                item: item.name,
                error: error instanceof Error ? error.message : String(error),
            }),
        );
        return false;
    }
}

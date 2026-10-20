<script lang="ts">
    import { localize } from "../../foundry/i18n";
    /**
     * World-level "unreviewed changes": every player-made entry a
     * GM hasn't reviewed yet, across the world and all characters, with
     * pending approvals. Replaces the V1 dismiss workflow.
     */
    import { notifyWarn } from "../../foundry/notifications";
    import type { AnyHistoryEvent } from "../../domain/HistoryEvent";
    import type { TrackedItem } from "../../domain/TrackedItem";
    import { unreviewedEvents } from "../../model/views/historyView";
    import type { Contributor, TrackedItemData } from "../../types/data";
    import { WORLD_STORE } from "../../model/storage/stores";
    import { worldActors } from "../../foundry/actors";
    import { offHook, onHook } from "../../foundry/hooks";
    import { isGMUser } from "../../foundry/users";
    import { getTrackedItemsSync } from "../../runtime/api";
    import { resolveApproval } from "../approvals";
    import { eventDelta, formatDate } from "../describe";
    import EventDetails from "./EventDetails.svelte";
    import { openHistory } from "./HistoryApp";

    const HOOKS = [
        "updateActor",
        "updateActorDelta",
        "createJournalEntryPage",
        "updateJournalEntryPage",
        "deleteJournalEntryPage",
    ] as const;

    /** Rows per item; the rest are in its history window. */
    const MAX_ROWS = 20;

    let version = $state(0);
    $effect(() => {
        let timer: number | null = null;
        const bump = () => {
            if (timer !== null) return;
            timer = window.setTimeout(() => {
                timer = null;
                version++;
            }, 50);
        };
        const ids = HOOKS.map((hook) => [hook, onHook(hook, bump)] as const);
        return () => {
            for (const [hook, id] of ids) offHook(hook, id);
            if (timer !== null) window.clearTimeout(timer);
        };
    });

    /** V1 entries recorded only the user's name. */
    const isGMContributor = (c: Contributor) => isGMUser(c.userId, c.userName);

    type Group = {
        key: string;
        item: TrackedItem;
        owner: string;
        events: AnyHistoryEvent[];
        pending: number;
    };

    const groups = $derived.by((): Group[] => {
        void version;
        const stores = [
            {
                ref: WORLD_STORE,
                owner: localize("downtime-dnd5e.Review.World"),
            },
            ...worldActors().map((actor) => ({
                ref: { kind: "ACTOR" as const, actorUuid: actor.uuid! },
                owner: actor.name ?? "",
            })),
        ];
        const result: Group[] = [];
        for (const { ref, owner } of stores) {
            // World actors and the world store are always in memory.
            for (const item of getTrackedItemsSync(ref)) {
                const ids = new Set(
                    unreviewedEvents(
                        item.data as TrackedItemData,
                        isGMContributor,
                    ).map((e) => e.id),
                );
                const pending = item.state.pendingApprovals.length;
                // Milestones awaiting approval show even when a GM's use fired them.
                for (const approval of item.state.pendingApprovals)
                    ids.add(approval.milestoneEventId);
                if (!ids.size && !pending) continue;
                result.push({
                    key: `${owner}:${item.id}`,
                    item,
                    owner,
                    events: [...item.history]
                        .filter((e) => ids.has(e.id))
                        .reverse(),
                    pending,
                });
            }
        }
        return result;
    });

    let busy = $state(false);
    async function run(fn: () => Promise<unknown>) {
        busy = true;
        try {
            await fn();
        } catch (error) {
            notifyWarn(error instanceof Error ? error.message : String(error));
        } finally {
            busy = false;
        }
    }
</script>

<div class="review-window">
    {#each groups as group (group.key)}
        <section>
            <header>
                <img src={group.item.img || "icons/svg/book.svg"} alt="" />
                <div class="title">
                    <strong>{group.item.name}</strong>
                    <span
                        >{group.owner} · {localize(
                            "downtime-dnd5e.Review.Unreviewed",
                            {
                                count: group.events.length,
                            },
                        )}{group.pending
                            ? ` · ${localize("downtime-dnd5e.Review.AwaitingApproval", { count: group.pending })}`
                            : ""}</span
                    >
                </div>
                <button
                    type="button"
                    onclick={() => openHistory(group.item)}
                    title={localize("downtime-dnd5e.Review.OpenTheFullHistory")}
                    ><i class="fas fa-clock-rotate-left"></i></button
                >
                <button
                    type="button"
                    disabled={busy || !group.events.length}
                    onclick={() =>
                        run(() =>
                            group.item.dismissEvents(
                                group.events.map((e) => e.id),
                            ),
                        )}
                    ><i class="fas fa-check-double"></i>
                    {localize("downtime-dnd5e.Review.AllReviewed")}</button
                >
            </header>
            <table>
                <tbody>
                    {#each group.events.slice(0, MAX_ROWS) as event (event.id)}
                        <tr>
                            <td
                                class="when"
                                class:unknown={event.timestamp === null}
                                >{formatDate(event.timestamp)}</td
                            >
                            <td>{event.contributorName}</td>
                            <td>
                                <EventDetails
                                    {event}
                                    isGM={true}
                                    {busy}
                                    onresolve={(
                                        milestoneEventId,
                                        actionId,
                                        approved,
                                    ) =>
                                        run(() =>
                                            resolveApproval(
                                                group.item,
                                                milestoneEventId,
                                                actionId,
                                                approved,
                                            ),
                                        )}
                                />
                            </td>
                            <td class="delta">{eventDelta(event)}</td>
                            <td>
                                <button
                                    type="button"
                                    class="small"
                                    disabled={busy}
                                    title={localize(
                                        "downtime-dnd5e.Review.MarkAsReviewed",
                                    )}
                                    onclick={() => run(() => event.dismiss())}
                                    ><i class="fas fa-check"></i></button
                                >
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
            {#if group.events.length > MAX_ROWS}
                <p class="more">
                    {localize("downtime-dnd5e.Review.More", {
                        count: group.events.length - MAX_ROWS,
                    })}
                </p>
            {/if}
        </section>
    {:else}
        <p class="empty">{localize("downtime-dnd5e.Review.NothingToReview")}</p>
    {/each}
</div>

<style>
    .review-window {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        height: 100%;
        overflow-y: auto;
    }
    header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    header img {
        width: 28px;
        height: 28px;
        border: none;
    }
    .title {
        display: flex;
        flex-direction: column;
        flex: 1;
    }
    .title span {
        font-size: 0.8rem;
        opacity: 0.8;
    }
    header button {
        width: auto;
        font-size: 0.8rem;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
    }
    td {
        padding: 0.2rem 0.25rem;
        vertical-align: top;
        border-bottom: 1px solid var(--color-border-light-1, #ddd);
    }
    .when {
        white-space: nowrap;
        opacity: 0.8;
    }
    .when.unknown {
        font-style: italic;
    }
    .delta {
        white-space: nowrap;
    }
    button.small {
        width: auto;
        line-height: 1.3;
        padding: 0 0.35rem;
        font-size: 0.75rem;
    }
    .more {
        font-size: 0.8rem;
        opacity: 0.7;
        margin: 0.2rem 0 0;
    }
    .empty {
        font-size: 0.85rem;
        opacity: 0.7;
        margin: 0;
    }
</style>

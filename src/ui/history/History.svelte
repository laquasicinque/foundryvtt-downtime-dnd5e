<script lang="ts">
    import { localize, localizeText } from "../../foundry/i18n";
    import { contributorNames } from "../../runtime/api";
    /**
     * Item history window: filterable event list and the
     * contribution summary. GMs see everything and can review, annotate,
     * approve and revert; players see only their own contributions.
     * Notes are GM-only.
     */
    import { isOwnedByCurrentUser, worldActors } from "../../foundry/actors";
    import { promptText } from "../../foundry/dialogs";
    import { notifyWarn } from "../../foundry/notifications";
    import {
        currentUserId,
        isGM as currentUserIsGM,
    } from "../../foundry/users";
    import { untrack } from "svelte";
    import type { AnyHistoryEvent } from "../../domain/HistoryEvent";
    import {
        EMPTY_FILTER,
        filterEvents,
        filterOptions,
        type HistoryFilter,
        type HistoryViewer,
    } from "../../model/views/historyView";
    import type { RevertPlan } from "../../types/revert";
    import { latestProgressEvent } from "../../model/rules/revert";
    import type { Id, StoreRef, TrackedItemData } from "../../types/data";
    import { blockerReasons, revertLatest } from "../actions";
    import { resolveApproval } from "../approvals";
    import { eventDelta, formatDate } from "../describe";
    import { StoreState } from "../StoreState.svelte";
    import Contributions from "./Contributions.svelte";
    import EventDetails from "./EventDetails.svelte";

    type Props = { store: StoreRef; itemId: Id };

    const { store, itemId }: Props = $props();

    const isGM = currentUserIsGM();
    const storeState = new StoreState(untrack(() => store));
    $effect(() => storeState.subscribe());

    const item = $derived(
        storeState.items.find((i) => i.id === itemId) ?? null,
    );

    const viewer: HistoryViewer = {
        userId: currentUserId(),
        ownedActorUuids: new Set(
            worldActors()
                .filter(isOwnedByCurrentUser)
                .map((a) => a.uuid!),
        ),
        isGM,
    };
    const names = contributorNames;

    let tab = $state<"events" | "contributions">("events");
    let filter = $state<HistoryFilter>({ ...EMPTY_FILTER });

    const one = (value: string) => (value ? [value] : []);

    const options = $derived(
        item
            ? filterOptions(
                  item.data as TrackedItemData,
                  viewer,
                  names,
                  localize,
              )
            : null,
    );
    const events = $derived.by((): AnyHistoryEvent[] => {
        if (!item) return [];
        const byId = new Map(item.history.map((e) => [e.id, e]));
        return filterEvents(item.data as TrackedItemData, filter, viewer)
            .map((data) => byId.get(data.id))
            .filter((e): e is AnyHistoryEvent => !!e);
    });
    /** The top of the revert stack. */
    const latestId = $derived(
        item
            ? (latestProgressEvent(item.data as TrackedItemData)?.id ?? null)
            : null,
    );
    const quarantined = $derived(
        isGM && item
            ? item.quarantine.filter((q) => q.path.startsWith("history"))
            : [],
    );

    /** Dry-run of reverting the latest change, for its row. */
    let plan = $state<RevertPlan | null>(null);
    $effect(() => {
        const current = item;
        if (!isGM || !current) return;
        let cancelled = false;
        const load = async () => {
            const planned = await current.planRevert();
            if (!cancelled) plan = planned;
        };
        void load();
        return () => {
            cancelled = true;
        };
    });
    const blockers = $derived(plan ? blockerReasons(item!, plan) : []);

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

    async function editNote(event: AnyHistoryEvent) {
        const note = await promptText(
            localize("downtime-dnd5e.History.NoteTitle"),
            event.note ?? "",
        );
        if (note === null) return;
        await run(() => event.setNote(note.trim() || null));
    }

    function markAllReviewed() {
        if (!item) return;
        const ids = events.filter((e) => !e.dismissed).map((e) => e.id);
        if (ids.length) void run(() => item.dismissEvents(ids));
    }
</script>

<div class="history-window">
    {#if !item}
        <p class="empty">
            {localize("downtime-dnd5e.History.ThisTrackedItemNo")}
        </p>
    {:else}
        <header>
            <img src={item.img || "icons/svg/book.svg"} alt="" />
            <div class="title">
                <strong>{item.name}</strong>
                <span>
                    {item.value}{item.progress.target !== null
                        ? ` / ${item.progress.target}`
                        : ""}
                    {#if item.completed}
                        · {localize("downtime-dnd5e.History.Complete")}{/if}
                    {#if item.locked}
                        · {localize("downtime-dnd5e.History.Locked")}{/if}
                </span>
            </div>
            <nav class="tabs">
                <button
                    type="button"
                    class:active={tab === "events"}
                    onclick={() => (tab = "events")}
                    >{localize("downtime-dnd5e.History.Events")}</button
                >
                <button
                    type="button"
                    class:active={tab === "contributions"}
                    onclick={() => (tab = "contributions")}
                    >{localize("downtime-dnd5e.History.Contributions")}</button
                >
            </nav>
        </header>

        {#if tab === "contributions"}
            <Contributions {item} {viewer} />
        {:else}
            {#if !isGM}
                <p class="hint">
                    {localize(
                        "downtime-dnd5e.History.ShowingYourContributionsOnly",
                    )}
                </p>
            {/if}
            {#if options}
                <div class="filters">
                    <select
                        value={filter.kinds[0] ?? ""}
                        onchange={(e) =>
                            (filter.kinds = one(
                                e.currentTarget.value,
                            ) as never)}
                    >
                        <option value=""
                            >{localize(
                                "downtime-dnd5e.History.AllKinds",
                            )}</option
                        >
                        {#each options.kinds as o (o.value)}<option
                                value={o.value}>{o.label}</option
                            >{/each}
                    </select>
                    {#if options.methods.length > 1}
                        <select
                            value={filter.methodIds[0] ?? ""}
                            onchange={(e) =>
                                (filter.methodIds = one(e.currentTarget.value))}
                        >
                            <option value=""
                                >{localize(
                                    "downtime-dnd5e.History.AllMethods",
                                )}</option
                            >
                            {#each options.methods as o (o.value)}<option
                                    value={o.value}>{o.label}</option
                                >{/each}
                        </select>
                    {/if}
                    {#if options.bands.length}
                        <select
                            value={filter.bandIds[0] ?? ""}
                            onchange={(e) =>
                                (filter.bandIds = one(e.currentTarget.value))}
                        >
                            <option value=""
                                >{localize(
                                    "downtime-dnd5e.History.AllResults",
                                )}</option
                            >
                            {#each options.bands as o (o.value)}<option
                                    value={o.value}>{o.label}</option
                                >{/each}
                        </select>
                    {/if}
                    {#if options.contributors.length > 1}
                        <select
                            value={filter.contributorKeys[0] ?? ""}
                            onchange={(e) =>
                                (filter.contributorKeys = one(
                                    e.currentTarget.value,
                                ))}
                        >
                            <option value=""
                                >{localize(
                                    "downtime-dnd5e.History.Everyone",
                                )}</option
                            >
                            {#each options.contributors as o (o.value)}<option
                                    value={o.value}>{o.label}</option
                                >{/each}
                        </select>
                    {/if}
                    <label class="toggle"
                        ><input
                            type="checkbox"
                            bind:checked={filter.showReverted}
                        />
                        {localize("downtime-dnd5e.History.ShowReverted")}</label
                    >
                    {#if isGM}
                        <button
                            type="button"
                            class="small"
                            disabled={busy || !events.some((e) => !e.dismissed)}
                            onclick={markAllReviewed}
                            title={localize(
                                "downtime-dnd5e.History.MarkTheEntriesShown",
                            )}
                            ><i class="fas fa-check-double"></i>
                            {localize(
                                "downtime-dnd5e.History.Reviewed",
                            )}</button
                        >
                    {/if}
                </div>
            {/if}

            <table>
                <thead>
                    <tr>
                        <th>{localize("downtime-dnd5e.History.When")}</th>
                        <th>{localize("downtime-dnd5e.History.Who")}</th>
                        <th>{localize("downtime-dnd5e.History.What")}</th>
                        <th>{localize("downtime-dnd5e.History.Progress")}</th>
                        {#if isGM}<th
                                title={localize(
                                    "downtime-dnd5e.History.Reviewed",
                                )}>✓</th
                            >{/if}
                    </tr>
                </thead>
                <tbody>
                    {#each events as event (event.id)}
                        <tr
                            class:reverted={event.isReverted ||
                                event.kind === "REVERT"}
                            class:dismissed={event.dismissed}
                            class:latest={event.id === latestId}
                        >
                            <td
                                class="when"
                                class:unknown={event.timestamp === null}
                                >{formatDate(event.timestamp)}</td
                            >
                            <td>{event.contributorName}</td>
                            <td>
                                <EventDetails
                                    {event}
                                    {isGM}
                                    {busy}
                                    onresolve={(
                                        milestoneEventId,
                                        actionId,
                                        approved,
                                    ) =>
                                        run(() =>
                                            resolveApproval(
                                                item,
                                                milestoneEventId,
                                                actionId,
                                                approved,
                                            ),
                                        )}
                                />
                                {#if event.isReverted}<em class="detail"
                                        >{localize(
                                            "downtime-dnd5e.History.Reverted",
                                        )}</em
                                    >{/if}
                                {#if isGM}
                                    {#if event.note}<div class="note">
                                            <i class="fas fa-note-sticky"></i>
                                            {event.note}
                                        </div>{/if}
                                    <div class="row-tools">
                                        <button
                                            type="button"
                                            class="small"
                                            disabled={busy}
                                            onclick={() => editNote(event)}
                                            title={localize(
                                                event.note
                                                    ? "downtime-dnd5e.History.EditNote"
                                                    : "downtime-dnd5e.History.AddNote",
                                            )}
                                        >
                                            <i
                                                class="fas {event.note
                                                    ? 'fa-pen'
                                                    : 'fa-note-sticky'}"
                                            ></i>
                                        </button>
                                        {#if event.id === latestId}
                                            <button
                                                type="button"
                                                class="small"
                                                disabled={busy ||
                                                    blockers.length > 0}
                                                title={blockers.length
                                                    ? localize(
                                                          "downtime-dnd5e.History.CantRevert",
                                                          {
                                                              reasons:
                                                                  blockers.join(
                                                                      "; ",
                                                                  ),
                                                          },
                                                      )
                                                    : localize(
                                                          "downtime-dnd5e.History.RevertLatest",
                                                      )}
                                                onclick={() =>
                                                    run(() =>
                                                        revertLatest(item),
                                                    )}
                                                ><i class="fas fa-rotate-left"
                                                ></i>
                                                {localize(
                                                    "downtime-dnd5e.History.Revert",
                                                )}</button
                                            >
                                            {#if blockers.length}<span
                                                    class="detail warn"
                                                    >{localize(
                                                        "downtime-dnd5e.History.CantRevert",
                                                        {
                                                            reasons:
                                                                blockers.join(
                                                                    "; ",
                                                                ),
                                                        },
                                                    )}</span
                                                >{/if}
                                        {/if}
                                    </div>
                                {/if}
                            </td>
                            <td class="delta">{eventDelta(event)}</td>
                            {#if isGM}
                                <td>
                                    <input
                                        type="checkbox"
                                        checked={event.dismissed}
                                        disabled={busy}
                                        title={localize(
                                            "downtime-dnd5e.History.MarkAsReviewed",
                                        )}
                                        onchange={() =>
                                            run(() =>
                                                event.dismiss(!event.dismissed),
                                            )}
                                    />
                                </td>
                            {/if}
                        </tr>
                    {:else}
                        <tr
                            ><td colspan={isGM ? 5 : 4} class="empty"
                                >{localize(
                                    "downtime-dnd5e.History.NothingToShow",
                                )}</td
                            ></tr
                        >
                    {/each}
                    {#each quarantined as record, index (index)}
                        <tr class="quarantined">
                            <td class="when unknown">—</td>
                            <td>—</td>
                            <td colspan="3">
                                <i class="fas fa-triangle-exclamation"></i>
                                {localize("downtime-dnd5e.History.Unreadable", {
                                    path: record.path,
                                    reason: localizeText(record.reason),
                                })}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}
    {/if}
</div>

<style>
    .history-window {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        height: 100%;
        overflow-y: auto;
    }
    header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    header img {
        width: 32px;
        height: 32px;
        border: none;
    }
    .title {
        display: flex;
        flex-direction: column;
        flex: 1;
    }
    .title span {
        font-size: 0.85rem;
        opacity: 0.8;
    }
    .tabs {
        display: flex;
        gap: 0.25rem;
    }
    .tabs button {
        width: auto;
    }
    .tabs button.active {
        font-weight: bold;
        border-color: var(--color-border-highlight, #ff6400);
    }
    .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem 0.5rem;
        align-items: center;
    }
    .filters select {
        width: auto;
        flex: 0 1 auto;
    }
    .toggle {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.85rem;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
    }
    th {
        text-align: left;
        border-bottom: 1px solid var(--color-border-light-2, #bbb);
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
    tr.reverted td {
        opacity: 0.6;
    }
    tr.reverted td.delta {
        text-decoration: line-through;
    }
    tr.dismissed td {
        opacity: 0.75;
    }
    tr.latest td:first-child {
        box-shadow: inset 3px 0 0 var(--color-level-info, #3a6ea5);
    }
    tr.quarantined td {
        color: var(--color-level-warning, #c80);
    }
    .row-tools {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        align-items: center;
        margin-top: 0.15rem;
    }
    button.small {
        width: auto;
        line-height: 1.3;
        padding: 0 0.35rem;
        font-size: 0.75rem;
    }
    .note {
        font-size: 0.8rem;
        opacity: 0.85;
    }
    .detail {
        font-size: 0.75rem;
        opacity: 0.75;
    }
    .warn {
        color: var(--color-level-warning, #c80);
        opacity: 1;
    }
    .hint,
    .empty {
        font-size: 0.85rem;
        opacity: 0.7;
        margin: 0;
    }
</style>

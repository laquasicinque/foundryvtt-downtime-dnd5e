<script lang="ts">
    import { localize } from "../../foundry/i18n";
    import type { I18nKey } from "../../types/i18n";
    /**
     * Move / copy dialog. Re-plans live as the GM changes the
     * destination, the mode or any choice; nothing breaks silently.
     */
    import { isCharacterOrNpc } from "../../dnd5e/actors";
    import { hasPlayerOwner, worldActors } from "../../foundry/actors";
    import { notifyInfo } from "../../foundry/notifications";
    import { escapeHTML as escape } from "../../foundry/utils";
    import { untrack } from "svelte";
    import { compareText } from "../../lib/text";
    import type {
        ReferenceChoice,
        TransferChoices,
        TransferMode,
    } from "../../types/transfer";
    import type { Id, StoreRef } from "../../types/data";
    import { storeKey, WORLD_STORE } from "../../model/storage/stores";
    import { v3Api } from "../../runtime/api";

    type Props = {
        store: StoreRef;
        itemIds: Id[];
        /** Fixed destination (a drop); otherwise picked here. */
        dest: StoreRef | null;
        /** COPY: a fresh copy (Ctrl-drop), MOVE: the item itself. */
        mode: TransferMode;
        sheet: { close(): Promise<unknown> };
    };

    const {
        store,
        itemIds,
        dest: initialDest,
        mode: initialMode,
        sheet,
    }: Props = $props();
    // The dialog is for one transfer: the props are fixed for its lifetime.
    const source = untrack(() => store);
    const fixedDest = untrack(() => initialDest);
    const mode = untrack(() => initialMode);

    const CHOICE_LABELS: Record<ReferenceChoice, I18nKey> = {
        INCLUDE: "downtime-dnd5e.Transfer.Choice.INCLUDE",
        COPY_DEPENDENCY: "downtime-dnd5e.Transfer.Choice.COPY_DEPENDENCY",
        REMOVE: "downtime-dnd5e.Transfer.Choice.REMOVE",
        KEEP: "downtime-dnd5e.Transfer.Choice.KEEP",
    };

    /** Places it can go: the world and every character/NPC, minus the source when moving. */
    const destinations = [
        {
            key: "world",
            label: localize("downtime-dnd5e.DowntimeTab.WorldDowntimes"),
            ref: WORLD_STORE as StoreRef,
        },
        ...worldActors()
            .filter(isCharacterOrNpc)
            .sort(
                (a, b) =>
                    Number(hasPlayerOwner(b)) - Number(hasPlayerOwner(a)) ||
                    compareText(a.name ?? "", b.name ?? ""),
            )
            .map((a) => ({
                key: `actor:${a.uuid}`,
                label: a.name ?? a.uuid!,
                ref: { kind: "ACTOR", actorUuid: a.uuid! } as StoreRef,
            })),
    ];

    let destKey = $state(
        fixedDest
            ? storeKey(fixedDest)
            : (destinations.find((d) => d.key !== storeKey(source))?.key ??
                  "world"),
    );
    let choices = $state<TransferChoices>({
        references: {},
        recipients: {},
        categories: {},
    });
    let busy = $state(false);
    let error = $state<string | null>(null);

    const dest = $derived(
        fixedDest ??
            destinations.find((d) => d.key === destKey)?.ref ??
            WORLD_STORE,
    );
    const destLabel = $derived(
        destinations.find((d) => d.key === storeKey(dest))?.label ??
            "another character",
    );
    const same = $derived(storeKey(dest) === storeKey(source));
    // Sync for reactivity: the source's sheet is open, and the destinations are world stores.
    const plan = $derived(
        v3Api.previewTransferSync(
            source,
            itemIds,
            dest,
            mode,
            $state.snapshot(choices) as TransferChoices,
        ),
    );

    const WHY: Record<"DEPENDENCY" | "INCOMING", I18nKey> = {
        DEPENDENCY: "downtime-dnd5e.Transfer.Why.DEPENDENCY",
        INCOMING: "downtime-dnd5e.Transfer.Why.INCOMING",
    };

    async function confirm() {
        busy = true;
        error = null;
        try {
            await v3Api.transfer(
                source,
                itemIds,
                dest,
                mode,
                $state.snapshot(choices) as TransferChoices,
            );
            notifyInfo(
                localize(
                    mode === "MOVE"
                        ? "downtime-dnd5e.Transfer.Moved"
                        : "downtime-dnd5e.Transfer.CopiedCount",
                    { count: plan.entries.length },
                ),
            );
            await sheet.close();
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        } finally {
            busy = false;
        }
    }
</script>

<div class="transfer">
    {#if fixedDest}
        <p class="lead">
            {@html localize(
                mode === "COPY"
                    ? "downtime-dnd5e.Transfer.LeadCopy"
                    : "downtime-dnd5e.Transfer.LeadMove",
                { dest: `<strong>${escape(destLabel)}</strong>` },
            )}
        </p>
    {:else}
        <div class="row">
            <label
                >{localize("downtime-dnd5e.Transfer.MoveTo")}
                <select bind:value={destKey}>
                    {#each destinations as d (d.key)}
                        <option
                            value={d.key}
                            disabled={d.key === storeKey(source)}
                            >{d.key === storeKey(source)
                                ? localize(
                                      "downtime-dnd5e.Transfer.WhereItIs",
                                      {
                                          store: d.label,
                                      },
                                  )
                                : d.label}</option
                        >
                    {/each}
                </select>
            </label>
        </div>
        <p class="detail">
            {localize("downtime-dnd5e.Transfer.ToCopyInsteadDuplicate")}
        </p>
    {/if}

    <section>
        <h4>{localize("downtime-dnd5e.Transfer.Items")}</h4>
        <ul>
            {#each plan.entries as entry (entry.sourceId)}
                <li>
                    {entry.name}
                    {#if entry.why !== "SELECTED"}<span class="detail"
                            >— {localize(WHY[entry.why])}</span
                        >{/if}
                    {#if entry.mode !== mode}<span class="detail"
                            >{localize("downtime-dnd5e.Transfer.Copied")}</span
                        >{/if}
                    {#if entry.destId !== entry.sourceId}<span class="detail"
                            >{localize(
                                "downtime-dnd5e.Transfer.NewIdOneWith",
                            )}</span
                        >{/if}
                </li>
            {/each}
        </ul>
    </section>

    {#if plan.references.length}
        <section>
            <h4>{localize("downtime-dnd5e.Transfer.LinksToOtherTracked")}</h4>
            {#each plan.references as issue (issue.key)}
                <div class="issue">
                    <span>
                        {#if issue.direction === "OUTGOING"}
                            {@html localize(
                                issue.site.kind === "ACTION"
                                    ? "downtime-dnd5e.Transfer.OutgoingAdjusts"
                                    : "downtime-dnd5e.Transfer.OutgoingRequires",
                                {
                                    item: `<strong>${escape(issue.itemName)}</strong>`,
                                    target: `<strong>${escape(issue.targetName ?? localize("downtime-dnd5e.Transfer.MissingItem"))}</strong>`,
                                },
                            )}
                        {:else}
                            {@html localize(
                                issue.site.kind === "ACTION"
                                    ? "downtime-dnd5e.Transfer.IncomingAdjusts"
                                    : "downtime-dnd5e.Transfer.IncomingRequires",
                                {
                                    item: `<strong>${escape(issue.itemName)}</strong>`,
                                    target: `<strong>${escape(issue.targetName ?? "")}</strong>`,
                                },
                            )}
                        {/if}
                    </span>
                    <select
                        value={issue.choice}
                        onchange={(e) =>
                            (choices.references![issue.key] = e.currentTarget
                                .value as ReferenceChoice)}
                    >
                        {#each issue.options as option (option)}<option
                                value={option}
                                >{localize(CHOICE_LABELS[option])}</option
                            >{/each}
                    </select>
                </div>
            {/each}
        </section>
    {/if}

    {#if plan.recipients.length}
        <section>
            <h4>{localize("downtime-dnd5e.Transfer.RewardsForThisItem")}</h4>
            {#each plan.recipients as issue (issue.key)}
                <div class="issue">
                    <span
                        >{@html localize(
                            "downtime-dnd5e.Transfer.OwnCharacterReward",
                            {
                                item: `<strong>${escape(issue.itemName)}</strong>`,
                            },
                        )}</span
                    >
                    <select
                        value={issue.choice}
                        onchange={(e) =>
                            (choices.recipients![issue.key] = e.currentTarget
                                .value as "SWITCH" | "KEEP")}
                    >
                        <option value="SWITCH"
                            >{localize(
                                "downtime-dnd5e.Transfer.GiveItToWhoever",
                            )}</option
                        >
                        <option value="KEEP"
                            >{localize(
                                "downtime-dnd5e.Transfer.KeepItTheAction",
                            )}</option
                        >
                    </select>
                </div>
            {/each}
        </section>
    {/if}

    {#if plan.categories.length}
        <section>
            <h4>{localize("downtime-dnd5e.Transfer.Categories")}</h4>
            {#each plan.categories as issue (issue.name)}
                <div class="issue">
                    <span
                        >{localize("downtime-dnd5e.Transfer.NoCategory", {
                            category: issue.name,
                        })}</span
                    >
                    <select
                        value={issue.choice}
                        onchange={(e) =>
                            (choices.categories![issue.name] = e.currentTarget
                                .value as "CREATE" | "UNCATEGORISED")}
                    >
                        <option value="CREATE"
                            >{localize(
                                "downtime-dnd5e.Transfer.CreateIt",
                            )}</option
                        >
                        <option value="UNCATEGORISED"
                            >{localize(
                                "downtime-dnd5e.Transfer.PutInUncategorised",
                            )}</option
                        >
                    </select>
                </div>
            {/each}
        </section>
    {/if}

    {#if error}<p class="error">{error}</p>{/if}
    <footer>
        <button
            type="button"
            disabled={busy || (same && mode === "MOVE") || !plan.entries.length}
            onclick={confirm}
        >
            <i
                class="fas {mode === 'MOVE'
                    ? 'fa-truck-arrow-right'
                    : 'fa-copy'}"
            ></i>
            {localize(
                mode === "MOVE"
                    ? "downtime-dnd5e.Transfer.MoveItems"
                    : "downtime-dnd5e.Transfer.CopyItems",
                { count: plan.entries.length },
            )}
        </button>
    </footer>
</div>

<style>
    .transfer {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        height: 100%;
        overflow-y: auto;
    }
    .row {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    .lead {
        margin: 0;
        font-size: 0.9rem;
    }
    .row label {
        flex: 1 1 12rem;
        display: flex;
        flex-direction: column;
        font-size: 0.85rem;
    }
    h4 {
        margin: 0.25rem 0;
        font-size: 0.9rem;
        border: none;
    }
    ul {
        margin: 0;
        padding-left: 1.1rem;
        font-size: 0.85rem;
    }
    .issue {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem 0.5rem;
        align-items: center;
        font-size: 0.85rem;
        padding: 0.2rem 0;
        border-bottom: 1px solid var(--color-border-light-1, #ddd);
    }
    .issue span {
        flex: 1 1 14rem;
    }
    .issue select {
        flex: 0 1 auto;
        width: auto;
    }
    .detail {
        opacity: 0.7;
        font-size: 0.8rem;
    }
    .error {
        color: var(--color-level-error, #c00);
        margin: 0;
    }
    footer {
        margin-top: auto;
        display: flex;
        justify-content: flex-end;
    }
    footer button {
        width: auto;
    }
</style>

<script lang="ts">
    import { localize } from "../../foundry/i18n";
    /**
     * Contribution summary: totals per method, contributor and
     * result, and contributor × method. Players see only their own.
     */
    import type { TrackedItem } from "../../domain/TrackedItem";
    import {
        UNATTRIBUTED,
        type ContributionTotals,
    } from "../../model/rules/contributions";
    import { contributorDisplayName } from "../../model/rules/contributor";
    import type { HistoryViewer } from "../../model/views/historyView";
    import { contributorNames } from "../../runtime/api";
    import { signed } from "../describe";

    type Props = { item: TrackedItem; viewer: HistoryViewer };

    const { item, viewer }: Props = $props();

    const names = contributorNames;

    const totals = $derived(
        viewer.isGM ? item.contributions() : item.contributions({ viewer }),
    );

    /** Method names: live first, then the name recorded on its events. */
    const methodNames = $derived.by(() => {
        const map = new Map<string, string>([
            [
                UNATTRIBUTED,
                localize("downtime-dnd5e.Contributions.Unattributed"),
            ],
        ]);
        for (const event of item.data.history)
            if (event.kind === "METHOD")
                map.set(event.methodId, event.method.name);
        for (const method of item.methods) map.set(method.id, method.name);
        return map;
    });

    const bandNames = $derived.by(() => {
        const map = new Map<string, string>();
        for (const event of item.data.history)
            if (event.kind === "METHOD" && event.band)
                map.set(
                    event.band.id,
                    // Fixed methods record their own name as the result label.
                    event.band.label === event.method.name
                        ? event.method.name
                        : localize(
                              "downtime-dnd5e.Contributions.MethodResult",
                              {
                                  method: event.method.name,
                                  result:
                                      event.band.label ||
                                      localize(
                                          "downtime-dnd5e.History.UnlabelledResult",
                                      ),
                              },
                          ),
                );
        return map;
    });

    const rows = <T>(record: Record<string, T>) =>
        Object.entries(record) as [string, T][];

    const contributorRows = $derived(
        rows(totals.byContributor).map(([key, t]) => ({
            key,
            label: contributorDisplayName(t.contributor, names),
            totals: t as ContributionTotals,
        })),
    );
    const methodIds = $derived(Object.keys(totals.byMethod));
</script>

{#snippet header(first: string)}
    <tr>
        <th>{first}</th>
        <th title={localize("downtime-dnd5e.Contributions.NetProgress")}
            >{localize("downtime-dnd5e.Contributions.Net")}</th
        >
        <th title={localize("downtime-dnd5e.Contributions.ProgressGained")}
            >+</th
        >
        <th title={localize("downtime-dnd5e.Contributions.ProgressLost")}>−</th>
        <th title={localize("downtime-dnd5e.Contributions.MethodUses")}
            >{localize("downtime-dnd5e.Contributions.Uses")}</th
        >
        <th title={localize("downtime-dnd5e.Contributions.Successes")}>✓</th>
        <th title={localize("downtime-dnd5e.Contributions.Failures")}>✗</th>
    </tr>
{/snippet}

{#snippet line(label: string, t: ContributionTotals, strong = false)}
    <tr class:strong>
        <td>{label}</td>
        <td>{signed(t.net)}</td>
        <td>{t.gained ? `+${t.gained}` : ""}</td>
        <td>{t.lost || ""}</td>
        <td>{t.attempts || ""}</td>
        <td>{t.successes || ""}</td>
        <td>{t.failures || ""}</td>
    </tr>
{/snippet}

<div class="contributions">
    {#if !viewer.isGM}
        <p class="hint">
            {localize("downtime-dnd5e.Contributions.YourContributionsOnly")}
        </p>
    {/if}
    {#if totals.total.attempts === 0 && totals.total.net === 0 && totals.total.gained === 0}
        <p class="hint">
            {localize("downtime-dnd5e.Contributions.NoContributionsYet")}
        </p>
    {:else}
        <h4>{localize("downtime-dnd5e.Contributions.ByContributor")}</h4>
        <table>
            <thead
                >{@render header(
                    localize("downtime-dnd5e.Contributions.Who"),
                )}</thead
            >
            <tbody>
                {#each contributorRows as row (row.key)}
                    {@render line(row.label, row.totals)}
                {/each}
                {@render line(
                    localize("downtime-dnd5e.Contributions.Total"),
                    totals.total,
                    true,
                )}
            </tbody>
        </table>

        <h4>{localize("downtime-dnd5e.Contributions.ByMethod")}</h4>
        <table>
            <thead
                >{@render header(
                    localize("downtime-dnd5e.Contributions.Method"),
                )}</thead
            >
            <tbody>
                {#each rows(totals.byMethod) as [id, t] (id)}
                    {@render line(
                        methodNames.get(id) ??
                            localize(
                                "downtime-dnd5e.Contributions.DeletedMethod",
                            ),
                        t,
                    )}
                {/each}
            </tbody>
        </table>

        {#if Object.keys(totals.byBand).length}
            <h4>{localize("downtime-dnd5e.Contributions.ByResult")}</h4>
            <table>
                <thead
                    >{@render header(
                        localize("downtime-dnd5e.Contributions.Result"),
                    )}</thead
                >
                <tbody>
                    {#each rows(totals.byBand) as [id, t] (id)}
                        {@render line(bandNames.get(id) ?? id, t)}
                    {/each}
                </tbody>
            </table>
        {/if}

        {#if contributorRows.length > 1 && methodIds.length > 1}
            <h4>
                {localize(
                    "downtime-dnd5e.Contributions.NetProgressContributorMethod",
                )}
            </h4>
            <table>
                <thead>
                    <tr>
                        <th>{localize("downtime-dnd5e.Contributions.Who")}</th>
                        {#each methodIds as id (id)}<th
                                >{methodNames.get(id) ??
                                    localize(
                                        "downtime-dnd5e.Contributions.DeletedMethod",
                                    )}</th
                            >{/each}
                    </tr>
                </thead>
                <tbody>
                    {#each contributorRows as row (row.key)}
                        <tr>
                            <td>{row.label}</td>
                            {#each methodIds as id (id)}
                                {@const t =
                                    totals.byContributorAndMethod[row.key]?.[
                                        id
                                    ]}
                                <td
                                    >{t
                                        ? `${signed(t.net)} (${t.attempts})`
                                        : ""}</td
                                >
                            {/each}
                        </tr>
                    {/each}
                </tbody>
            </table>
            <p class="hint">
                {localize("downtime-dnd5e.Contributions.NetProgressUsesPer")}
            </p>
        {/if}
    {/if}
</div>

<style>
    .contributions {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    h4 {
        margin: 0.5rem 0 0;
        font-size: 0.9rem;
        border: none;
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
        padding: 0.15rem 0.25rem;
        border-bottom: 1px solid var(--color-border-light-1, #ddd);
    }
    tr.strong td {
        font-weight: bold;
    }
    .hint {
        font-size: 0.85rem;
        opacity: 0.7;
        margin: 0;
    }
</style>

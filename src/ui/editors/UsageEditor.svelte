<script lang="ts">
    import type { I18nKey } from "../../types/i18n";
    import { localize } from "../../foundry/i18n";
    /**
     * Usage rule editor: what counts as a use, whose uses count
     * together, and what changes from the Nth use on.
     */
    import { randomId } from "../../foundry/utils";
    import {
        defaultTier,
        defaultUsageRule,
        sortTiers,
        tierKindsFor,
    } from "../../model/authoring/editing";
    import { usageProblems } from "../../model/rules/usage";
    import type {
        MethodData,
        ResultTable,
        UsageRule,
        UsageTier,
    } from "../../types/data";
    import BandsEditor from "./BandsEditor.svelte";
    import DeltaInput from "./DeltaInput.svelte";

    type Props = {
        method: MethodData;
        onchange: (usage: UsageRule | null) => void;
    };

    const { method, onchange }: Props = $props();

    const usage = $derived(method.usage);
    const snapshot = () => $state.snapshot(method.usage) as UsageRule;

    const TIER_LABELS: Record<UsageTier["kind"], I18nKey> = {
        NORMAL: "downtime-dnd5e.UsageEditor.Tier.NORMAL",
        RESULTS: "downtime-dnd5e.UsageEditor.Tier.RESULTS",
        EFFECT: "downtime-dnd5e.UsageEditor.Tier.EFFECT",
        DISABLE: "downtime-dnd5e.UsageEditor.Tier.DISABLE",
        HIDE: "downtime-dnd5e.UsageEditor.Tier.HIDE",
    };

    const bands = $derived(
        "results" in method && method.results ? method.results.bands : [],
    );
    const dc = $derived("dc" in method ? method.dc : null);

    function patch(fields: Partial<UsageRule>) {
        onchange(sortTiers({ ...snapshot(), ...fields }));
    }

    function patchTier(index: number, tier: UsageTier) {
        const rule = snapshot();
        onchange(
            sortTiers({
                ...rule,
                tiers: rule.tiers.map((t, i) => (i === index ? tier : t)),
            }),
        );
    }

    function addTier() {
        const rule = snapshot();
        const from = (rule.tiers.at(-1)?.from ?? 0) + 2;
        const kind = tierKindsFor(method.kind).includes("DISABLE")
            ? "DISABLE"
            : "NORMAL";
        onchange(
            sortTiers({
                ...rule,
                tiers: [
                    ...rule.tiers,
                    defaultTier(
                        kind,
                        from,
                        $state.snapshot(method) as MethodData,
                        randomId,
                    ),
                ],
            }),
        );
    }

    function removeTier(index: number) {
        const rule = snapshot();
        onchange({ ...rule, tiers: rule.tiers.filter((_, i) => i !== index) });
    }

    function toggleBand(id: string, on: boolean) {
        const rule = snapshot();
        const current = rule.count.kind === "BANDS" ? rule.count.bandIds : [];
        patch({
            count: {
                kind: "BANDS",
                bandIds: on
                    ? [...current, id]
                    : current.filter((b) => b !== id),
            },
        });
    }
</script>

<div class="usage-editor">
    <label class="check">
        <input
            type="checkbox"
            checked={!!usage}
            onchange={(e) =>
                onchange(e.currentTarget.checked ? defaultUsageRule() : null)}
        />
        {localize("downtime-dnd5e.UsageEditor.LimitOrChangeThis")}
    </label>

    {#if usage}
        <div class="row">
            <label
                >{localize("downtime-dnd5e.UsageEditor.Count")}
                <select
                    value={usage.count.kind}
                    onchange={(e) => {
                        const kind = e.currentTarget
                            .value as UsageRule["count"]["kind"];
                        patch({
                            count:
                                kind === "BANDS"
                                    ? { kind, bandIds: [] }
                                    : { kind },
                        });
                    }}
                >
                    <option value="ATTEMPTS"
                        >{localize(
                            "downtime-dnd5e.UsageEditor.EveryUse",
                        )}</option
                    >
                    <option value="SUCCESSES"
                        >{localize(
                            "downtime-dnd5e.UsageEditor.Successes",
                        )}</option
                    >
                    <option value="FAILURES"
                        >{localize(
                            "downtime-dnd5e.UsageEditor.Failures",
                        )}</option
                    >
                    {#if bands.length}<option value="BANDS"
                            >{localize(
                                "downtime-dnd5e.UsageEditor.SpecificResults",
                            )}</option
                        >{/if}
                </select>
            </label>
            <label
                >{localize("downtime-dnd5e.UsageEditor.Counted")}
                <select
                    value={usage.per}
                    onchange={(e) =>
                        patch({
                            per: e.currentTarget.value as UsageRule["per"],
                        })}
                >
                    <option value="ACTOR"
                        >{localize(
                            "downtime-dnd5e.UsageEditor.PerCharacter",
                        )}</option
                    >
                    <option value="USER"
                        >{localize(
                            "downtime-dnd5e.UsageEditor.PerPlayer",
                        )}</option
                    >
                    <option value="ITEM"
                        >{localize(
                            "downtime-dnd5e.UsageEditor.ForEveryoneTogether",
                        )}</option
                    >
                </select>
            </label>
        </div>
        {#if usage.count.kind === "BANDS"}
            {@const selected = usage.count.bandIds}
            <div class="bands">
                {#each bands as band, index (band.id)}
                    <label class="check">
                        <input
                            type="checkbox"
                            checked={selected.includes(band.id)}
                            onchange={(e) =>
                                toggleBand(band.id, e.currentTarget.checked)}
                        />
                        {band.label ||
                            localize(
                                band.when.length
                                    ? "downtime-dnd5e.UsageEditor.ResultN"
                                    : "downtime-dnd5e.BandsEditor.Otherwise",
                                { n: index + 1 },
                            )}
                    </label>
                {/each}
            </div>
        {/if}

        <div class="tiers">
            <div class="tier first">
                {localize("downtime-dnd5e.UsageEditor.Uses0Normal")}
            </div>
            {#each usage.tiers as tier, index (index)}
                <div class="tier">
                    <div class="row">
                        <label class="inline"
                            >{localize("downtime-dnd5e.UsageEditor.FromUse")}
                            <input
                                type="number"
                                min="0"
                                value={tier.from}
                                onchange={(e) => {
                                    const from = Math.max(
                                        0,
                                        Math.floor(
                                            e.currentTarget.valueAsNumber || 0,
                                        ),
                                    );
                                    patchTier(index, {
                                        ...$state.snapshot(tier),
                                        from,
                                    } as UsageTier);
                                }}
                            />
                        </label>
                        <select
                            value={tier.kind}
                            onchange={(e) =>
                                patchTier(
                                    index,
                                    defaultTier(
                                        e.currentTarget
                                            .value as UsageTier["kind"],
                                        tier.from,
                                        $state.snapshot(method) as MethodData,
                                        randomId,
                                    ),
                                )}
                        >
                            {#each tierKindsFor(method.kind) as kind (kind)}<option
                                    value={kind}
                                    >{localize(TIER_LABELS[kind])}</option
                                >{/each}
                        </select>
                        <button
                            type="button"
                            class="icon"
                            onclick={() => removeTier(index)}
                            title={localize(
                                "downtime-dnd5e.UsageEditor.RemoveTier",
                            )}><i class="fas fa-trash"></i></button
                        >
                    </div>
                    {#if tier.kind === "DISABLE"}
                        <input
                            type="text"
                            placeholder={localize(
                                "downtime-dnd5e.UsageEditor.MessageShownWhenIt",
                            )}
                            value={tier.hint ?? ""}
                            oninput={(e) =>
                                patchTier(index, {
                                    ...tier,
                                    hint: e.currentTarget.value || null,
                                })}
                        />
                    {:else if tier.kind === "EFFECT"}
                        <DeltaInput
                            delta={tier.effect.delta}
                            onchange={(delta) =>
                                patchTier(index, {
                                    ...tier,
                                    effect: { delta },
                                })}
                        />
                    {:else if tier.kind === "RESULTS"}
                        <BandsEditor
                            table={tier.results}
                            {dc}
                            onchange={(results: ResultTable) =>
                                patchTier(index, { ...tier, results })}
                        />
                    {/if}
                </div>
            {/each}
            <button type="button" class="add" onclick={addTier}
                ><i class="fas fa-plus"></i>
                {localize("downtime-dnd5e.UsageEditor.AddAStep")}</button
            >
            <p class="hint">
                {localize("downtime-dnd5e.UsageEditor.FromUseNMeans")}
            </p>
            {#each usageProblems( usage, bands.map((b) => b.id), localize ) as problem (problem)}
                <p class="problem">
                    <i class="fas fa-triangle-exclamation"></i>
                    {problem}
                </p>
            {/each}
        </div>
    {/if}
</div>

<style>
    .usage-editor {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem 0.5rem;
        align-items: end;
    }
    .row > label {
        flex: 1 1 8rem;
    }
    label {
        display: flex;
        flex-direction: column;
        font-size: 0.85rem;
    }
    label.check,
    label.inline {
        flex-direction: row;
        align-items: center;
        gap: 0.25rem;
    }
    label.inline input {
        width: 4.5rem;
    }
    .bands {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem 0.75rem;
    }
    .tiers {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .tier {
        border-left: 3px solid var(--color-border-light-2, #bbb);
        padding: 0.2rem 0.4rem;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }
    .tier.first {
        font-size: 0.8rem;
        opacity: 0.7;
    }
    .tier select {
        width: auto;
        flex: 1 1 10rem;
    }
    button.icon {
        width: 1.75rem;
        flex: none;
    }
    button.add {
        width: auto;
        align-self: flex-start;
    }
    .problem {
        font-size: 0.8rem;
        margin: 0;
        color: var(--color-level-warning, #c80);
    }
    .hint {
        font-size: 0.75rem;
        opacity: 0.7;
        margin: 0;
    }
</style>

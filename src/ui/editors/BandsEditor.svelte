<script lang="ts">
    import { localize } from "../../foundry/i18n";
    /**
     * Result-band ladder. Plain list in evaluation order: first
     * match wins, the last "otherwise" row is fixed. Thresholds show their
     * resulting totals for the current DC.
     */
    import { randomId } from "../../foundry/utils";
    import {
        describeCondition,
        insertBand,
        isOtherwise,
        moveBand,
        newConditionalBand,
        removeBand,
        updateBand,
    } from "../../model/authoring/editing";
    import type {
        BandCondition,
        CountsAs,
        ResultBand,
        ResultTable,
    } from "../../types/data";
    import DeltaInput from "./DeltaInput.svelte";

    type Props = {
        table: ResultTable;
        dc: number | null;
        onchange: (table: ResultTable) => void;
    };

    const { table, dc, onchange }: Props = $props();

    const snapshot = () => $state.snapshot(table) as ResultTable;

    function patchBand(index: number, fields: Partial<ResultBand>) {
        onchange(updateBand(snapshot(), index, fields));
    }

    function patchCondition(
        bandIndex: number,
        conditionIndex: number,
        fields: Partial<BandCondition>,
    ) {
        const band = snapshot().bands[bandIndex]!;
        const when = band.when.map((c, i) =>
            i === conditionIndex ? { ...c, ...fields } : c,
        );
        patchBand(bandIndex, { when });
    }

    function addCondition(bandIndex: number) {
        const band = snapshot().bands[bandIndex]!;
        patchBand(bandIndex, {
            when: [...band.when, { on: "NATURAL", op: "eq", value: 20 }],
        });
    }

    function removeCondition(bandIndex: number, conditionIndex: number) {
        const band = snapshot().bands[bandIndex]!;
        if (band.when.length <= 1) return; // a conditional band keeps at least one condition
        patchBand(bandIndex, {
            when: band.when.filter((_, i) => i !== conditionIndex),
        });
    }

    function add(index: number, where: "above" | "below") {
        onchange(
            insertBand(
                snapshot(),
                index,
                where,
                newConditionalBand(randomId, dc !== null),
            ),
        );
    }
</script>

<div class="bands">
    <div class="title">
        {localize("downtime-dnd5e.BandsEditor.Results")}
        <span class="hint"
            >{localize("downtime-dnd5e.BandsEditor.CheckedTopToBottom")}</span
        >
    </div>
    {#each table.bands as band, index (band.id)}
        {@const otherwise =
            isOtherwise(band) && index === table.bands.length - 1}
        <div class="band" class:otherwise>
            <div class="when">
                {#if otherwise}
                    <strong
                        >{localize(
                            "downtime-dnd5e.BandsEditor.Otherwise",
                        )}</strong
                    >
                {:else}
                    {#each band.when as condition, ci (ci)}
                        <div class="condition">
                            <select
                                value={condition.on}
                                onchange={(e) =>
                                    patchCondition(index, ci, {
                                        on: e.currentTarget
                                            .value as BandCondition["on"],
                                    })}
                            >
                                <option value="MARGIN" disabled={dc === null}
                                    >{localize(
                                        "downtime-dnd5e.BandsEditor.TotalVsDC",
                                    )}</option
                                >
                                <option value="TOTAL"
                                    >{localize(
                                        "downtime-dnd5e.BandsEditor.Total",
                                    )}</option
                                >
                                <option value="NATURAL"
                                    >{localize(
                                        "downtime-dnd5e.BandsEditor.NaturalD20",
                                    )}</option
                                >
                            </select>
                            <select
                                value={condition.op}
                                onchange={(e) =>
                                    patchCondition(index, ci, {
                                        op: e.currentTarget
                                            .value as BandCondition["op"],
                                    })}
                            >
                                <option value="gte">≥</option>
                                <option value="gt">&gt;</option>
                                <option value="eq">=</option>
                                <option value="lte">≤</option>
                                <option value="lt">&lt;</option>
                            </select>
                            <input
                                type="number"
                                value={condition.value}
                                oninput={(e) => {
                                    const value = e.currentTarget.valueAsNumber;
                                    if (Number.isFinite(value))
                                        patchCondition(index, ci, { value });
                                }}
                            />
                            <span class="preview"
                                >{describeCondition(
                                    condition,
                                    dc,
                                    localize,
                                )}</span
                            >
                            {#if band.when.length > 1}
                                <button
                                    type="button"
                                    class="icon"
                                    onclick={() => removeCondition(index, ci)}
                                    title={localize(
                                        "downtime-dnd5e.BandsEditor.RemoveCondition",
                                    )}><i class="fas fa-xmark"></i></button
                                >
                            {/if}
                        </div>
                    {/each}
                    <button
                        type="button"
                        class="link"
                        onclick={() => addCondition(index)}
                        >{localize("downtime-dnd5e.BandsEditor.And")}</button
                    >
                {/if}
            </div>
            <div class="effect">
                <DeltaInput
                    delta={band.effect.delta}
                    onchange={(delta) =>
                        patchBand(index, { effect: { delta } })}
                />
                <label
                    >{localize("downtime-dnd5e.BandsEditor.CountsAs")}
                    <select
                        value={band.countsAs ?? ""}
                        onchange={(e) =>
                            patchBand(index, {
                                countsAs: (e.currentTarget.value ||
                                    null) as CountsAs,
                            })}
                    >
                        <option value="SUCCESS"
                            >{localize(
                                "downtime-dnd5e.BandsEditor.Success",
                            )}</option
                        >
                        <option value="FAILURE"
                            >{localize(
                                "downtime-dnd5e.BandsEditor.Failure",
                            )}</option
                        >
                        <option value=""
                            >{localize(
                                "downtime-dnd5e.BandsEditor.Neither",
                            )}</option
                        >
                    </select>
                </label>
                <label
                    >{localize("downtime-dnd5e.BandsEditor.Label")}
                    <input
                        type="text"
                        value={band.label}
                        placeholder={localize(
                            "downtime-dnd5e.BandsEditor.EGCritical",
                        )}
                        oninput={(e) =>
                            patchBand(index, { label: e.currentTarget.value })}
                    /></label
                >
            </div>
            <div class="controls">
                <button
                    type="button"
                    class="icon"
                    onclick={() => add(index, "above")}
                    title={localize("downtime-dnd5e.BandsEditor.AddABandAbove")}
                    ><i class="fas fa-arrow-turn-up"></i></button
                >
                {#if !otherwise}
                    <button
                        type="button"
                        class="icon"
                        onclick={() => add(index, "below")}
                        title={localize(
                            "downtime-dnd5e.BandsEditor.AddABandBelow",
                        )}><i class="fas fa-arrow-turn-down"></i></button
                    >
                    <button
                        type="button"
                        class="icon"
                        onclick={() =>
                            onchange(moveBand(snapshot(), index, -1))}
                        title={localize("downtime-dnd5e.BandsEditor.MoveUp")}
                        ><i class="fas fa-arrow-up"></i></button
                    >
                    <button
                        type="button"
                        class="icon"
                        onclick={() => onchange(moveBand(snapshot(), index, 1))}
                        title={localize("downtime-dnd5e.BandsEditor.MoveDown")}
                        ><i class="fas fa-arrow-down"></i></button
                    >
                    <button
                        type="button"
                        class="icon"
                        onclick={() => onchange(removeBand(snapshot(), index))}
                        title={localize("downtime-dnd5e.BandsEditor.Remove")}
                        ><i class="fas fa-trash"></i></button
                    >
                {/if}
            </div>
        </div>
    {/each}
</div>

<style>
    .bands {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .title {
        font-weight: bold;
        font-size: 0.85rem;
    }
    .hint {
        font-weight: normal;
        opacity: 0.7;
        font-size: 0.75rem;
    }
    .band {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: 0.5rem;
        border-left: 3px solid var(--color-border-light-2, #bbb);
        padding: 0.25rem 0.5rem;
    }
    .band.otherwise {
        border-left-style: dashed;
    }
    .condition {
        display: flex;
        gap: 0.25rem;
        align-items: center;
        flex-wrap: wrap;
    }
    .condition select {
        width: auto;
    }
    .condition input {
        width: 4rem;
    }
    .preview {
        font-size: 0.75rem;
        opacity: 0.7;
    }
    .effect {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    label {
        display: flex;
        flex-direction: column;
        font-size: 0.8rem;
    }
    .controls {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
    }
    button.icon {
        width: 1.75rem;
        height: 1.5rem;
        line-height: 1;
        padding: 0;
    }
    button.link {
        all: unset;
        cursor: pointer;
        font-size: 0.75rem;
        opacity: 0.8;
    }
</style>

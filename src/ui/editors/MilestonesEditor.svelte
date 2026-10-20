<script lang="ts">
    import { localize } from "../../foundry/i18n";
    /** Milestones and their actions. */
    import { randomId } from "../../foundry/utils";
    import {
        ACTION_KIND_LABELS,
        defaultAction,
        defaultMilestone,
    } from "../../model/authoring/editing";
    import { milestoneProblems } from "../../model/rules/milestones";
    import type {
        MethodData,
        MilestoneAction,
        MilestoneData,
        ProgressConfig,
        StoreRef,
        TrackedItemData,
    } from "../../types/data";
    import ActionEditor from "./ActionEditor.svelte";

    type Props = {
        milestones: MilestoneData[];
        onchange: (milestones: MilestoneData[]) => void;
        store: StoreRef;
        methods: readonly MethodData[];
        items: readonly TrackedItemData[];
        target: number | null;
        progress: ProgressConfig;
    };

    const {
        milestones,
        onchange,
        store,
        methods,
        items,
        target,
        progress,
    }: Props = $props();

    const checkContext = $derived({ store, progress, items, t: localize });

    const snapshot = () => $state.snapshot(milestones) as MilestoneData[];

    let newActionKind = $state<Record<string, MilestoneAction["kind"]>>({});

    function patch(index: number, fields: Partial<MilestoneData>) {
        onchange(
            snapshot().map((m, i) => (i === index ? { ...m, ...fields } : m)),
        );
    }

    function add() {
        onchange([...snapshot(), defaultMilestone(randomId, target ?? 10)]);
    }

    function remove(index: number) {
        onchange(snapshot().filter((_, i) => i !== index));
    }

    function setActions(index: number, actions: MilestoneAction[]) {
        patch(index, { actions });
    }

    /** "once" (1) / "every time" (null) / "N times". */
    function timesValue(maxTimes: number | null) {
        return maxTimes === null ? "every" : maxTimes === 1 ? "once" : "n";
    }
</script>

<div class="milestones">
    {#each milestones as milestone, index (milestone.id)}
        <div class="milestone">
            <div class="row">
                <input
                    type="text"
                    class="label"
                    placeholder={localize(
                        "downtime-dnd5e.MilestonesEditor.LabelEGTrusted",
                    )}
                    value={milestone.label}
                    oninput={(e) =>
                        patch(index, { label: e.currentTarget.value })}
                />
                <select
                    value={milestone.match}
                    onchange={(e) =>
                        patch(index, {
                            match: e.currentTarget
                                .value as MilestoneData["match"],
                        })}
                >
                    <option value="CROSS"
                        >{localize(
                            "downtime-dnd5e.MilestonesEditor.WhenProgressReaches",
                        )}</option
                    >
                    <option value="EXACT"
                        >{localize(
                            "downtime-dnd5e.MilestonesEditor.WhenProgressIsExactly",
                        )}</option
                    >
                    <option value="EVERY"
                        >{localize(
                            "downtime-dnd5e.MilestonesEditor.Every",
                        )}</option
                    >
                </select>
                <input
                    type="number"
                    class="at"
                    value={milestone.at}
                    oninput={(e) => {
                        const at = e.currentTarget.valueAsNumber;
                        if (Number.isFinite(at)) patch(index, { at });
                    }}
                />
                <select
                    value={timesValue(milestone.maxTimes)}
                    onchange={(e) => {
                        const v = e.currentTarget.value;
                        patch(index, {
                            maxTimes:
                                v === "every"
                                    ? null
                                    : v === "once"
                                      ? 1
                                      : Math.max(2, milestone.maxTimes ?? 2),
                        });
                    }}
                >
                    <option value="once"
                        >{localize(
                            "downtime-dnd5e.MilestonesEditor.Once",
                        )}</option
                    >
                    <option value="n"
                        >{localize(
                            "downtime-dnd5e.MilestonesEditor.NTimes",
                        )}</option
                    >
                    <option value="every"
                        >{localize(
                            "downtime-dnd5e.MilestonesEditor.EveryTime",
                        )}</option
                    >
                </select>
                {#if milestone.maxTimes !== null && milestone.maxTimes > 1}
                    <input
                        type="number"
                        class="at"
                        min="2"
                        value={milestone.maxTimes}
                        oninput={(e) =>
                            patch(index, {
                                maxTimes: Math.max(
                                    2,
                                    Math.floor(
                                        e.currentTarget.valueAsNumber || 2,
                                    ),
                                ),
                            })}
                    />
                {/if}
                <button
                    type="button"
                    class="icon"
                    onclick={() => remove(index)}
                    title={localize(
                        "downtime-dnd5e.MilestonesEditor.RemoveMilestone",
                    )}><i class="fas fa-trash"></i></button
                >
            </div>
            {#if milestone.match === "EVERY"}
                <p class="hint">
                    {localize("downtime-dnd5e.MilestonesEditor.RepeatsHint", {
                        at: milestone.at,
                    })}
                </p>
            {:else if milestone.match === "EXACT"}
                <p class="hint">
                    {localize("downtime-dnd5e.MilestonesEditor.ExactHint", {
                        at: milestone.at,
                    })}
                </p>
            {/if}
            {#each milestoneProblems(milestone, checkContext) as problem (problem.message)}
                <p class="problem" class:blocking={problem.blocking}>
                    <i class="fas fa-triangle-exclamation"></i>
                    {problem.message}
                </p>
            {/each}
            <label class="check">
                <input
                    type="checkbox"
                    checked={milestone.revertWithCause}
                    onchange={(e) =>
                        patch(index, {
                            revertWithCause: e.currentTarget.checked,
                        })}
                />
                {localize("downtime-dnd5e.MilestonesEditor.UndoTheseActionsIf")}
            </label>

            <div class="actions">
                {#each milestone.actions as action, ai (action.id)}
                    <ActionEditor
                        {action}
                        onchange={(a) =>
                            setActions(
                                index,
                                milestone.actions.map((x, i) =>
                                    i === ai ? a : $state.snapshot(x),
                                ) as MilestoneAction[],
                            )}
                        onremove={() =>
                            setActions(
                                index,
                                milestone.actions
                                    .filter((_, i) => i !== ai)
                                    .map((x) =>
                                        $state.snapshot(x),
                                    ) as MilestoneAction[],
                            )}
                        {store}
                        {methods}
                        {items}
                        {progress}
                    />
                {:else}
                    <p class="hint">
                        {localize(
                            "downtime-dnd5e.MilestonesEditor.NoActionsYetThis",
                        )}
                    </p>
                {/each}
                <div class="row">
                    <select
                        value={newActionKind[milestone.id] ?? "ANNOUNCE"}
                        onchange={(e) =>
                            (newActionKind[milestone.id] = e.currentTarget
                                .value as MilestoneAction["kind"])}
                    >
                        {#each Object.entries(ACTION_KIND_LABELS) as [kind, label] (kind)}<option
                                value={kind}>{localize(label)}</option
                            >{/each}
                    </select>
                    <button
                        type="button"
                        class="add"
                        onclick={() =>
                            setActions(index, [
                                ...(milestone.actions.map((x) =>
                                    $state.snapshot(x),
                                ) as MilestoneAction[]),
                                defaultAction(
                                    newActionKind[milestone.id] ?? "ANNOUNCE",
                                    randomId,
                                    localize,
                                ),
                            ])}
                    >
                        <i class="fas fa-plus"></i>
                        {localize("downtime-dnd5e.MilestonesEditor.AddAction")}
                    </button>
                </div>
            </div>
        </div>
    {:else}
        <p class="hint">
            {localize("downtime-dnd5e.MilestonesEditor.NoMilestones")}
        </p>
    {/each}
    <button type="button" class="add" onclick={add}
        ><i class="fas fa-plus"></i>
        {localize("downtime-dnd5e.MilestonesEditor.AddMilestone")}</button
    >
</div>

<style>
    .milestones {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }
    .milestone {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        border: 1px solid var(--color-border-light-2, #bbb);
        border-radius: 4px;
        padding: 0.3rem;
    }
    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        align-items: center;
    }
    .row select {
        width: auto;
    }
    input.label {
        flex: 1 1 8rem;
    }
    input.at {
        width: 4.5rem;
        flex: none;
    }
    .actions {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding-left: 0.5rem;
    }
    label.check {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.8rem;
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
    .problem.blocking {
        color: var(--color-level-error, #c00);
    }
    .hint {
        font-size: 0.75rem;
        opacity: 0.7;
        margin: 0;
    }
</style>

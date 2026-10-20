<script lang="ts">
    import { localize } from "../foundry/i18n";
    /**
     * An item's progress, full width. Ranges that go negative are drawn
     * two-sided around zero; repeating items show the current batch. GMs get
     * −/+ and can click the value to type a change (`+5`, `-2`) or a value.
     */
    import type { TrackedItem } from "../domain/TrackedItem";
    import {
        repeatingMilestone,
        repeatProgress,
    } from "../model/rules/milestones";
    import { parseProgressInput } from "../model/authoring/editing";
    import { nudgeProgress, setProgressTo } from "./actions";

    type Props = {
        item: TrackedItem;
        isGM: boolean;
        /** Told when the inline field opens/closes (the row stops being draggable meanwhile). */
        onediting?: (editing: boolean) => void;
    };

    const { item, isGM, onediting }: Props = $props();

    let busy = $state(false);

    const repeat = $derived.by(() => {
        const milestone = repeatingMilestone(item.data.milestones);
        if (!milestone) return null;
        return {
            ...repeatProgress(item.value, milestone.at),
            made: item.state.milestoneFires[milestone.id] ?? 0,
            label:
                milestone.label || localize("downtime-dnd5e.ProgressBar.Batch"),
        };
    });

    /** Fill as [start%, end%] of the bar, and the zero mark for two-sided ranges. */
    const geometry = $derived.by(() => {
        const value = item.value;
        if (repeat)
            return {
                from: 0,
                to: (100 * repeat.inBatch) / repeat.size,
                zero: null,
            };
        const { target, min, max } = item.progress;
        const top = max ?? target;
        if (top === null || top === undefined) return null;
        const bottom = min !== null && min < 0 ? min : 0;
        const span = top - bottom || 1;
        const pct = (v: number) =>
            Math.max(0, Math.min(100, ((v - bottom) / span) * 100));
        const zero = pct(0);
        const at = pct(value);
        return {
            from: Math.min(zero, at),
            to: Math.max(zero, at),
            zero: bottom < 0 ? zero : null,
        };
    });

    const label = $derived(
        repeat
            ? localize("downtime-dnd5e.ProgressBar.BatchProgress", {
                  inBatch: repeat.inBatch,
                  size: repeat.size,
                  made: repeat.made,
              })
            : item.progress.target !== null
              ? `${item.value} / ${item.progress.target}`
              : `${item.value}`,
    );

    async function run(fn: () => Promise<unknown>) {
        if (busy) return;
        busy = true;
        try {
            await fn();
        } finally {
            busy = false;
        }
    }

    /** The inline field: shown while the GM is typing a change. */
    let editing = $state(false);
    $effect(() => onediting?.(editing));
    let draft = $state("");
    let invalid = $state(false);

    function startEditing() {
        draft = String(item.value);
        invalid = false;
        editing = true;
    }

    async function apply() {
        const parsed = parseProgressInput(draft);
        if (!parsed) {
            invalid = true;
            return;
        }
        editing = false;
        if (parsed.kind === "adjust" && parsed.delta === 0) return;
        if (parsed.kind === "set" && parsed.value === item.value) return;
        await run(() =>
            parsed.kind === "adjust"
                ? nudgeProgress(item, parsed.delta)
                : setProgressTo(item, parsed.value),
        );
    }

    function onKey(event: KeyboardEvent) {
        if (event.key === "Enter") {
            event.preventDefault();
            void apply();
        } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            editing = false;
        }
    }

    /** Focus and select the field when it appears. */
    function focus(element: HTMLInputElement) {
        element.focus();
        element.select();
    }
</script>

<div
    class="progress-bar"
    class:complete={item.completed}
    class:negative={item.value < 0}
    class:open-ended={!geometry}
    title={repeat
        ? localize("downtime-dnd5e.ProgressBar.Total", {
              value: item.value,
              label: repeat.label,
          })
        : undefined}
>
    {#if geometry}
        <span
            class="fill"
            style:left="{geometry.from}%"
            style:width="{geometry.to - geometry.from}%"
        ></span>
        {#if geometry.zero !== null}
            <span class="zero" style:left="{geometry.zero}%"></span>
        {/if}
    {/if}
    {#if isGM}
        <button
            type="button"
            class="step minus"
            disabled={busy || item.locked}
            title="−1"
            onclick={() => run(() => nudgeProgress(item, -1))}
            ><i class="fas fa-minus"></i></button
        >
        {#if editing}
            <input
                type="text"
                class="value-input"
                class:invalid
                bind:value={draft}
                use:focus
                onkeydown={onKey}
                onblur={() => (editing = false)}
                aria-label={localize(
                    "downtime-dnd5e.ProgressBar.NewProgress5Or",
                )}
                title={localize("downtime-dnd5e.ProgressBar.5Or2To")}
            />
        {:else}
            <button
                type="button"
                class="value"
                disabled={busy}
                title={localize(
                    "downtime-dnd5e.ProgressBar.ChangeProgressType5",
                )}
                onclick={startEditing}>{label}</button
            >
        {/if}
        <button
            type="button"
            class="step plus"
            disabled={busy || item.locked}
            title="+1"
            onclick={() => run(() => nudgeProgress(item, 1))}
            ><i class="fas fa-plus"></i></button
        >
    {:else}
        <span class="value">{label}</span>
    {/if}
</div>

<style>
    .progress-bar {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 1.4rem;
        border-radius: 4px;
        background: var(--color-border-light-2, rgba(0, 0, 0, 0.15));
        overflow: hidden;
        font-size: 0.8rem;
    }
    .fill {
        position: absolute;
        top: 0;
        bottom: 0;
        background: var(--color-level-info, #3a6ea5);
        opacity: 0.75;
    }
    .complete .fill {
        background: var(--color-level-success, #3a3);
    }
    .negative .fill {
        background: var(--color-level-error, #c33);
    }
    .zero {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        margin-left: -1px;
        background: currentColor;
        opacity: 0.5;
    }
    .value {
        all: unset;
        position: relative;
        flex: 1;
        text-align: center;
        font-weight: bold;
        white-space: nowrap;
        cursor: default;
        text-shadow: 0 0 3px var(--color-shadow-dark, rgba(0, 0, 0, 0.6));
    }
    button.value {
        cursor: pointer;
    }
    button.value:hover {
        text-decoration: underline;
    }
    .value-input {
        position: relative;
        flex: 1;
        height: 100%;
        min-width: 0;
        margin: 0;
        padding: 0 0.25rem;
        border: none;
        border-radius: 0;
        background: rgba(0, 0, 0, 0.35);
        color: inherit;
        text-align: center;
        font-weight: bold;
        font-size: 0.8rem;
    }
    .value-input.invalid {
        outline: 2px solid var(--color-level-error, #c00);
        outline-offset: -2px;
    }
    .step {
        all: unset;
        position: relative;
        width: 1.6rem;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0.7;
    }
    .step:hover:not(:disabled) {
        opacity: 1;
        background: rgba(0, 0, 0, 0.15);
    }
    .step:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
    .progress-bar :global(i.fas) {
        font-size: 0.7rem;
        width: auto;
        height: auto;
    }
</style>

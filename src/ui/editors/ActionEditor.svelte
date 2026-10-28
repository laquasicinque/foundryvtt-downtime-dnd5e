<script lang="ts">
    import { localize } from "../../foundry/i18n";
    /** One milestone action. */
    import { randomId } from "../../foundry/utils";
    import {
        ACTION_KIND_LABELS,
        defaultAction,
        templateFrom,
    } from "../../model/authoring/editing";
    import { actionProblems } from "../../model/rules/milestones";
    import type {
        MethodData,
        MilestoneAction,
        ProgressConfig,
        Recipient,
        StoreRef,
        TrackedItemData,
    } from "../../types/data";
    import RecipientEditor from "./RecipientEditor.svelte";
    import UuidDrop from "./UuidDrop.svelte";

    type Props = {
        action: MilestoneAction;
        onchange: (action: MilestoneAction) => void;
        onremove: () => void;
        store: StoreRef;
        methods: readonly MethodData[];
        /** Other items in the store: ADJUST_PROGRESS targets and ADD_TRACKED_ITEM templates. */
        items: readonly TrackedItemData[];
        progress: ProgressConfig;
    };

    const {
        action,
        onchange,
        onremove,
        store,
        methods,
        items,
        progress,
    }: Props = $props();

    const problems = $derived(
        actionProblems(action, { store, progress, items, t: localize }),
    );

    const snapshot = () => $state.snapshot(action) as MilestoneAction;

    function patch(fields: Record<string, unknown>) {
        onchange({ ...snapshot(), ...fields } as MilestoneAction);
    }

    function setKind(kind: MilestoneAction["kind"]) {
        onchange({
            ...defaultAction(kind, randomId, localize),
            id: action.id,
        } as MilestoneAction);
    }
</script>

<div class="action">
    <div class="row">
        <select
            value={action.kind}
            onchange={(e) =>
                setKind(e.currentTarget.value as MilestoneAction["kind"])}
        >
            {#each Object.entries(ACTION_KIND_LABELS) as [kind, label] (kind)}<option
                    value={kind}>{localize(label)}</option
                >{/each}
        </select>
        <button
            type="button"
            class="icon"
            onclick={onremove}
            title={localize("downtime-dnd5e.ActionEditor.RemoveAction")}
            ><i class="fas fa-trash"></i></button
        >
    </div>

    {#if action.kind === "ANNOUNCE"}
        <div class="row">
            <input
                type="text"
                placeholder={localize(
                    "downtime-dnd5e.ActionEditor.MessageBlankADefault",
                )}
                value={action.message ?? ""}
                oninput={(e) =>
                    patch({ message: e.currentTarget.value || null })}
            />
            <select
                value={action.audience}
                onchange={(e) => patch({ audience: e.currentTarget.value })}
            >
                <option value="WORLD_DEFAULT"
                    >{localize(
                        "downtime-dnd5e.ActionEditor.WorldSetting",
                    )}</option
                >
                <option value="PUBLIC"
                    >{localize("downtime-dnd5e.ActionEditor.Everyone")}</option
                >
                <option value="GM"
                    >{localize("downtime-dnd5e.ActionEditor.GMOnly")}</option
                >
            </select>
        </div>
    {:else if action.kind === "GRANT_ITEM"}
        <div class="row">
            <UuidDrop
                value={action.sourceUuid}
                accept={["Item"]}
                onchange={(sourceUuid) => patch({ sourceUuid })}
            />
            <label class="inline"
                >{localize("downtime-dnd5e.ActionEditor.Quantity")}
                <input
                    type="number"
                    min="1"
                    value={action.quantity}
                    oninput={(e) =>
                        patch({
                            quantity: Math.max(
                                1,
                                e.currentTarget.valueAsNumber || 1,
                            ),
                        })}
                /></label
            >
        </div>
        <RecipientEditor
            recipient={action.recipient}
            onchange={(recipient: Recipient) => patch({ recipient })}
            {store}
            {methods}
        />
    {:else if action.kind === "APPLY_EFFECT"}
        <UuidDrop
            value={action.sourceUuid}
            accept={["ActiveEffect"]}
            onchange={(sourceUuid) => patch({ sourceUuid })}
        />
        <RecipientEditor
            recipient={action.recipient}
            onchange={(recipient: Recipient) => patch({ recipient })}
            {store}
            {methods}
        />
    {:else if action.kind === "ADD_TRACKED_ITEM"}
        <div class="row">
            <label
                >{localize("downtime-dnd5e.ActionEditor.CopyOf")}
                <select
                    value=""
                    onchange={(e) => {
                        const source = items.find(
                            (i) => i.id === e.currentTarget.value,
                        );
                        if (source)
                            patch({
                                template: templateFrom(
                                    $state.snapshot(source) as TrackedItemData,
                                ),
                            });
                    }}
                >
                    <option value="" disabled
                        >{localize("downtime-dnd5e.ActionEditor.PickToCopy", {
                            item: action.template.name,
                        })}</option
                    >
                    {#each items as item (item.id)}<option value={item.id}
                            >{item.name}</option
                        >{/each}
                </select>
            </label>
            <label
                >{localize("downtime-dnd5e.ActionEditor.AddItTo")}
                <select
                    value={action.store}
                    onchange={(e) => {
                        const value = e.currentTarget.value;
                        patch({
                            store: value,
                            recipient:
                                value === "RECIPIENT_ACTOR"
                                    ? (action.recipient ?? {
                                          type: "TRIGGERING_ACTOR",
                                      })
                                    : null,
                        });
                    }}
                >
                    <option value="SAME"
                        >{localize(
                            "downtime-dnd5e.ActionEditor.ThisItemSStore",
                        )}</option
                    >
                    <option value="WORLD"
                        >{localize(
                            "downtime-dnd5e.ActionEditor.TheWorld",
                        )}</option
                    >
                    <option value="RECIPIENT_ACTOR"
                        >{localize(
                            "downtime-dnd5e.ActionEditor.ACharacter",
                        )}</option
                    >
                </select>
            </label>
        </div>
        <p class="hint">
            {localize("downtime-dnd5e.ActionEditor.CreatesCopy", {
                item: action.template.name,
            })}
        </p>
        {#if action.store === "RECIPIENT_ACTOR" && action.recipient}
            <RecipientEditor
                recipient={action.recipient}
                onchange={(recipient: Recipient) => patch({ recipient })}
                {store}
                {methods}
            />
        {/if}
    {:else if action.kind === "ADJUST_PROGRESS"}
        <div class="row">
            <label
                >{localize("downtime-dnd5e.ActionEditor.Item")}
                <select
                    value={action.ref.kind === "SELF"
                        ? "__self__"
                        : action.ref.id}
                    onchange={(e) =>
                        patch({
                            ref:
                                e.currentTarget.value === "__self__"
                                    ? { kind: "SELF" }
                                    : {
                                          kind: "ITEM",
                                          id: e.currentTarget.value,
                                      },
                        })}
                >
                    <option value="__self__" disabled
                        >{localize(
                            "downtime-dnd5e.ActionEditor.ChooseAnItem",
                        )}</option
                    >
                    {#each items as item (item.id)}<option value={item.id}
                            >{item.name}</option
                        >{/each}
                </select>
            </label>
            <label
                >{localize("downtime-dnd5e.ActionEditor.By")}
                <input
                    type="number"
                    value={action.delta}
                    oninput={(e) =>
                        patch({ delta: e.currentTarget.valueAsNumber || 0 })}
                /></label
            >
        </div>
    {:else if action.kind === "MACRO"}
        <UuidDrop
            value={action.macroUuid}
            accept={["Macro"]}
            onchange={(macroUuid) => patch({ macroUuid })}
        />
        <span class="field-label"
            >{localize("downtime-dnd5e.ActionEditor.UndoMacro")}
            <span class="hint"
                >{localize(
                    "downtime-dnd5e.ActionEditor.OptionalWithoutOneReverting",
                )}</span
            ></span
        >
        <UuidDrop
            value={action.undoMacroUuid ?? ""}
            accept={["Macro"]}
            onchange={(uuid) => patch({ undoMacroUuid: uuid || null })}
        />
    {/if}
    {#each problems as problem (problem.message)}
        <p class="problem" class:blocking={problem.blocking}>
            <i class="fas fa-triangle-exclamation"></i>
            {problem.message}
        </p>
    {/each}
</div>

<style>
    .action {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        border-left: 3px solid var(--color-border-light-2, #bbb);
        padding: 0.2rem 0.4rem;
    }
    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem 0.5rem;
        align-items: end;
    }
    .row > select,
    .row > input,
    .row > label {
        flex: 1 1 8rem;
        width: auto;
    }
    label {
        display: flex;
        flex-direction: column;
        font-size: 0.8rem;
    }
    label.inline {
        flex: 0 0 auto;
    }
    label.inline input {
        width: 4.5rem;
    }
    button.icon {
        width: 1.75rem;
        flex: none;
    }
    .field-label {
        font-size: 0.8rem;
    }
    .hint {
        font-size: 0.75rem;
        opacity: 0.7;
        margin: 0;
    }
    .problem {
        font-size: 0.8rem;
        margin: 0;
        color: var(--color-level-warning, #c80);
    }
    .problem.blocking {
        color: var(--color-level-error, #c00);
    }
</style>

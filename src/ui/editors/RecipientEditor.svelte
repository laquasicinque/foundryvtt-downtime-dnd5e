<script lang="ts">
    import { localize } from "../../foundry/i18n";
    /** Who receives a granted item / effect / new tracked item. */
    import { defaultRecipient } from "../../model/authoring/editing";
    import type {
        MethodData,
        Recipient,
        RecipientSelection,
        StoreRef,
    } from "../../types/data";
    import { documentSummarySync } from "../../foundry/documents";
    import UuidDrop from "./UuidDrop.svelte";

    type Props = {
        recipient: Recipient;
        onchange: (recipient: Recipient) => void;
        store: StoreRef;
        methods: readonly MethodData[];
    };

    const { recipient, onchange, store, methods }: Props = $props();

    const snapshot = () => $state.snapshot(recipient) as Recipient;

    const actorName = (uuid: string) => documentSummarySync(uuid)?.name ?? uuid;

    function setSelection(selection: RecipientSelection) {
        const current = snapshot();
        if (current.type === "ACTOR" || current.type === "CONTRIBUTORS")
            onchange({ ...current, selection });
    }
</script>

<div class="recipient">
    <label
        >{localize("downtime-dnd5e.RecipientEditor.WhoGetsIt")}
        <select
            value={recipient.type}
            onchange={(e) =>
                onchange(
                    defaultRecipient(
                        e.currentTarget.value as Recipient["type"],
                    ),
                )}
        >
            <option value="TRIGGERING_ACTOR"
                >{localize(
                    "downtime-dnd5e.RecipientEditor.TheCharacterWhoReached",
                )}</option
            >
            <option value="OWNING_ACTOR" disabled={store.kind === "WORLD"}
                >{localize(
                    "downtime-dnd5e.RecipientEditor.ThisItemSCharacter",
                )}</option
            >
            <option value="ACTOR"
                >{localize(
                    "downtime-dnd5e.RecipientEditor.SpecificCharacters",
                )}</option
            >
            <option value="CONTRIBUTORS"
                >{localize(
                    "downtime-dnd5e.RecipientEditor.CharactersWhoContributed",
                )}</option
            >
        </select>
    </label>

    {#if recipient.type === "ACTOR"}
        {@const actors = recipient}
        <div class="list">
            {#each actors.actorUuids as uuid, index (uuid)}
                <span class="chip">
                    {actorName(uuid)}
                    <button
                        type="button"
                        class="icon"
                        title={localize(
                            "downtime-dnd5e.RecipientEditor.Remove",
                        )}
                        onclick={() =>
                            onchange({
                                ...actors,
                                actorUuids: actors.actorUuids.filter(
                                    (_, i) => i !== index,
                                ),
                            })}><i class="fas fa-xmark"></i></button
                    >
                </span>
            {/each}
        </div>
        <UuidDrop
            value=""
            accept={["Actor"]}
            placeholder={localize(
                "downtime-dnd5e.RecipientEditor.DropAnActorTo",
            )}
            onchange={(uuid) => {
                if (uuid && !actors.actorUuids.includes(uuid))
                    onchange({
                        ...actors,
                        actorUuids: [...actors.actorUuids, uuid],
                    });
            }}
        />
    {:else if recipient.type === "CONTRIBUTORS"}
        {@const contributors = recipient}
        <div class="row">
            <label
                >{localize("downtime-dnd5e.RecipientEditor.Counting")}
                <select
                    value={contributors.filter.window}
                    onchange={(e) =>
                        onchange({
                            ...contributors,
                            filter: {
                                ...contributors.filter,
                                window: e.currentTarget.value as
                                    "ALL_TIME" | "SINCE_LAST_FIRE",
                            },
                        })}
                >
                    <option value="ALL_TIME"
                        >{localize(
                            "downtime-dnd5e.RecipientEditor.AllContributions",
                        )}</option
                    >
                    <option value="SINCE_LAST_FIRE"
                        >{localize(
                            "downtime-dnd5e.RecipientEditor.SinceThisMilestoneLast",
                        )}</option
                    >
                </select>
            </label>
            <label
                >{localize("downtime-dnd5e.RecipientEditor.MinProgress")}
                <input
                    type="number"
                    placeholder={localize("downtime-dnd5e.RecipientEditor.Any")}
                    value={contributors.filter.minNet ?? ""}
                    oninput={(e) =>
                        onchange({
                            ...contributors,
                            filter: {
                                ...contributors.filter,
                                minNet:
                                    e.currentTarget.value === ""
                                        ? null
                                        : e.currentTarget.valueAsNumber,
                            },
                        })}
                />
            </label>
            <label
                >{localize("downtime-dnd5e.RecipientEditor.MinAttempts")}
                <input
                    type="number"
                    placeholder={localize("downtime-dnd5e.RecipientEditor.Any")}
                    value={contributors.filter.minAttempts ?? ""}
                    oninput={(e) =>
                        onchange({
                            ...contributors,
                            filter: {
                                ...contributors.filter,
                                minAttempts:
                                    e.currentTarget.value === ""
                                        ? null
                                        : e.currentTarget.valueAsNumber,
                            },
                        })}
                />
            </label>
        </div>
        {#if methods.length > 1}
            <div class="list">
                <span class="hint"
                    >{localize("downtime-dnd5e.RecipientEditor.OnlyVia")}</span
                >
                {#each methods as method (method.id)}
                    <label class="check">
                        <input
                            type="checkbox"
                            checked={contributors.filter.methodIds.includes(
                                method.id,
                            )}
                            onchange={(e) => {
                                const ids =
                                    contributors.filter.methodIds.filter(
                                        (id) => id !== method.id,
                                    );
                                onchange({
                                    ...contributors,
                                    filter: {
                                        ...contributors.filter,
                                        methodIds: e.currentTarget.checked
                                            ? [...ids, method.id]
                                            : ids,
                                    },
                                });
                            }}
                        />
                        {method.name}
                    </label>
                {/each}
                <span class="hint"
                    >{localize(
                        "downtime-dnd5e.RecipientEditor.NoneTickedAnyMethod",
                    )}</span
                >
            </div>
        {/if}
    {/if}

    {#if recipient.type === "ACTOR" || recipient.type === "CONTRIBUTORS"}
        <label class="check">
            <input
                type="checkbox"
                checked={recipient.selection === "GM_PICKS"}
                onchange={(e) =>
                    setSelection(e.currentTarget.checked ? "GM_PICKS" : "AUTO")}
            />
            {localize("downtime-dnd5e.RecipientEditor.GMPicksWhoGets")}
        </label>
    {/if}
</div>

<style>
    .recipient {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    label {
        display: flex;
        flex-direction: column;
        font-size: 0.8rem;
    }
    label.check {
        flex-direction: row;
        align-items: center;
        gap: 0.25rem;
    }
    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem 0.5rem;
    }
    .row > label {
        flex: 1 1 7rem;
    }
    .list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem 0.5rem;
        align-items: center;
    }
    .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
        border: 1px solid var(--color-border-light-2, #bbb);
        border-radius: 3px;
        padding: 0 0.25rem;
        font-size: 0.8rem;
    }
    button.icon {
        width: 1.25rem;
        height: 1.25rem;
        line-height: 1;
        padding: 0;
    }
    .hint {
        font-size: 0.75rem;
        opacity: 0.7;
    }
</style>

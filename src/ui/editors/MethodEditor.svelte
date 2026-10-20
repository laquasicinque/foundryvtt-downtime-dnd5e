<script lang="ts">
    import { localize } from "../../foundry/i18n";
    import {
        abilityChoices,
        skillChoices,
        toolChoices,
    } from "../../dnd5e/config";
    import { randomId } from "../../foundry/utils";
    import {
        changeMethodKind,
        defaultResultTable,
        METHOD_KIND_LABELS,
    } from "../../model/authoring/editing";
    import type {
        CountsAs,
        DeltaSpec,
        MethodData,
        MethodKind,
        ResultTable,
        ToolFallback,
        TrackedItemData,
    } from "../../types/data";
    import BandsEditor from "./BandsEditor.svelte";
    import RequirementsEditor from "./RequirementsEditor.svelte";
    import UsageEditor from "./UsageEditor.svelte";
    import DeltaInput from "./DeltaInput.svelte";

    type Props = {
        method: MethodData;
        onchange: (method: MethodData) => void;
        onremove: () => void;
        onmove: (direction: -1 | 1) => void;
        first: boolean;
        last: boolean;
        /** Other items in the store, for requirements that point at them. */
        items: readonly TrackedItemData[];
        /** World items, also offered to requirements on a character's item. */
        worldItems?: readonly TrackedItemData[];
        /** The item being edited (draft). */
        self: TrackedItemData;
    };

    const {
        method,
        onchange,
        onremove,
        onmove,
        first,
        last,
        items,
        worldItems = [],
        self,
    }: Props = $props();

    const abilities = abilityChoices();
    const skills = skillChoices();
    const tools = toolChoices();

    let open = $state(false);

    function patch(fields: Record<string, unknown>) {
        onchange({ ...$state.snapshot(method), ...fields } as MethodData);
    }

    function setKind(kind: MethodKind) {
        onchange(
            changeMethodKind(
                $state.snapshot(method) as MethodData,
                kind,
                randomId,
                localize,
            ),
        );
    }

    function setDc(value: string) {
        const dc = value.trim() === "" ? null : Number(value);
        if (dc !== null && !Number.isFinite(dc)) return;
        const current = method as MethodData & {
            dc: number | null;
            results: ResultTable;
        };
        // Switching between "has a DC" and "no DC" swaps the default table, unless it was customised.
        const wasDefault =
            JSON.stringify(stripIds(current.results)) ===
            JSON.stringify(
                stripIds(defaultResultTable(current.dc !== null, randomId)),
            );
        const results =
            wasDefault && (current.dc === null) !== (dc === null)
                ? defaultResultTable(dc !== null, randomId)
                : current.results;
        patch({ dc, results });
    }

    const stripIds = (table: ResultTable) =>
        table.bands.map(({ id: _id, ...band }) => band);

    function setFallback(kind: string, key: string) {
        let fallback: ToolFallback | null = null;
        if (kind === "SKILL")
            fallback = { kind, skill: (key || "ath") as never };
        if (kind === "ABILITY")
            fallback = { kind, ability: (key || "str") as never };
        patch({ fallback });
    }

    const isCheck = $derived(
        method.kind === "ABILITY" ||
            method.kind === "SKILL" ||
            method.kind === "TOOL",
    );
</script>

<div class="method-editor">
    <header>
        <button type="button" class="toggle" onclick={() => (open = !open)}>
            <i class="fas {open ? 'fa-caret-down' : 'fa-caret-right'}"></i>
            {method.name}
            <span class="kind"
                >({localize(METHOD_KIND_LABELS[method.kind])})</span
            >
        </button>
        <button
            type="button"
            class="icon"
            disabled={first}
            onclick={() => onmove(-1)}
            title={localize("downtime-dnd5e.MethodEditor.MoveUp")}
            ><i class="fas fa-arrow-up"></i></button
        >
        <button
            type="button"
            class="icon"
            disabled={last}
            onclick={() => onmove(1)}
            title={localize("downtime-dnd5e.MethodEditor.MoveDown")}
            ><i class="fas fa-arrow-down"></i></button
        >
        <button
            type="button"
            class="icon"
            onclick={onremove}
            title={localize("downtime-dnd5e.MethodEditor.RemoveMethod")}
            ><i class="fas fa-trash"></i></button
        >
    </header>

    {#if open}
        <div class="body">
            <div class="row">
                <label
                    >{localize("DOCUMENT.FIELDS.name.label")}
                    <input
                        type="text"
                        value={method.name}
                        oninput={(e) => patch({ name: e.currentTarget.value })}
                    /></label
                >
                <label
                    >{localize("downtime-dnd5e.MethodEditor.Kind")}
                    <select
                        value={method.kind}
                        onchange={(e) =>
                            setKind(e.currentTarget.value as MethodKind)}
                    >
                        {#each Object.entries(METHOD_KIND_LABELS) as [kind, label] (kind)}
                            <option value={kind}>{localize(label)}</option>
                        {/each}
                    </select>
                </label>
            </div>
            <label
                >{localize("DOCUMENT.FIELDS.description.label")}
                <input
                    type="text"
                    value={method.description}
                    oninput={(e) =>
                        patch({ description: e.currentTarget.value })}
                /></label
            >
            <label
                >{localize("downtime-dnd5e.MethodEditor.Image")}
                <span class="hint"
                    >{localize(
                        "downtime-dnd5e.MethodEditor.IconOnTheMethod",
                    )}</span
                >
                <input
                    type="text"
                    value={method.img ?? ""}
                    placeholder={localize("downtime-dnd5e.MethodEditor.Icons")}
                    oninput={(e) =>
                        patch({ img: e.currentTarget.value || null })}
                />
            </label>
            <label class="check"
                ><input
                    type="checkbox"
                    checked={method.hidden}
                    onchange={(e) => patch({ hidden: e.currentTarget.checked })}
                />
                {localize(
                    "downtime-dnd5e.MethodEditor.HiddenFromPlayers",
                )}</label
            >

            {#if method.kind === "ABILITY"}
                <label
                    >{localize("downtime-dnd5e.MethodEditor.Ability")}
                    <select
                        value={method.ability}
                        onchange={(e) =>
                            patch({ ability: e.currentTarget.value })}
                    >
                        {#each abilities as a (a.key)}<option value={a.key}
                                >{a.label}</option
                            >{/each}
                    </select>
                </label>
            {:else if method.kind === "SKILL"}
                <label
                    >{localize("downtime-dnd5e.MethodEditor.Skill")}
                    <select
                        value={method.skill}
                        onchange={(e) =>
                            patch({ skill: e.currentTarget.value })}
                    >
                        {#each skills as s (s.key)}<option value={s.key}
                                >{s.label}</option
                            >{/each}
                    </select>
                </label>
            {:else if method.kind === "TOOL"}
                <div class="row">
                    <label
                        >{localize("downtime-dnd5e.MethodEditor.Tool")}
                        <select
                            value={method.tool}
                            onchange={(e) =>
                                patch({ tool: e.currentTarget.value })}
                        >
                            <option value="" disabled
                                >{localize(
                                    "downtime-dnd5e.MethodEditor.ChooseATool",
                                )}</option
                            >
                            {#each tools as t (t.key)}<option value={t.key}
                                    >{t.label}</option
                                >{/each}
                        </select>
                    </label>
                    <label
                        >{localize(
                            "downtime-dnd5e.MethodEditor.WithoutTheTool",
                        )}
                        <select
                            value={method.fallback?.kind ?? ""}
                            onchange={(e) =>
                                setFallback(e.currentTarget.value, "")}
                        >
                            <option value=""
                                >{localize(
                                    "downtime-dnd5e.MethodEditor.CanTBeUsed",
                                )}</option
                            >
                            <option value="SKILL"
                                >{localize(
                                    "downtime-dnd5e.MethodEditor.RollASkill",
                                )}</option
                            >
                            <option value="ABILITY"
                                >{localize(
                                    "downtime-dnd5e.MethodEditor.RollAnAbility",
                                )}</option
                            >
                        </select>
                    </label>
                    {#if method.fallback?.kind === "SKILL"}
                        <label
                            >{localize(
                                "downtime-dnd5e.MethodEditor.FallbackSkill",
                            )}
                            <select
                                value={method.fallback.skill}
                                onchange={(e) =>
                                    setFallback("SKILL", e.currentTarget.value)}
                            >
                                {#each skills as s (s.key)}<option value={s.key}
                                        >{s.label}</option
                                    >{/each}
                            </select>
                        </label>
                    {:else if method.fallback?.kind === "ABILITY"}
                        <label
                            >{localize(
                                "downtime-dnd5e.MethodEditor.FallbackAbility",
                            )}
                            <select
                                value={method.fallback.ability}
                                onchange={(e) =>
                                    setFallback(
                                        "ABILITY",
                                        e.currentTarget.value,
                                    )}
                            >
                                {#each abilities as a (a.key)}<option
                                        value={a.key}>{a.label}</option
                                    >{/each}
                            </select>
                        </label>
                    {/if}
                </div>
            {:else if method.kind === "FIXED"}
                <div class="row">
                    <DeltaInput
                        delta={method.effect.delta}
                        onchange={(delta: DeltaSpec) =>
                            patch({ effect: { delta } })}
                    />
                    <label
                        >{localize("downtime-dnd5e.MethodEditor.CountsAs")}
                        <select
                            value={method.countsAs ?? ""}
                            onchange={(e) =>
                                patch({
                                    countsAs: (e.currentTarget.value ||
                                        null) as CountsAs,
                                })}
                        >
                            <option value="SUCCESS"
                                >{localize(
                                    "downtime-dnd5e.MethodEditor.Success",
                                )}</option
                            >
                            <option value="FAILURE"
                                >{localize(
                                    "downtime-dnd5e.MethodEditor.Failure",
                                )}</option
                            >
                            <option value=""
                                >{localize(
                                    "downtime-dnd5e.MethodEditor.Neither",
                                )}</option
                            >
                        </select>
                    </label>
                </div>
            {:else if method.kind === "MANUAL"}
                <label class="check"
                    ><input
                        type="checkbox"
                        checked={method.gmOnly}
                        onchange={(e) =>
                            patch({ gmOnly: e.currentTarget.checked })}
                    />
                    {localize("downtime-dnd5e.MethodEditor.GMOnly")}</label
                >
            {:else if method.kind === "MACRO"}
                <div class="row">
                    <label
                        >{localize("downtime-dnd5e.MethodEditor.MacroUUID")}
                        <input
                            type="text"
                            value={method.macroUuid}
                            oninput={(e) =>
                                patch({ macroUuid: e.currentTarget.value })}
                        /></label
                    >
                    <label
                        >{localize("downtime-dnd5e.MethodEditor.OrName")}
                        <input
                            type="text"
                            value={method.macroName ?? ""}
                            oninput={(e) =>
                                patch({
                                    macroName: e.currentTarget.value || null,
                                })}
                        /></label
                    >
                </div>
                <p class="hint">
                    <!-- The key's text has <code> markup; it holds no user data. -->
                    {@html localize("downtime-dnd5e.MethodEditor.MacroHint")}
                </p>
            {/if}

            <div class="subtitle">
                {localize("downtime-dnd5e.MethodEditor.Uses")}
            </div>
            <UsageEditor {method} onchange={(usage) => patch({ usage })} />

            <div class="subtitle">
                {localize("downtime-dnd5e.MethodEditor.Requirements")}
            </div>
            <RequirementsEditor
                requirements={method.requirements}
                onchange={(requirements) => patch({ requirements })}
                {items}
                {worldItems}
                {self}
                subject="method"
            />

            {#if isCheck && "dc" in method}
                <label
                    >{localize("downtime-dnd5e.MethodEditor.DC")}
                    <span class="hint"
                        >{localize(
                            "downtime-dnd5e.MethodEditor.BlankUseTheRolled",
                        )}</span
                    >
                    <input
                        type="number"
                        value={method.dc ?? ""}
                        oninput={(e) => setDc(e.currentTarget.value)}
                    />
                </label>
                <BandsEditor
                    table={method.results}
                    dc={method.dc}
                    onchange={(results: ResultTable) => patch({ results })}
                />
            {/if}
        </div>
    {/if}
</div>

<style>
    .method-editor {
        border: 1px solid var(--color-border-light-2, #bbb);
        border-radius: 4px;
        padding: 0.25rem;
    }
    header {
        display: flex;
        gap: 0.25rem;
        align-items: center;
    }
    .toggle {
        all: unset;
        cursor: pointer;
        flex: 1;
        font-weight: bold;
    }
    .kind {
        font-weight: normal;
        opacity: 0.7;
    }
    button.icon {
        width: 1.75rem;
        flex: none;
    }
    .body {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.25rem;
    }
    .row {
        display: flex;
        gap: 0.5rem;
        align-items: end;
    }
    .row > :global(label) {
        flex: 1;
    }
    label {
        display: flex;
        flex-direction: column;
        font-size: 0.85rem;
    }
    label.check {
        flex-direction: row;
        align-items: center;
        gap: 0.25rem;
    }
    .subtitle {
        font-weight: bold;
        font-size: 0.85rem;
    }
    .hint {
        font-size: 0.75rem;
        opacity: 0.7;
        margin: 0;
    }
</style>

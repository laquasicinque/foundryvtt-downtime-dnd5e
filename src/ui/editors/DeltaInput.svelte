<script lang="ts">
    import { localize } from "../../foundry/i18n";
    import type { DeltaSpec } from "../../types/data";

    type Props = {
        delta: DeltaSpec;
        onchange: (delta: DeltaSpec) => void;
    };

    const { delta, onchange }: Props = $props();
</script>

<label
    >{localize("downtime-dnd5e.DeltaInput.Progress")}
    <span class="delta">
        <select
            value={delta.kind}
            onchange={(e) =>
                onchange(
                    e.currentTarget.value === "FORMULA"
                        ? {
                              kind: "FORMULA",
                              formula:
                                  delta.kind === "STATIC"
                                      ? String(delta.value)
                                      : delta.formula,
                          }
                        : {
                              kind: "STATIC",
                              value: delta.kind === "STATIC" ? delta.value : 0,
                          },
                )}
        >
            <option value="STATIC"
                >{localize("downtime-dnd5e.DeltaInput.Fixed")}</option
            >
            <option value="FORMULA"
                >{localize("downtime-dnd5e.DeltaInput.Formula")}</option
            >
        </select>
        {#if delta.kind === "STATIC"}
            <input
                type="number"
                step="any"
                value={delta.value}
                oninput={(e) => {
                    const value = e.currentTarget.valueAsNumber;
                    if (Number.isFinite(value))
                        onchange({ kind: "STATIC", value });
                }}
            />
        {:else}
            <input
                type="text"
                value={delta.formula}
                placeholder={localize(
                    "downtime-dnd5e.DeltaInput.TotalMarginNaturalDc",
                )}
                oninput={(e) =>
                    onchange({
                        kind: "FORMULA",
                        formula: e.currentTarget.value,
                    })}
            />
        {/if}
    </span>
</label>

<style>
    label {
        display: flex;
        flex-direction: column;
        font-size: 0.85rem;
    }
    .delta {
        display: flex;
        gap: 0.25rem;
    }
    .delta select {
        flex: none;
        width: 6rem;
    }
</style>

<script lang="ts">
    import { localize, localizeText } from "../../foundry/i18n";
    /**
     * GM repair tool: per store, what couldn't be read or was repaired on
     * load, with fixes; and restoring a store from its untouched V1 data.
     */
    import { copyToClipboard, escapeHTML as escape } from "../../foundry/utils";
    import { notifyError, notifyInfo } from "../../foundry/notifications";
    import {
        deleteRawTrackedItem,
        diagnoseAll,
        discardQuarantine,
        restoreFromV1,
        saveRepairs,
        type StoreDiagnosis,
    } from "../../runtime/repair";
    import { confirm } from "../../foundry/dialogs";

    let stores = $state<StoreDiagnosis[]>(diagnoseAll());
    let busy = $state(false);
    let showClean = $state(false);

    const problems = (d: StoreDiagnosis) =>
        d.broken.length + d.quarantined.length + d.repaired.length;
    const shown = $derived(stores.filter((d) => showClean || problems(d) > 0));

    async function run(fn: () => Promise<unknown>) {
        busy = true;
        try {
            await fn();
        } catch (error) {
            notifyError(error instanceof Error ? error.message : String(error));
        } finally {
            stores = diagnoseAll();
            busy = false;
        }
    }

    async function copy(raw: unknown) {
        await copyToClipboard(JSON.stringify(raw, null, 2));
        notifyInfo(localize("downtime-dnd5e.Notify.Copied"));
    }

    async function restore(d: StoreDiagnosis) {
        const ok = await confirm(
            localize("downtime-dnd5e.Repair.RestoreFromV1"),
            `<p>${localize("downtime-dnd5e.Repair.RestoreConfirm", { store: `<strong>${escape(d.label)}</strong>` })}</p><p>${localize(
                d.store.kind === "WORLD"
                    ? "downtime-dnd5e.Repair.RestoreLossWorld"
                    : "downtime-dnd5e.Repair.RestoreLossActor",
            )}</p>`,
        );
        if (ok) await run(() => restoreFromV1(d.store));
    }

    async function deleteBroken(d: StoreDiagnosis, key: string) {
        const ok = await confirm(
            localize("downtime-dnd5e.Repair.DeleteBrokenTitle"),
            `<p>${localize("downtime-dnd5e.Repair.DeleteBrokenConfirm")}</p>`,
        );
        if (ok) await run(() => deleteRawTrackedItem(d.store, key));
    }
</script>

<div class="repair">
    <p class="hint">
        {localize("downtime-dnd5e.Repair.ProblemsFoundWhenReading")}
    </p>
    <label class="toggle"
        ><input type="checkbox" bind:checked={showClean} />
        {localize("downtime-dnd5e.Repair.ShowStoresWithoutProblems")}</label
    >

    {#each shown as d (d.label + (d.store.kind === "ACTOR" ? d.store.actorUuid : ""))}
        <section>
            <header>
                <strong>{d.label}</strong>
                <span class="detail"
                    >{[
                        localize("downtime-dnd5e.Repair.Items", {
                            count: d.items,
                        }),
                        d.hasV3
                            ? null
                            : localize("downtime-dnd5e.Repair.NotConverted"),
                        problems(d)
                            ? localize("downtime-dnd5e.Repair.ToLookAt", {
                                  count: problems(d),
                              })
                            : localize("downtime-dnd5e.Repair.NoProblems"),
                    ]
                        .filter(Boolean)
                        .join(" · ")}</span
                >
                {#if d.hasV1Backup && d.hasV3}
                    <button
                        type="button"
                        disabled={busy}
                        title={localize(
                            "downtime-dnd5e.Repair.DiscardTheV3Data",
                        )}
                        onclick={() => restore(d)}
                        ><i class="fas fa-clock-rotate-left"></i>
                        {localize(
                            "downtime-dnd5e.Repair.RestoreFromV1",
                        )}</button
                    >
                {/if}
            </header>

            {#each d.broken as b (b.key)}
                <div class="row broken">
                    <span>
                        <i class="fas fa-circle-xmark"></i>
                        {@html localize("downtime-dnd5e.Repair.CantBeRead", {
                            item: `<strong>${escape(b.name ?? b.key)}</strong>`,
                            reasons: escape(b.reasons.join("; ")),
                        })}
                    </span>
                    <button type="button" onclick={() => copy(b.raw)}
                        ><i class="fas fa-copy"></i>
                        {localize("downtime-dnd5e.Repair.Copy")}</button
                    >
                    <button
                        type="button"
                        disabled={busy}
                        onclick={() => deleteBroken(d, b.key)}
                        ><i class="fas fa-trash"></i>
                        {localize("COMMON.Delete")}</button
                    >
                </div>
            {/each}

            {#each d.quarantined as q (q.itemId)}
                <div class="row">
                    <span>
                        <i class="fas fa-triangle-exclamation"></i>
                        {@html localize("downtime-dnd5e.Import.SetAside", {
                            item: `<strong>${escape(q.itemName)}</strong>`,
                            count: q.records.length,
                        })}
                        <ul>
                            {#each q.records as r, i (i)}
                                <li>
                                    <code>{r.path}</code>: {localizeText(
                                        r.reason,
                                    )}
                                </li>
                            {/each}
                        </ul>
                    </span>
                    <button type="button" onclick={() => copy(q.records)}
                        ><i class="fas fa-copy"></i>
                        {localize("downtime-dnd5e.Repair.Copy")}</button
                    >
                    <button
                        type="button"
                        disabled={busy}
                        title={localize(
                            "downtime-dnd5e.Repair.RemoveTheSetAside",
                        )}
                        onclick={() =>
                            run(() => discardQuarantine(d.store, q.itemId))}
                        ><i class="fas fa-eraser"></i>
                        {localize("downtime-dnd5e.Repair.Discard")}</button
                    >
                </div>
            {/each}

            {#each d.repaired as r (r.itemId)}
                <div class="row">
                    <span>
                        <i class="fas fa-wrench"></i>
                        {@html localize(
                            "downtime-dnd5e.Repair.RepairedWhenRead",
                            {
                                item: `<strong>${escape(r.itemName)}</strong>`,
                            },
                        )}
                        <ul>
                            {#each r.messages as m, i (i)}<li>{m}</li>{/each}
                        </ul>
                    </span>
                    <button
                        type="button"
                        disabled={busy}
                        title={localize(
                            "downtime-dnd5e.Repair.SaveTheRepairedVersion",
                        )}
                        onclick={() =>
                            run(() => saveRepairs(d.store, r.itemId))}
                        ><i class="fas fa-floppy-disk"></i>
                        {localize("downtime-dnd5e.Repair.SaveRepairs")}</button
                    >
                </div>
            {/each}
        </section>
    {:else}
        <p class="hint">{localize("downtime-dnd5e.Repair.NoProblemsFound")}</p>
    {/each}
</div>

<style>
    .repair {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        height: 100%;
        overflow-y: auto;
    }
    header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
        border-bottom: 1px solid var(--color-border-light-2, #bbb);
    }
    header .detail {
        flex: 1;
    }
    button {
        width: auto;
        line-height: 1.4;
        font-size: 0.8rem;
    }
    .row {
        display: flex;
        gap: 0.25rem 0.5rem;
        align-items: flex-start;
        flex-wrap: wrap;
        font-size: 0.85rem;
        padding: 0.25rem 0;
    }
    .row span {
        flex: 1 1 16rem;
    }
    .row ul {
        margin: 0.1rem 0 0;
        padding-left: 1.1rem;
        font-size: 0.8rem;
    }
    .broken {
        color: var(--color-level-error, #c00);
    }
    .detail,
    .hint {
        font-size: 0.8rem;
        opacity: 0.75;
        margin: 0;
    }
    .toggle {
        display: flex;
        gap: 0.25rem;
        align-items: center;
        font-size: 0.85rem;
    }
</style>

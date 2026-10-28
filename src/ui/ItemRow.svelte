<script lang="ts">
    import { localize } from "../foundry/i18n";
    import {
        createContextMenu,
        type ContextMenuEntry,
    } from "../foundry/applications";
    import type { AnyMethod } from "../domain/Method";
    import type { TrackedItem } from "../domain/TrackedItem";
    import {
        deleteTrackedItem,
        dropTrackedItem,
        dropMethod,
        duplicateTrackedItem,
        setLocked,
        useMethod,
    } from "./actions";
    import {
        allowDrop,
        isDragging,
        isLowerHalf,
        readDrag,
        startDrag,
        wantsCopy,
    } from "./dnd";
    import { itemAccess, METHOD_ICONS, methodSummary } from "./describe";
    import { usageSummary } from "../model/rules/usage";
    import { openHistory } from "./history/HistoryApp";
    import ProgressBar from "./ProgressBar.svelte";

    type Props = {
        item: TrackedItem;
        actingActorUuid: string;
        isGM: boolean;
        /** The host sheet is in edit mode: Edit and Delete are offered. */
        editMode: boolean;
        /** The item after this one in its category (for drops on the lower half). */
        nextItemId: string | null;
    };

    const { item, actingActorUuid, isGM, editMode, nextItemId }: Props =
        $props();

    let expanded = $state(false);
    /** The progress field is open: the row isn't draggable (so its text can be selected). */
    let typing = $state(false);
    let busy = $state(false);

    type MethodView = {
        method: AnyMethod;
        summary: string;
        /** Can't be clicked. */
        disabled: boolean;
        /** Usable (by the GM) despite something a player would be blocked by. */
        warning: boolean;
        /** Why it's unavailable, shown on the card. */
        reason: string;
        /** "2 uses left", "next use: reduced effect" … */
        usageNote: string;
        hiddenFromPlayers: boolean;
    };

    /**
     * What to show for each method. MACRO requirements can only be checked on
     * use, so they never disable the card here.
     */
    function methodView(method: AnyMethod): MethodView | null {
        const availability = method.availability(actingActorUuid);
        const unmet =
            availability.state === "AVAILABLE"
                ? []
                : availability.unmet.filter(
                      (u) => u.reason !== "MACRO_NOT_EVALUATED",
                  );
        const state = unmet.length === 0 ? "AVAILABLE" : availability.state;
        const usage = method.usageFor(actingActorUuid);
        const tier = usage?.tier;
        const usageBlocked = tier?.kind === "DISABLE" || tier?.kind === "HIDE";

        const hiddenFromPlayers =
            method.hidden || state === "HIDE" || tier?.kind === "HIDE";
        if (!isGM && hiddenFromPlayers) return null;

        const reasons: string[] = [];
        if (item.locked)
            reasons.push(localize("downtime-dnd5e.ItemRow.Locked"));
        if (state !== "AVAILABLE" && availability.state !== "AVAILABLE") {
            // GMs see every unmet requirement; players only the hints (DISABLE_WITH_HINT).
            reasons.push(
                ...(isGM
                    ? unmet.map((u) => item.describeRequirement(u.requirement))
                    : availability.hints.length
                      ? availability.hints
                      : [localize("downtime-dnd5e.Error.RequirementsUnmet")]),
            );
        }
        if (usageBlocked)
            reasons.push(
                (tier?.kind === "DISABLE" && tier.hint) ||
                    localize("downtime-dnd5e.Usage.NoUsesLeft"),
            );

        // Uses left before the next blocking tier, and whether a reduced tier applies now.
        const summary =
            usage && method.usage
                ? usageSummary(method.usage, usage.count, localize)
                : null;
        const usageNote = (!summary?.blocked && summary?.text) || "";

        const blocked = item.locked || state !== "AVAILABLE" || usageBlocked;
        return {
            method,
            summary: methodSummary(method),
            // Locked blocks everyone (unlock first). Otherwise GMs have the final say over
            // requirements and usage limits, but see why players can't use the method.
            disabled: item.locked || (blocked && !isGM),
            warning: !item.locked && blocked && isGM,
            reason: reasons.join(" · "),
            usageNote,
            hiddenFromPlayers,
        };
    }

    const access = $derived(itemAccess(item, actingActorUuid));

    function requirementsUnmetTitle(a: ReturnType<typeof itemAccess>): string {
        const title = localize(
            a.state === "HIDE"
                ? "downtime-dnd5e.ItemRow.RequirementsUnmetHidden"
                : "downtime-dnd5e.ItemRow.RequirementsUnmet",
        );
        return a.descriptions?.length
            ? `${title}: ${a.descriptions.join(" · ")}`
            : title;
    }

    const methods = $derived(
        item.methods.map(methodView).filter((m): m is MethodView => m !== null),
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

    async function edit() {
        const { openTrackedItemEditor } =
            await import("./editors/ItemEditorApp");
        openTrackedItemEditor(item);
    }

    // ── Context menu (GM) ───────────────────────────────────────────────────

    let row = $state<HTMLElement | null>(null);

    $effect(() => {
        if (!isGM || !row) return;
        const entry = (
            label: string,
            icon: string,
            onClick: () => unknown,
            visible: () => boolean = () => true,
        ): ContextMenuEntry => ({
            label,
            icon,
            onClick: () => void run(async () => onClick()),
            visible,
        });
        return createContextMenu(row, ".summary", [
            entry(localize("downtime-dnd5e.ItemRow.Edit"), "fa-pen", edit),
            entry(
                localize("downtime-dnd5e.ItemRow.Lock"),
                "fa-lock",
                () => setLocked(item, true),
                () => !item.locked,
            ),
            entry(
                localize("downtime-dnd5e.ItemRow.Unlock"),
                "fa-lock-open",
                () => setLocked(item, false),
                () => item.locked,
            ),
            entry(localize("downtime-dnd5e.ItemRow.Duplicate"), "fa-copy", () =>
                duplicateTrackedItem(item),
            ),
            entry(localize("COMMON.Delete"), "fa-trash", () =>
                deleteTrackedItem(item),
            ),
        ]);
    });

    /** The ⋮ button opens the same menu as right-clicking the header. */
    function openMenu(event: MouseEvent) {
        event.stopPropagation();
        (event.currentTarget as HTMLElement).dispatchEvent(
            new MouseEvent("contextmenu", {
                bubbles: true,
                clientX: event.clientX,
                clientY: event.clientY,
            }),
        );
    }

    // ── Drag and drop (GM) ──────────────────────────────────────────────────

    /** Drop marker: an item before/after this one, or a method slot. */
    let itemDrop = $state<"before" | "after" | null>(null);
    let methodSlot = $state<number | null>(null);

    function onItemDragOver(event: DragEvent) {
        if (allowDrop(event, "item")) {
            itemDrop = isLowerHalf(event, row!) ? "after" : "before";
        } else if (allowDrop(event, "method")) {
            // Dropping a method on a collapsed item adds it at the end.
            methodSlot = item.methods.length;
        }
    }

    function clearDrop() {
        itemDrop = null;
        methodSlot = null;
    }

    async function onItemDrop(event: DragEvent) {
        const copy = wantsCopy(event);
        const dropped = readDrag(event, "item");
        const method = readDrag(event, "method");
        const where = itemDrop;
        const slot = methodSlot;
        clearDrop();
        if (dropped) {
            event.preventDefault();
            event.stopPropagation();
            await dropTrackedItem(
                dropped,
                item.store,
                item.categoryId,
                where === "after" ? nextItemId : item.id,
                copy,
            );
        } else if (method) {
            event.preventDefault();
            event.stopPropagation();
            await dropMethod(
                method,
                item.store,
                item.id,
                slot ?? item.methods.length,
                copy,
            );
        }
    }

    function onMethodDragOver(
        event: DragEvent,
        index: number,
        element: Element,
    ) {
        if (!allowDrop(event, "method")) return;
        itemDrop = null;
        methodSlot = isLowerHalf(event, element) ? index + 1 : index;
    }
</script>

<article
    bind:this={row}
    class="downtime-item"
    class:complete={item.completed}
    class:locked={item.locked}
    class:drop-before={itemDrop === "before"}
    class:drop-after={itemDrop === "after"}
    draggable={isGM && !typing}
    ondragstart={(e) =>
        startDrag(e, { kind: "item", store: item.store, itemId: item.id })}
    ondragover={isGM ? onItemDragOver : undefined}
    ondragleave={(e) => {
        if (!row?.contains(e.relatedTarget as Node | null)) clearDrop();
    }}
    ondrop={isGM ? onItemDrop : undefined}
>
    <div class="summary">
        <img src={item.img || "icons/svg/book.svg"} alt="" />
        <button
            type="button"
            class="name"
            onclick={() => (expanded = !expanded)}
            aria-expanded={expanded}
            title={expanded
                ? localize("downtime-dnd5e.ItemRow.HideMethods")
                : localize("downtime-dnd5e.ItemRow.ShowMethods")}
        >
            <i
                class="fas {expanded
                    ? 'fa-chevron-down'
                    : 'fa-chevron-right'} chevron"
            ></i>
            {item.name}
            {#if !expanded && methods.length}<span class="count"
                    >{localize("downtime-dnd5e.ItemRow.Methods", {
                        count: methods.length,
                    })}</span
                >{/if}
        </button>
        <span class="badges">
            {#if item.completed}<span
                    class="badge"
                    title={localize("downtime-dnd5e.ItemRow.Complete")}
                    ><i class="fas fa-check"></i></span
                >{/if}
            {#if item.locked}<span
                    class="badge"
                    title={localize("downtime-dnd5e.ItemRow.Locked")}
                    ><i class="fas fa-lock"></i></span
                >{/if}
            {#if isGM && item.requirements.length}
                <span
                    class="badge"
                    class:warn={access.state !== "AVAILABLE"}
                    title={access.state === "AVAILABLE"
                        ? localize("downtime-dnd5e.ItemRow.RequirementsMet")
                        : requirementsUnmetTitle(access)}
                    ><i class="fas fa-user-lock"></i></span
                >
            {/if}
            {#if isGM && item.hidden}<span
                    class="badge"
                    title={localize("downtime-dnd5e.ItemRow.HiddenFromPlayers")}
                    ><i class="fas fa-eye-slash"></i></span
                >{/if}
            {#if isGM && item.state.pendingApprovals.length}
                <span
                    class="badge"
                    title={localize(
                        "downtime-dnd5e.ItemRow.ActionsAwaitingApproval",
                    )}
                >
                    <i class="fas fa-hourglass-half"></i>
                    {item.state.pendingApprovals.length}
                </span>
            {/if}
            {#if isGM && item.quarantine.length}
                <span
                    class="badge warn"
                    title={localize("downtime-dnd5e.ItemRow.SomeDataCouldnT")}
                >
                    <i class="fas fa-triangle-exclamation"></i>
                    {item.quarantine.length}
                </span>
            {/if}
        </span>
        {#if isGM && editMode}
            <button
                type="button"
                class="icon-button"
                disabled={busy}
                onclick={edit}
                title={localize("downtime-dnd5e.ItemRow.Edit")}
                aria-label={localize("downtime-dnd5e.ItemRow.EditNamed", {
                    item: item.name,
                })}
            >
                <i class="fas fa-pen"></i>
            </button>
            <button
                type="button"
                class="icon-button"
                disabled={busy}
                onclick={() => run(() => deleteTrackedItem(item))}
                title={localize("COMMON.Delete")}
                aria-label={localize("downtime-dnd5e.ItemRow.DeleteNamed", {
                    item: item.name,
                })}
            >
                <i class="fas fa-trash"></i>
            </button>
        {/if}
        <button
            type="button"
            class="icon-button"
            onclick={() => openHistory(item)}
            title={localize("downtime-dnd5e.ItemRow.History")}
        >
            <i class="fas fa-clock-rotate-left"></i>
        </button>
        {#if isGM}
            <button
                type="button"
                class="icon-button"
                onclick={openMenu}
                title={localize(
                    "downtime-dnd5e.ItemRow.EditLockDuplicateDelete",
                )}
                aria-label={localize("downtime-dnd5e.ItemRow.MoreActions")}
            >
                <i class="fas fa-ellipsis-vertical"></i>
            </button>
        {/if}
    </div>

    <ProgressBar {item} {isGM} onediting={(on) => (typing = on)} />

    {#if expanded}
        {#if item.description}
            <div class="description">{@html item.description}</div>
        {/if}
        <ul
            class="methods"
            aria-label={localize("downtime-dnd5e.ItemRow.WaysToProgress", {
                item: item.name,
            })}
        >
            {#each methods as view, index (view.method.id)}
                <li
                    class="method-row"
                    class:slot-before={methodSlot === index}
                    class:slot-after={methodSlot === index + 1 &&
                        index === methods.length - 1}
                    draggable={isGM}
                    ondragstart={(e) =>
                        startDrag(e, {
                            kind: "method",
                            store: item.store,
                            itemId: item.id,
                            methodId: view.method.id,
                        })}
                    ondragover={isGM
                        ? (e) => onMethodDragOver(e, index, e.currentTarget)
                        : undefined}
                >
                    <button
                        type="button"
                        class="method"
                        class:warning={view.warning}
                        class:unavailable={view.disabled}
                        disabled={busy || view.disabled}
                        title={view.summary}
                        onclick={() =>
                            run(() => useMethod(view.method, actingActorUuid))}
                    >
                        <span class="method-icon">
                            <i
                                class="fas {view.disabled
                                    ? 'fa-lock'
                                    : METHOD_ICONS[view.method.kind]}"
                            ></i>
                        </span>
                        <span class="method-text">
                            <span class="method-name">
                                {view.method.name}
                                {#if isGM && view.hiddenFromPlayers}
                                    <i
                                        class="fas fa-eye-slash"
                                        title={localize(
                                            "downtime-dnd5e.ItemRow.PlayersCanTSee",
                                        )}
                                    ></i>
                                {/if}
                            </span>
                            <span class="method-summary">{view.summary}</span>
                            {#if view.method.description}
                                <span class="method-description"
                                    >{view.method.description}</span
                                >
                            {/if}
                            {#if view.reason}
                                <span class="method-note reason"
                                    >{view.warning
                                        ? localize(
                                              "downtime-dnd5e.ItemRow.GmCanOverride",
                                              {
                                                  reason: view.reason,
                                              },
                                          )
                                        : view.reason}</span
                                >
                            {:else if view.usageNote}
                                <span class="method-note">{view.usageNote}</span
                                >
                            {/if}
                        </span>
                    </button>
                </li>
            {:else}
                <li class="empty" class:slot-before={methodSlot !== null}>
                    {localize("downtime-dnd5e.ItemRow.NoWaysToProgress")}
                </li>
            {/each}
        </ul>
    {/if}
</article>

<style>
    .downtime-item[draggable="true"] {
        cursor: grab;
    }
    .downtime-item {
        border: 1px solid var(--color-border-light-2, #bbb);
        border-radius: 4px;
        padding: 0.35rem 0.5rem;
        margin-bottom: 0.35rem;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }
    .downtime-item.complete {
        border-color: var(--color-level-success, #3a3);
    }
    .downtime-item.drop-before {
        box-shadow: 0 -3px 0 var(--color-level-info, #3a6ea5);
    }
    .downtime-item.drop-after {
        box-shadow: 0 3px 0 var(--color-level-info, #3a6ea5);
    }
    .summary {
        display: flex;
        align-items: center;
        gap: 0.25rem 0.5rem;
    }
    .summary img {
        width: 28px;
        height: 28px;
        border: none;
        flex: none;
    }
    .name {
        all: unset;
        cursor: pointer;
        font-weight: bold;
        flex: 1 1 8rem;
        min-width: 0;
        overflow-wrap: anywhere;
    }
    .chevron {
        opacity: 0.6;
        margin-right: 0.15rem;
    }
    .count {
        font-weight: normal;
        font-size: 0.75rem;
        opacity: 0.6;
        margin-left: 0.25rem;
    }
    .badges {
        display: flex;
        gap: 0.25rem;
        font-size: 0.8rem;
    }
    /* Sheets (Tidy5e especially) size icons globally; keep ours small. */
    .downtime-item :global(i.fas) {
        font-size: 0.8rem;
        width: auto;
        height: auto;
    }
    .badge.warn {
        color: var(--color-level-warning, #c80);
    }
    .icon-button {
        width: auto;
        flex: none;
        line-height: 1.4;
        padding: 0 0.4rem;
    }
    .description {
        font-size: 0.85rem;
    }
    .description :global(p) {
        margin: 0 0 0.25rem;
    }

    .methods {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }
    .method-row {
        display: flex;
        align-items: center;
        gap: 0.35rem;
    }
    .method-row.slot-before {
        box-shadow: 0 -2px 0 var(--color-level-info, #3a6ea5);
    }
    .method-row.slot-after {
        box-shadow: 0 2px 0 var(--color-level-info, #3a6ea5);
    }
    .method {
        flex: 1;
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        height: auto;
        min-height: 1.9rem;
        padding: 0.2rem 0.5rem;
        text-align: left;
        justify-content: flex-start;
        line-height: 1.3;
        border: 1px solid var(--color-border-light-2, #bbb);
        border-left: 4px solid var(--color-level-info, #3a6ea5);
        border-radius: 4px;
        background: var(--color-cool-5-75, rgba(0, 0, 0, 0.04));
        cursor: pointer;
    }
    .method:hover:not(:disabled) {
        border-left-color: var(--color-level-success, #3a3);
        box-shadow: 0 0 4px var(--color-shadow-primary, rgba(0, 0, 0, 0.3));
    }
    .method.warning {
        border-left-color: var(--color-level-warning, #c80);
    }
    .method.unavailable {
        border-left-color: var(--color-border-light-2, #999);
        opacity: 0.65;
        cursor: not-allowed;
    }
    .method-icon {
        flex: none;
        width: 1rem;
        text-align: center;
        padding-top: 0.1rem;
    }
    .method-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        min-width: 0;
        text-align: left;
    }
    .method-name {
        font-weight: bold;
        font-size: 0.85rem;
    }
    .method-summary,
    .method-description {
        font-size: 0.75rem;
        opacity: 0.8;
        overflow-wrap: anywhere;
        white-space: normal;
    }
    .method-description {
        opacity: 0.7;
    }
    .method-note {
        font-size: 0.75rem;
        opacity: 0.8;
        font-style: italic;
        white-space: normal;
    }
    .method-note.reason {
        color: var(--color-level-warning, #c80);
        opacity: 1;
        font-style: normal;
    }
    .empty {
        font-size: 0.8rem;
        opacity: 0.7;
    }
</style>

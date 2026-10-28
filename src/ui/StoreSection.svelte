<script lang="ts">
    import { localize } from "../foundry/i18n";
    import { downloadExport, pickAndImport } from "../runtime/exchange";
    import { createTrackedItem, dropTrackedItem } from "./actions";
    import { allowDrop, readDrag, wantsCopy } from "./dnd";
    import { itemAccess } from "./describe";
    import ItemRow from "./ItemRow.svelte";
    import type { StoreState } from "./StoreState.svelte";

    type Props = {
        title: string;
        store: StoreState;
        actingActorUuid: string;
        isGM: boolean;
        /** The host sheet is in edit mode. */
        editMode: boolean;
    };

    const { title, store, actingActorUuid, isGM, editMode }: Props = $props();

    /** Category group being dragged over (an item lands at its end). */
    let dropTarget = $state<string | null>(null);
    const groupKey = (categoryId: string | null) => categoryId ?? "__none__";

    async function onGroupDrop(event: DragEvent, categoryId: string | null) {
        dropTarget = null;
        const payload = readDrag(event, "item");
        if (!payload) return;
        event.preventDefault();
        event.stopPropagation();
        await dropTrackedItem(
            payload,
            store.ref,
            categoryId,
            null,
            wantsCopy(event),
        );
    }

    // Players don't see hidden items, or items whose own requirements they don't
    // meet (when those hide it); empty categories are hidden from them too.
    const groups = $derived(
        store.groups
            .map((group) => ({
                ...group,
                items: isGM
                    ? group.items
                    : group.items.filter(
                          (item) =>
                              !item.hidden &&
                              itemAccess(item, actingActorUuid).state !==
                                  "HIDE",
                      ),
            }))
            .filter((group) => isGM || group.items.length > 0),
    );

    async function openCategories() {
        const { openCategoriesEditor } =
            await import("./editors/CategoriesEditorApp");
        openCategoriesEditor(
            store.ref,
            store.categories.map((c) => c.toJSON()),
        );
    }
</script>

<section class="store-section">
    <header>
        <h3>{title}</h3>
        {#if isGM}
            <div class="controls">
                <button
                    type="button"
                    onclick={() => createTrackedItem(store.ref)}
                >
                    <i class="fas fa-plus"></i>
                    {localize("downtime-dnd5e.StoreSection.AddItem")}
                </button>
                <button type="button" onclick={openCategories}>
                    <i class="fas fa-folder"></i>
                    {localize("downtime-dnd5e.StoreSection.Categories")}
                </button>
                <button
                    type="button"
                    title={localize(
                        "downtime-dnd5e.StoreSection.DownloadTheseDowntimesAs",
                    )}
                    onclick={() => downloadExport(store.ref)}
                >
                    <i class="fas fa-file-export"></i>
                    {localize("downtime-dnd5e.StoreSection.Export")}
                </button>
                <button
                    type="button"
                    title={localize(
                        "downtime-dnd5e.StoreSection.AddDowntimesFromAn",
                    )}
                    onclick={() => pickAndImport(store.ref)}
                >
                    <i class="fas fa-file-import"></i>
                    {localize("downtime-dnd5e.StoreSection.Import")}
                </button>
            </div>
        {/if}
    </header>

    {#each groups as group (group.category?.id ?? "__uncategorised__")}
        {#if group.items.length > 0 || isGM}
            {@const categoryId = group.category?.id ?? null}
            <div
                class="category"
                class:drop-target={dropTarget === groupKey(categoryId)}
                role="list"
                ondragover={isGM
                    ? (e) => {
                          if (allowDrop(e, "item"))
                              dropTarget = groupKey(categoryId);
                      }
                    : undefined}
                ondragleave={(e) => {
                    if (
                        !(e.currentTarget as HTMLElement).contains(
                            e.relatedTarget as Node | null,
                        )
                    )
                        dropTarget = null;
                }}
                ondrop={isGM ? (e) => onGroupDrop(e, categoryId) : undefined}
            >
                <h4>
                    {group.category?.name ??
                        localize("downtime-dnd5e.Category.Uncategorised")}
                </h4>
                {#if group.category?.description}
                    <p class="description">{group.category.description}</p>
                {/if}
                {#each group.items as item, index (item.id)}
                    <svelte:boundary>
                        <ItemRow
                            {item}
                            {actingActorUuid}
                            {isGM}
                            {editMode}
                            nextItemId={group.items[index + 1]?.id ?? null}
                        />
                        {#snippet failed(error, reset)}
                            <div class="broken">
                                <i class="fas fa-triangle-exclamation"></i>
                                {isGM
                                    ? localize(
                                          "downtime-dnd5e.StoreSection.BrokenDetail",
                                          {
                                              item: item.name,
                                              error:
                                                  error instanceof Error
                                                      ? error.message
                                                      : String(error),
                                          },
                                      )
                                    : localize(
                                          "downtime-dnd5e.StoreSection.Broken",
                                          {
                                              item: item.name,
                                          },
                                      )}
                                <button type="button" onclick={reset}
                                    >{localize(
                                        "downtime-dnd5e.StoreSection.Retry",
                                    )}</button
                                >
                            </div>
                        {/snippet}
                    </svelte:boundary>
                {:else}
                    <p class="empty">
                        {localize("downtime-dnd5e.StoreSection.NoTrackedItems")}
                    </p>
                {/each}
            </div>
        {/if}
    {/each}
</section>

<style>
    .store-section header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--color-border-light-2, #999);
        margin-bottom: 0.5rem;
    }
    .store-section h3 {
        margin: 0;
    }
    .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
    }
    .controls button {
        width: auto;
        line-height: 1.5;
    }
    .category {
        border-radius: 4px;
        padding-bottom: 0.25rem;
    }
    .category.drop-target {
        outline: 2px dashed var(--color-level-info, #3a6ea5);
        outline-offset: 2px;
    }
    .category h4 {
        margin: 0.5rem 0 0.25rem;
        font-size: 0.9rem;
        opacity: 0.8;
    }
    .description,
    .empty {
        margin: 0 0 0.25rem;
        font-size: 0.8rem;
        opacity: 0.7;
    }
    .broken {
        padding: 0.25rem 0.5rem;
        border: 1px dashed var(--color-level-error, #c00);
        font-size: 0.85rem;
    }
</style>

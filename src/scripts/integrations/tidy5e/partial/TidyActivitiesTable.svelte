<script lang="ts">
  import { type Column } from "../../../components/DndTable.svelte";
  import { TrackingAndTraining } from "../../../TrackingAndTraining";
  import DndProgress from "../../../components/DndProgress.svelte";
  import { localize } from "../../../utils/localize";
  import TidyTable from "../components/TidyTable.svelte";
  import TidyTableCell from "../components/TidyTableCell.svelte";
  import TidyTableHeaderCell from "../components/TidyTableHeaderCell.svelte";
  import TidyTableHeaderRow from "../components/TidyTableHeaderRow.svelte";
  import TidyTableRow from "../components/TidyTableRow.svelte";
  import ExpandableContainer from "../components/ExpandableContainer.svelte";
  import { SvelteMap } from "svelte/reactivity";
  import { preventDefault } from "../../../utils/preventDefault";

  type ActivitiesTableProps = {
    category: Downtime.CategoryWithActivities;
    categoryControls?: boolean;
    isEditMode?: boolean;
    showToUserEditMode?: boolean;
    actor?: dnd5e.documents.Actor5e<"character">;

    onAddActivity?: (categoryId: string) => void;
    onEditCategory?: (categoryId: string) => void;
    onDeleteCategory?: (categoryId: string) => void;
    onEditActivity?: (itemId: string) => void;
    onDeleteActivity?: (itemId: string) => void;
    onRollActivity?: (itemId: string) => void;
    onSetProgress?: (payload: { id: string; progress: number }) => void;
    onMoveActivityUp?: (itemId: string) => void;
    onMoveActivityDown?: (itemId: string) => void;
    onDrop?: (payload: {
      event: DragEvent;
      activity: Downtime.TrackedItem;
      actor?: string;
    }) => void;
    onDragStart?: (payload: {
      event: DragEvent;
      activity: Downtime.TrackedItem;
      actor?: string;
    }) => void;
  };

  const {
    category,
    categoryControls,
    showToUserEditMode,
    actor,
    onAddActivity,
    onEditCategory,
    onDeleteCategory,
    onEditActivity,
    onDeleteActivity,
    onRollActivity,
    onSetProgress,
    onDrop: onDropProp,
    onDragStart: onDragStartProp,
    isEditMode = false,
  }: ActivitiesTableProps = $props();

  const isGm = $state(game.users.current?.isGM ?? false);

  const columns: Column[] = $derived(
    [
      { id: "type", label: "Type", width: 80 },
      { id: "override", label: "", width: 100 },
      { id: "progress", label: "Progress", width: 150 },
      isEditMode ? { id: "controls", label: "", width: 80 } : undefined,
    ].filter((x) => x != null)
  );

  const openStates = new SvelteMap<string, boolean>();

  const isOpen = (activity: Downtime.TrackedItem | string) => {
    const id = typeof activity === "string" ? activity : activity.id;
    return Boolean(openStates.get(id));
  };

  const toggle = (activity: Downtime.TrackedItem) => {
    const id = activity.id;
    // toggle unless there's no description
    openStates.set(id, !openStates.get(id) && !!activity.description.trim());
    return Boolean(openStates.get(id));
  };

  const editActivity = (itemId: string) => onEditActivity?.(itemId);
  const deleteActivity = (itemId: string) => onDeleteActivity?.(itemId);
  const setProgress = (id: string, progress: number) => {
    onSetProgress?.({ id, progress });
  };

  function onDragStart(event: DragEvent, activity: Downtime.TrackedItem) {
    if (event.target !== event.currentTarget) {
      return;
    }
    onDragStartProp?.({ event, activity, actor: actor?.uuid });
  }
  function onDrop(event: DragEvent, activity: Downtime.TrackedItem) {
    onDropProp?.({ event, activity, actor: actor?.uuid });
  }
</script>

<TidyTable key={category.id} class="downtime-activities">
  {#snippet header()}
    <TidyTableHeaderRow>
      <TidyTableHeaderCell primary
        ><h3>{category.name}</h3>
        <span class="table-header-count">{category.activities.length}</span>
      </TidyTableHeaderCell>
      <TidyTableHeaderCell>Type</TidyTableHeaderCell>
      <TidyTableHeaderCell></TidyTableHeaderCell>
      <TidyTableHeaderCell>Progress</TidyTableHeaderCell>
      <TidyTableHeaderCell
        class={{
          "header-cell-actions":
            !isEditMode || !(onEditCategory && onDeleteCategory),
        }}
      >
        {#if showToUserEditMode}
          {#if isEditMode && onEditCategory && onDeleteCategory}
            <a
              class="tidy-table-button"
              title="Edit Category"
              onclick={preventDefault((e) => onEditCategory?.(category.id))}
              ><i class="fas fa-edit"></i></a
            >
            <a
              class="tidy-table-button"
              title="Delete Category"
              onclick={preventDefault((e) => onDeleteCategory?.(category.id))}
              ><i class="fas fa-trash"></i></a
            >
          {:else}
            <a class="tidy-table-button" title="Add Activity"
            onclick={preventDefault((e) => onAddActivity(category.id))}
              ><i class="fas fa-plus"></i></a
            >
          {/if}
        {/if}
      </TidyTableHeaderCell>
    </TidyTableHeaderRow>
  {/snippet}
  {#snippet body()}
    {#each category.activities as activity (activity.id)}
      <TidyTableRow
        rowAttributes={{ "data-tidy-draggable": true }}
        rowContainerAttributes={{
          ondrop: (event: DragEvent) => onDrop(event, activity),
        }}
        ondragstart={(event) => onDragStart(event, activity)}
      >
        <TidyTableCell primary attributes={{ onclick: () => toggle(activity) }}>
          <button
            type="button"
            aria-label="Roll"
            class="tidy-table-row-use-button"
            onclick={preventDefault((e) => {
              e.stopPropagation();
              onRollActivity?.(activity.id);
            })}
          >
            <img class="item-image" src={activity.img} />
            <span class="roll-prompt">
              <i class="fa fa-dice-d20"></i>
            </span>
          </button>

          <span class="item-name">
            <span class="cell-text">
              <span class="cell-name">
                {activity.name}
              </span>
            </span>
            {#if activity.description}
              <span class="row-detail-expand-indicator"
                ><i
                  class="fa-solid fa-angle-right expand-indicator"
                  class:expanded={isOpen(activity)}
                ></i>
              </span>
            {/if}
          </span>
        </TidyTableCell>
        <TidyTableCell>{activity.progressionStyle}</TidyTableCell>
        <TidyTableCell
          ><input
            type="number"
            bind:value={activity.progress}
            class="numer"
            onchange={(e) =>
              setProgress(
                activity.id,
                (e.target as HTMLInputElement).valueAsNumber
              )}
          />/ <span class="denom">{ activity. completionAt }</span></TidyTableCell
        >
        <TidyTableCell columnWidth={isEditMode ? null : `10rem`}
          ><DndProgress
            value={activity.progress}
            max={activity.completionAt}
          /></TidyTableCell
        >
        {#if isEditMode}
          <TidyTableCell>
            <button
              type="button"
              id={`downtime-dnd5e-edit-controls`}
              class="tidy-table-button"
              title={localize("downtime-dnd5e.EditItem")}
              aria-label={localize("downtime-dnd5e.EditItem")}
              onclick={() => editActivity(activity.id)}
            >
              <i class="fas fa-edit"></i>
            </button>
            <button
              type="button"
              id={`downtime-dnd5e-delete-controls`}
              class="tidy-table-button"
              title={localize("downtime-dnd5e.DeleteItem")}
              aria-label={localize("downtime-dnd5e.DeleteItem")}
              onclick={() => deleteActivity(activity.id)}
            >
              <i class="fas fa-trash"></i>
            </button>
          </TidyTableCell>
        {/if}
        {#snippet afterRow()}
          <ExpandableContainer expanded={isOpen(activity)}>
            <div
              class="editor-rendered-content"
              data-tidy-sheet-part={"item-summary"}
            >
              <div>
                <p>
                  {activity.description}
                </p>
              </div>
            </div>
          </ExpandableContainer>
        {/snippet}
      </TidyTableRow>
    {/each}
  {/snippet}
</TidyTable>

<style scoped>
  .item-header .config-button {
    position: relative;
    top: 0;
    left: 0;
    margin: 0 2px;
  }

  .item-controls {
    padding-right: 4px;
  }

  button.tidy-table-button {
    padding: 0;
    width: var(--t5e-table-button-width);
  }

  .tidy-table-row-use-button {
    --t5e-use-button-border-color: var(--t5e-color-gold);
    align-items: center;
    align-self: center;
    border-radius: 0.125rem;
    outline: 0.0625rem solid var(--t5e-use-button-border-color);
    cursor: pointer;
    display: grid;
    grid-template-columns: 1fr;
    height: var(--t5e-icon-size-7x);
    width: var(--t5e-icon-size-7x);
    justify-content: center;
    margin: 0.0625rem 0 0.0625rem 0.0625rem;
    overflow: hidden;
    position: relative;
    transition: all var(--t5e-transition-default);
    padding: 0 !important;
  }

  .tidy-table-row-use-button .roll-prompt {
    position: absolute;
  }

  h3 {
    margin-left: 4px;
  }

 :global(.downtime-activities input[type="number"]) {
    width: 3rem;
    padding: 0 4px;
    border: none;
    text-align: right;
  }

  .denom {
    margin: 0 4px;
  }

  /* Classic sheet stuff */
  :global(.tidy5e-sheet.application:where(.classic))
    .tidy-table-row-use-button {
    --t5e-icon-size-7x: 28px;
  }

  :global(.tidy5e-sheet.application:where(.classic) .roll-prompt) {
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  :global(.tidy5e-sheet.application:where(.classic) .tidy-table-row),
  :global(.tidy5e-sheet.application:where(.classic) .tidy-table-header-row) {
    --t5e-size-20x: 5rem;
    display: flex !important;
    width: 100% !important;
  }

  :global(.tidy5e-sheet.application:where(.classic) .tidy-table-cell),
  :global(.tidy5e-sheet.application:where(.classic) .tidy-table-header-cell) {
    flex-basis: var(--tidy-table-column-width, var(--t5e-size-20x)) !important;
    max-width: var(--tidy-table-column-width, var(--t5e-size-20x)) !important;
  }
  :global(.tidy5e-sheet.application:where(.classic) .tidy-table-cell.primary),
  :global(
    .tidy5e-sheet.application:where(.classic) .tidy-table-header-cell.primary
  ) {
    flex-grow: 1 !important;
    max-width: none !important;
  }

  :global(
    .tidy5e-sheet.application:where(.classic)
      .tidy-table-cell.primary
      .item-name
  ) {
    padding-left: 8px !important;
  }
  :global(.tidy5e-sheet.application:where(.classic) h2) {
    margin: 8px 4px !important;
  }

  :global(.tidy5e-sheet.application:where(.classic) h3) {
    font-size: 0.75rem !important;
    margin: 4px !important;
  }

  :global(.tidy5e-sheet.application:where(.classic) .tidy-table-container) {
    gap: 8px !important;
    display: flex !important;
    flex-flow: column !important;
  }

:global(.tidy5e-sheet.application:where(.classic) .tidy-table-container button) {
    border: none !important;
    margin: 0 4px !important;
  }
:global(.tidy5e-sheet.application:where(.classic) .tidy-table-button) {
    border: none !important;
    margin: 0 4px !important;
  }
  :global(.tidy5e-sheet.application:where(.classic) .tidy-table-container input) {
      width: 2.5rem !important;
      padding: 0 4px !important;
    }
    :global(.tidy5e-sheet.application:where(.classic) .tidy-tab.downtime .button) {
        padding: 4px 8px !important;
    }
</style>

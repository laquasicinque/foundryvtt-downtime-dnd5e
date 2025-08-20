<script lang="ts">
  import { type Column } from "../components/DndTable.svelte";
  import { TrackingAndTraining } from "../TrackingAndTraining";
  import DndProgress from "../components/DndProgress.svelte";
  import { localize } from "../utils/localize";
  import TidyTable from "../integrations/tidy5e/components/TidyTable.svelte";
  import TidyTableCell from "../integrations/tidy5e/components/TidyTableCell.svelte";
  import TidyTableHeaderCell from "../integrations/tidy5e/components/TidyTableHeaderCell.svelte";
  import TidyTableHeaderRow from "../integrations/tidy5e/components/TidyTableHeaderRow.svelte";
  import TidyTableRow from "../integrations/tidy5e/components/TidyTableRow.svelte";
  import ExpandableContainer from "../integrations/tidy5e/components/ExpandableContainer.svelte";
  import { SvelteMap } from "svelte/reactivity";
  import { preventDefault } from "../utils/preventDefault";

  type ActivitiesTableProps = {
    category: Downtime.CategoryWithActivities;
    categoryControls?: boolean;
    isEditMode?: boolean;
    actor?: dnd5e.documents.Actor5e<"character">;

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
    actor,
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

  const toggle = (activity: Downtime.TrackedItem | string) => {
    const id = typeof activity === "string" ? activity : activity.id;
    openStates.set(id, !openStates.get(id));
    return Boolean(openStates.get(id));
  };

  const editCategory = (categoryId: string) => onEditCategory?.(categoryId);
  const deleteCategory = (categoryId: string) => onDeleteCategory?.(categoryId);
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

<TidyTable key={category.id}>
  {#snippet header()}
    <TidyTableHeaderRow>
      <TidyTableHeaderCell primary
        ><h3>{category.name}</h3>
        <span class="table-header-count">{category.activities.length}</span>
      </TidyTableHeaderCell>
      <TidyTableHeaderCell>Type</TidyTableHeaderCell>
      <TidyTableHeaderCell></TidyTableHeaderCell>
      <TidyTableHeaderCell>Progress</TidyTableHeaderCell>
      <TidyTableHeaderCell class={{ "header-cell-actions": !isEditMode }}>
        {#if isEditMode}
          <a class="tidy-table-button" title="Create Effect"
            ><i class="fas fa-edit"></i></a
          >
          <a class="tidy-table-button" title="Create Effect"
            ><i class="fas fa-trash"></i></a
          >
        {:else}
          <a class="tidy-table-button" title="Create Effect"
            ><i class="fas fa-plus"></i></a
          >
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
            <span class="row-detail-expand-indicator"
              ><i
                class="fa-solid fa-angle-right expand-indicator"
                class:expanded={isOpen(activity)}
              ></i>
            </span>
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
          /><span class="denom"></span></TidyTableCell
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
    padding: 0;
  }
</style>

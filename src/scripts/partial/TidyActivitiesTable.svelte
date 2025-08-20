<script lang="ts">
  import DndTable, { type Column } from "../components/DndTable.svelte";
  import DndTableCell from "../components/DndTableCell.svelte";
  import DndTablePrimaryCell from "../components/DndTablePrimaryCell.svelte";
  import DndTableRow from "../components/DndTableRow.svelte";
  import DndProgress from "../components/DndProgress.svelte";
  import { localize } from "../utils/localize";
  import TidyTable from "../integrations/tidy5e/components/TidyTable.svelte";
  import TidyTableCell from "../integrations/tidy5e/components/TidyTableCell.svelte";
  import TidyTableHeaderCell from "../integrations/tidy5e/components/TidyTableHeaderCell.svelte";
  import TidyTableHeaderRow from "../integrations/tidy5e/components/TidyTableHeaderRow.svelte";
  import TidyTableRow from "../integrations/tidy5e/components/TidyTableRow.svelte";
  import ExpandableContainer from "../integrations/tidy5e/components/ExpandableContainer.svelte";
  import { SvelteMap } from "svelte/reactivity";

  type ActivitiesTableProps = {
    category: Downtime.CategoryWithActivities;
    categoryControls?: boolean;
    isEditMode?: boolean;

    onEditCategory?: (categoryId: string) => void;
    onDeleteCategory?: (categoryId: string) => void;
    onEditActivity?: (itemId: string) => void;
    onDeleteActivity?: (itemId: string) => void;
    onRollActivity?: (itemId: string) => void;
    onSetProgress?: (payload: { id: string; progress: number }) => void;
    onMoveActivityUp?: (itemId: string) => void;
    onMoveActivityDown?: (itemId: string) => void;
  };

  const {
    category,
    categoryControls,
    onEditCategory,
    onDeleteCategory,
    onEditActivity,
    onDeleteActivity,
    onRollActivity,
    onSetProgress,
    onMoveActivityUp,
    onMoveActivityDown,
    isEditMode = true,
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
    console.log(openStates.get(id));
    return Boolean(openStates.get(id));
  };

  const primaryCellClicked = (
    event: MouseEvent,
    activity: Downtime.TrackedItem
  ) => {
    event.preventDefault();
    if (!isEditMode) onRollActivity?.(activity.id);
  };

  const editCategory = (categoryId: string) => onEditCategory?.(categoryId);
  const deleteCategory = (categoryId: string) => onDeleteCategory?.(categoryId);
  const editActivity = (itemId: string) => onEditActivity?.(itemId);
  const deleteActivity = (itemId: string) => onDeleteActivity?.(itemId);
  const setProgress = (id: string, progress: number) =>
    onSetProgress?.({ id, progress });

  function handleDragStart(event: DragEvent, activity: Downtime.TrackedItem) {
    if (event.target !== event.currentTarget) {
      // Allow for draggables within this containing element to be handled elsewhere.
      return;
    }

    const dragData = { type: "downtime-activity", activity };
    event.dataTransfer?.setData("text/plain", JSON.stringify(dragData));
    console.log(event.dataTransfer?.getData("text/plain"));
  }

function onDrop (event: DragEvent, category: Downtime.CategoryWithActivities, activity: Downtime.TrackedItem) {
    event.preventDefault()
    event.stopPropagation()
    console.log(foundry.applications.ux.TextEditor.getDragEventData(event))
    console.log({activity, category})
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
      {#if isEditMode}
        <TidyTableHeaderCell></TidyTableHeaderCell>
      {/if}
    </TidyTableHeaderRow>
  {/snippet}
  {#snippet body()}
    {#each category.activities as activity (activity.id)}
      <TidyTableRow
        rowAttributes={{ "data-tidy-draggable": true }}
        rowContainerAttributes={{ ondrop: (event: DragEvent) => onDrop(event, category, activity)}}
        ondragstart={(event) => handleDragStart(event, activity)}
      >
        <TidyTableCell primary attributes={{ onclick: () => toggle(activity) }}>
          <a class="tidy-table-row-use-button">
            <img class="item-image" src={activity.img} />
            <span class="roll-prompt">
              <i class="fa fa-dice-d20"></i>
            </span>
          </a>

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
          ><input type="number" value={activity.progress} class="numer" /><span
            class="denom">/{activity.completionAt}</span
          ></TidyTableCell
        >
        <TidyTableCell
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
            <a
              type="button"
              id={`downtime-dnd5e-move-controls`}
              class="tidy-table-button"
              data-tid="controls"
              title="Move Activity Up"
              aria-label="Move Activity Up"
              onclick={() => onMoveActivityUp?.(activity.id)}
            >
              <i class="fas fa-chevron-up"></i>
            </a>
            <button
              type="button"
              id={`downtime-dnd5e-move-controls`}
              class="tidy-table-button"
              data-tid="controls"
              title="Move Activity Down"
              aria-label="Move Activity Down"
              onclick={() => onMoveActivityDown?.(activity.id)}
            >
              <i class="fas fa-chevron-down"></i>
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
</style>

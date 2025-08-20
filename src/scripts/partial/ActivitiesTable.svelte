<script lang="ts">
  import DndTable, { type Column } from "../components/DndTable.svelte";
  import DndTableCell from "../components/DndTableCell.svelte";
  import DndTablePrimaryCell from "../components/DndTablePrimaryCell.svelte";
  import DndTableRow from "../components/DndTableRow.svelte";
  import DndProgress from "../components/DndProgress.svelte";
  import { localize } from "../utils/localize";
  import { TrackingAndTraining } from "../TrackingAndTraining";

  type ActivitiesTableProps = {
    category: Downtime.CategoryWithActivities;
    categoryControls?: boolean;
    actor?: dnd5e.documents.Actor5e<'character'>
    isEditMode?: boolean;

    onEditCategory: (categoryId: string) => void;
    onDeleteCategory: (categoryId: string) => void;
    onEditActivity: (itemId: string) => void;
    onDeleteActivity: (itemId: string) => void;
    onRollActivity: (itemId: string) => void;
    onSetProgress: (payload: { id: string; progress: number }) => void;
    onMoveActivityUp: (itemId: string) => void;
    onMoveActivityDown: (itemId: string) => void;
  };

  const {
    category,
    categoryControls,
    onEditCategory,
    onDeleteCategory,
    onEditActivity,
    onDeleteActivity,
    onRollActivity,
    actor,
    onSetProgress,
    onMoveActivityUp,
    onMoveActivityDown,
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

  const primaryCellClicked = (
    event: MouseEvent,
    activity: Downtime.TrackedItem
  ) => {
    event.preventDefault();
    if (!isEditMode) onRollActivity(activity.id);
  };

  const editCategory = (categoryId: string) => onEditCategory(categoryId);
  const deleteCategory = (categoryId: string) => onDeleteCategory(categoryId);
  const editActivity = (itemId: string) => onEditActivity(itemId);
  const deleteActivity = (itemId: string) => onDeleteActivity(itemId);
  const setProgress = (id: string, progress: number) =>
    onSetProgress({ id, progress });

  function onDragStart(event: DragEvent, activity: Downtime.TrackedItem) {
    if (event.target !== event.currentTarget) {
      // Allow for draggables within this containing element to be handled elsewhere.
      return;
    }

    const dragData = { type: "downtime-activity", activity, actor: actor?.uuid };
    event.dataTransfer?.setData("text/plain", JSON.stringify(dragData));
  }
  function onDrop(event: DragEvent, activity: Downtime.TrackedItem) {
    const payload = foundry.applications.ux.TextEditor.getDragEventData(event) as { type: string, activity: {id: string}, actor: string};
    if (payload.type !== 'downtime-activity')
    console.log({ payload, category: activity.category, activity });
    // TrackingAndTraining.moveActivity()
    TrackingAndTraining.moveActivity({
        sourceId: payload.activity.id,
        targetId: activity.id,
        targetActorId: actor?.uuid,
        sourceActorId: payload.actor
    })
  }
</script>

<DndTable name={category.name} {columns}>
  {#snippet header__controls()}
    {#if categoryControls}
      <button
        class="unbutton config-button item-control item-action"
        title={localize("downtime-dnd5e.EditItem")}
        aria-label={localize("downtime-dnd5e.EditItem")}
        onclick={() => editCategory(category.id)}
      >
        <i class="fas fa-edit"></i>
      </button>
      <button
        class="unbutton config-button item-control item-action"
        title={localize("downtime-dnd5e.DeleteItem")}
        aria-label={localize("downtime-dnd5e.DeleteItem")}
        onclick={() => deleteCategory(category.id)}
      >
        <i class="fas fa-trash"></i>
      </button>
    {:else}
      <span></span>
    {/if}
  {/snippet}
  {#each category.activities as activity}
    <DndTableRow
      draggable={true}
      ondragstart={(e) => onDragStart(e, activity)}
      ondrop={(e) => onDrop(e, activity)}
    >
      <DndTablePrimaryCell
        onclick={(event) => primaryCellClicked(event, activity)}
        title={activity.name}
        subtitle={activity.description}
        img={activity.img}
        stacked
      ></DndTablePrimaryCell>
      {#snippet cell__type({ column })}
        <DndTableCell {column}>
          {activity.progressionStyle}
        </DndTableCell>
      {/snippet}
      {#snippet cell__override({ column })}
        <DndTableCell {column}>
          {#if isGm}
            <input
              style="width: 2.5rem"
              type="number"
              bind:value={activity.progress}
              onchange={(e) =>
                setProgress(
                  activity.id,
                  (e.target as HTMLInputElement).valueAsNumber
                )}
            />
          {:else}
            {activity.progress}
          {/if}
          /
          {activity.completionAt}
        </DndTableCell>
      {/snippet}
      {#snippet cell__progress({ column })}
        <DndTableCell {column}>
          <DndProgress value={activity.progress} max={activity.completionAt}
          ></DndProgress>
        </DndTableCell>
      {/snippet}
      {#snippet cell__controls({ column })}
        <DndTableCell {column}>
          <button
            type="button"
            id={`downtime-dnd5e-edit-${column.id}`}
            class="unbutton config-button item-control item-action"
            title={localize("downtime-dnd5e.EditItem")}
            aria-label={localize("downtime-dnd5e.EditItem")}
            onclick={() => editActivity(activity.id)}
          >
            <i class="fas fa-edit"></i>
          </button>
          <button
            type="button"
            id={`downtime-dnd5e-delete-${column.id}`}
            class="unbutton config-button item-control item-action"
            title={localize("downtime-dnd5e.DeleteItem")}
            aria-label={localize("downtime-dnd5e.DeleteItem")}
            onclick={() => deleteActivity(activity.id)}
          >
            <i class="fas fa-trash"></i>
          </button>
          <button
            type="button"
            id={`downtime-dnd5e-move-${column.id}`}
            class="unbutton config-button item-control item-action"
            data-tid={column.id}
            title="Move Activity Up"
            aria-label="Move Activity Up"
            onclick={() => onMoveActivityUp(activity.id)}
          >
            <i class="fas fa-chevron-up"></i>
          </button>
          <button
            type="button"
            id={`downtime-dnd5e-move-${column.id}`}
            class="unbutton config-button item-control item-action"
            data-tid={column.id}
            title="Move Activity Down"
            aria-label="Move Activity Down"
            onclick={() => onMoveActivityDown(activity.id)}
          >
            <i class="fas fa-chevron-down"></i>
          </button>
        </DndTableCell>
      {/snippet}
    </DndTableRow>
  {/each}
</DndTable>

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
</style>

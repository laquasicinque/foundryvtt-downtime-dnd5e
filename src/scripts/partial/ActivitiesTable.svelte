<script lang="ts">
  import DndTable, { type Column } from "../components/DndTable.svelte";
  import DndTableCell from "../components/DndTableCell.svelte";
  import DndTablePrimaryCell from "../components/DndTablePrimaryCell.svelte";
  import DndTableRow from "../components/DndTableRow.svelte";
  import DndProgress from "../components/DndProgress.svelte";
  import { localize } from "../utils/localize";
  import { TrackingAndTraining } from "../TrackingAndTraining";
  import { SvelteMap } from "svelte/reactivity";

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

    onDrop: (payload: { event: DragEvent, activity: Downtime.TrackedItem, actor?: string }) => void
    onDragStart: (payload: { event: DragEvent, activity: Downtime.TrackedItem, actor?: string }) => void
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
    onDragStart: onDragStartProp,
    onDrop: onDropProp,
    isEditMode = false,
  }: ActivitiesTableProps = $props();

  const isGm = $state(game.users.current?.isGM ?? false);

  const columns: Column[] = $derived(
    [
      { id: "type", label: "Type", width: 80 },
      { id: "override", label: "", width: 100 },
      { id: "progress", label: "Progress", width: 150 },
        { id: "controls", label: "", width: isEditMode ? 40 : 28 },
    ].filter((x) => x != null)
  );

  const expandedMap = new SvelteMap()
  const toggleExpand = (activity: Downtime.TrackedItem) => {
    expandedMap.set(activity.id, !expandedMap.get(activity.id))
  }
  const isExpanded = (activity: Downtime.TrackedItem) => {
    return Boolean(expandedMap.get(activity.id))
  }

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
      return;
    }
    onDragStartProp({event, activity, actor: actor?.uuid})
  }

  function onDrop(event: DragEvent, activity: Downtime.TrackedItem) {
    onDropProp({event, activity, actor: actor?.uuid})
  }
</script>

<div>
<DndTable name={category.name} {columns}>
  {#snippet header__controls()}
    {#if categoryControls && isEditMode}
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
    {@const expanded = isExpanded(activity)}
    <DndTableRow
      draggable={true}
      collapsed={!expanded}
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
              value={activity.progress}
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
            {#if isEditMode }
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
          {:else}
          <button
            type="button"
            id={`downtime-dnd5e-delete-${column.id}`}
            class="unbutton config-button item-control item-action"
            title={localize("downtime-dnd5e.DeleteItem")}
            aria-label={localize("downtime-dnd5e.DeleteItem")}
            onclick={() => toggleExpand(activity)}
          >
            <i class="fas" class:fa-expand={!expanded} class:fa-compress={expanded}></i>
          </button>
          {/if}
        </DndTableCell>
      {/snippet}
      {#snippet afterRow()}
        <p>{activity.description}</p>
      {/snippet}
    </DndTableRow>
  {/each}
</DndTable>
</div>
<style>
  div :global(.item-header .config-button) {
    position: relative;
    top: 0;
    left: 0;
    margin: 0 2px;
  }

 div :global(.item-detail.item-controls){
    padding: 0 8px;
  }

  div :global(.item-controls .item-control) {
    padding-right: 4px;
    font-size: var(--font-size-11);
    color: var(--item-control-interactive-color);
  }
</style>

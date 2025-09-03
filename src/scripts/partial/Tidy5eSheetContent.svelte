<script lang="ts">
  import ActorActivityButtons from "./ActorActivityButtons.svelte";
  import CONSTANTS from "../constants";
  import { localize } from "../utils/localize";
  import { TrackingAndTraining } from "../TrackingAndTraining";
  import TidyActivitiesTable from "./TidyActivitiesTable.svelte";
  import { pluckId } from "../utils/pluckId";
  import AuditLogApp from "../apps/AuditLogApp";
  import { getActorCategories, getWorldCategories } from "../utils/categories";
  import { getAllContexts, getContext } from "svelte";
  import {
    getActorActivities,
    getActorActivitiesMap,
    getWorldActivities,
    getWorldActivitiesMap,
  } from "../utils/activities";
  import WorldActivityButtons from "./WorldActivityButtons.svelte";
  import { map } from 'it-al'
  import { clamp } from "../utils/clamp";
  import { preventDefault } from "../utils/preventDefault";
  import { derived } from "svelte/store";
  import { settings } from "../utils/settings";
  import { getSheetFns } from "../lib/reactiveSheet.svelte";
  const {
    actor,
    sheet: sheetRaw,
  }: { sheet: any; actor: dnd5e.documents.Actor5e<"character"> } =
    $props();

  const { pubs, subs } = getSheetFns(sheetRaw);

  const sheet = $derived.by(subs(()=>sheetRaw))

  const dropdownOptions = TrackingAndTraining.getDowntimeDropdownOptions(
    actor.id!
  );

  let isEditMode = $derived(sheet._context.data.unlocked);

  const showToUserEditMode = $derived.by(subs(() =>  (
      !settings.gmOnlyEditMode &&
      !game.users?.current?.isGM
    )
  ));
  const showImportButton = $derived.by(subs(() =>settings.showImportButton));

  const categoriesActor = $derived.by(subs(() =>getActorCategories(actor)));
  const categoriesWorld = $derived.by(subs(() =>getWorldCategories()));

  const categoriesActorIds = $derived(new Set(pluckId(categoriesActor)));
  const categoriesWorldIds = $derived(new Set(pluckId(categoriesActor)));

  const appendDc = (str: string, activity: Downtime.TrackedItem) => {
    if (!activity.dc) return str;

    return `${str} (DC${activity.dc})`;
  };

  const formatProgressionStyle = (activity: Downtime.TrackedItem) => {
    switch (activity.progressionStyle) {
      case "FIXED":
        return localize("downtime-dnd5e.ProgressionStyleFixed");
      case "ABILITY":
        return appendDc(
          CONFIG.DND5E.abilities[activity.ability].label,
          activity
        );
      case "SKILL":
        return appendDc(CONFIG.DND5E.skills[activity.skill].label, activity);
      case "TOOL": {
        const tool = actor.items.find((item) => item.id === activity.tool);
        return appendDc(
          tool ? tool.name : `[${localize("downtime-dnd5e.InvalidTool")}]`,
          activity
        );
      }
      case "MACRO":
        return localize("downtime-dnd5e.ProgressionStyleMacro");
    }
  };

  const mapFormatActivities = map((act: Downtime.TrackedItem) => ({
    ...act,
    progressionStyle: formatProgressionStyle(act),
    dc: act.dc ? `(${localize("downtime-dnd5e.DC")})` : undefined,
    progressPercent: ((act.progress / act.completionAt) * 100).toNearest(1),
    isComplete: act.progress >= act.completionAt,
  }));

  const activitiesActor = $derived.by(subs(() => getActorActivities(actor)))

  const formattedActorActivities = $derived([
    ...mapFormatActivities(activitiesActor),
  ]);

  const activitiesWorld = $derived.by(subs(() => getWorldActivities()));

  const formattedWorldActivities = $derived([
    ...mapFormatActivities(activitiesWorld),
  ]);

  const activitiesActorUncategorized = $derived(
    formattedActorActivities.filter(
      (activity) =>
        !(activity.category && categoriesActorIds.has(activity.category))
    )
  );

  const activitiesWorldUncategorized = $derived(
    formattedWorldActivities.filter(
      (activity) =>
        !(activity.category && categoriesWorldIds.has(activity.category))
    )
  );

  const categorizedActorActivities = $derived(
    categoriesActor
      .map(
        (category) =>
          ({
            ...category,
            activities: formattedActorActivities.filter(
              (x) => x.category === category.id
            ),
          }) as Downtime.CategoryWithActivities
      )
      .filter((x) => x.activities.length)
  );

  const uncategorizedActorActivities = $derived({
    id: "",
    description: "",
    name: localize("downtime-dnd5e.Uncategorized"),
    activities: activitiesActorUncategorized,
  } as Downtime.CategoryWithActivities);

  const categorizedWorldActivities = $derived(
    categoriesWorld
      .map(
        (category) =>
          ({
            ...category,
            activities: formattedWorldActivities.filter(
              (x) => x.category === category.id
            ),
          }) as Downtime.CategoryWithActivities
      )
      .filter((x) => x.activities.length)
  );

  const uncategorizedWorldActivities = $derived({
    id: "",
    description: "",
    name: localize("downtime-dnd5e.Uncategorized"),
    activities: activitiesWorldUncategorized,
  } as Downtime.CategoryWithActivities);

  const editCategory = pubs(
    async (category: string) =>
      await TrackingAndTraining.editCategory(sheet.actor.id!, category)
  );
  const deleteCategory = pubs(
    async (category: string) =>
      await TrackingAndTraining.deleteCategory(sheet.actor.id!, category)
  );
  const editActivity = pubs(
    async (itemId: string) =>
      await TrackingAndTraining.editFromSheet(
        sheet.actor.id!,
        itemId,
        dropdownOptions
      )
  );
  const deleteActivity = pubs(
    async (itemId: string) =>
      await TrackingAndTraining.deleteFromSheet(sheet.actor.id!, itemId)
  );
  const rollActivity = pubs(
    async (itemId: string) =>
      await TrackingAndTraining.progressItem(sheet.actor.id!, itemId)
  );

  const setProgress = pubs(
    async ({ id, progress }: { id: string; progress: number }) => {
      const items = getActorActivitiesMap(actor);
      const item = items.get(id);
      if (!item) return;

      const clampedProgress = clamp(progress, item.completionAt);
      await TrackingAndTraining.updateItemProgressFromSheet(
        actor.id!,
        id,
        clampedProgress.toNearest(1).toString()
      );
    }
  );

  const editWorldCategory = pubs(
    async (category: string) =>
      await TrackingAndTraining.editCategory(sheet.actor.id!, category, true)
  );
  const deleteWorldCategory = pubs(
    async (category: string) =>
      await TrackingAndTraining.deleteCategory(sheet.actor.id!, category, true)
  );
  const editWorldActivity = pubs(
    async (itemId: string) =>
      await TrackingAndTraining.editFromSheet(
        sheet.actor.id!,
        itemId,
        dropdownOptions,
        true
      )
  );
  const deleteWorldActivity = pubs(
    async (itemId: string) =>
      await TrackingAndTraining.deleteFromSheet(sheet.actor.id!, itemId, true)
  );
  const rollWorldActivity = pubs(async (itemId: string) =>
    TrackingAndTraining.progressItem(sheet.actor.id!, itemId, true)
  );
  const setWorldProgress = pubs(
    async ({ id, progress }: { id: string; progress: number }) => {
      const items = getWorldActivitiesMap();
      const item = items.get(id);
      if (!item) return;

      const clampedProgress = clamp(progress, item.completionAt);
      await TrackingAndTraining.updateItemProgressFromSheet(
        actor.id!,
        id,
        clampedProgress.toNearest(1).toString(),
        true
      );
    }
  );

  const onDragStart = ({
    event,
    actor,
    activity,
  }: {
    event: DragEvent;
    actor?: string;
    activity: Downtime.TrackedItem;
  }) => {
    const dragData = { type: "downtime-activity", activity, actor };
    event.dataTransfer?.setData("text/plain", JSON.stringify(dragData));
  };

  const onDrop = pubs(
    async ({
      event,
      actor,
      activity,
    }: {
      event: DragEvent;
      actor?: string;
      activity: Downtime.TrackedItem;
    }) => {
      const payload = foundry.applications.ux.TextEditor.getDragEventData(
        event
      ) as { type: string; activity: { id: string }; actor: string };
      if (payload.type !== "downtime-activity") return;
      event.preventDefault();
      event.stopPropagation();

      await TrackingAndTraining.moveActivity({
        sourceId: payload.activity.id,
        targetId: activity.id,
        targetActorId: actor,
        sourceActorId: payload.actor,
      });
    }
  );

  const addCategory = pubs(
    async () => await TrackingAndTraining.addCategory(actor.id!)
  );

  const addItem = pubs(
    async () => await TrackingAndTraining.addItem(actor.id!, dropdownOptions)
  );

  function exportTrackedItems() {
    return TrackingAndTraining.exportItems(actor.id!);
  }
  function importTrackedItems() {
    return TrackingAndTraining.importItems(actor.id!);
  }

  function openChangeLog() {
    new AuditLogApp({ actor: actor as any }).render({ force: true });
  }
</script>

<div class="downtime-controls">
  <div>
     {#if showImportButton}
      <button
        type="button"
        class="button downtime-dnd5e-import"
        onclick={preventDefault(importTrackedItems)}
        title={localize("downtime-dnd5e.ImportTrackedItemsTooltip")}
      >
        <i class="fas fa-file-export"></i>
        {localize("downtime-dnd5e.ImportTrackedItems")}
      </button>
    {/if}
    <button
      type="button"
      class="button downtime-dnd5e-export"
      title={localize("downtime-dnd5e.ExportTrackedItemsTooltip")}
      onclick={preventDefault(exportTrackedItems)}
    >
      <i class="fas fa-file-import"></i>
      {localize("downtime-dnd5e.ExportTrackedItems")}
    </button>
  </div>
  <button
    type="button"
    class="button downtime-dnd5e-audit"
    title={localize("downtime-dnd5e.ReviewChanges")}
    onclick={preventDefault(openChangeLog)}
  >
    <i class="fas fa-clipboard"></i>
    {localize("downtime-dnd5e.ChangeLog")}
  </button>
</div>

<section class="downtime-dnd5e-controls">
  <h2>Character Downtimes</h2>
  {#if showToUserEditMode}
    <div class="align-end">
      <button
        type="button"
        class="button downtime-dnd5e-new-category"
        title={localize("downtime-dnd5e.CreateNewCategory")}
        onclick={preventDefault(addCategory)}
      >
        <i class="fas fa-folder-plus"></i>
        {localize("downtime-dnd5e.AddCategory")}
      </button>
      <button
        type="button"
        class="button downtime-dnd5e-add"
        onclick={preventDefault(addItem)}
        title={localize("downtime-dnd5e.CreateNewItem")}
      >
        <i class="fas fa-circle-plus"></i>
        {localize("downtime-dnd5e.AddItem")}
      </button>
    </div>
  {/if}
</section>

<div class="tidy-table-container">
  {#if uncategorizedActorActivities.activities.length}
    <TidyActivitiesTable
      {actor}
      isEditMode={isEditMode}
      category={uncategorizedActorActivities}
      onEditCategory={(catId) => editCategory(catId)}
      onDeleteCategory={(catId) => deleteCategory(catId)}
      onEditActivity={(itemId) => editActivity(itemId)}
      onDeleteActivity={(itemId) => deleteActivity(itemId)}
      onRollActivity={(itemId) => rollActivity(itemId)}
      onSetProgress={(payload) => setProgress(payload)}
      {onDragStart}
      {onDrop}
    />
  {/if}

  {#each categorizedActorActivities as category (category.id)}
    <TidyActivitiesTable
      {actor}
      isEditMode={isEditMode}
      {category}
      onEditCategory={(catId) => editCategory(catId)}
      onDeleteCategory={(catId) => deleteCategory(catId)}
      onEditActivity={(itemId) => editActivity(itemId)}
      onDeleteActivity={(itemId) => deleteActivity(itemId)}
      onRollActivity={(itemId) => rollActivity(itemId)}
      onSetProgress={(payload) => setProgress(payload)}
      categoryControls={true}
      {onDragStart}
      {onDrop}
    />
  {/each}
</div>

<hr />

<WorldActivityButtons {actor}>
  <h2>World Downtimes</h2>
</WorldActivityButtons>

<div class="items-list downtime-list">
  {#if uncategorizedWorldActivities.activities.length}
    <TidyActivitiesTable
      isEditMode={isEditMode}
      category={uncategorizedWorldActivities}
      onEditCategory={(catId) => editWorldCategory(catId)}
      onDeleteCategory={(catId) => deleteWorldCategory(catId)}
      onEditActivity={(itemId) => editWorldActivity(itemId)}
      onDeleteActivity={(itemId) => deleteWorldActivity(itemId)}
      onRollActivity={(itemId) => rollWorldActivity(itemId)}
      onSetProgress={(payload) => setWorldProgress(payload)}
      {onDragStart}
      {onDrop}
    />
  {/if}

  {#each categorizedWorldActivities as category (category.id)}
    <TidyActivitiesTable
      isEditMode={isEditMode}
      {category}
      onEditCategory={(catId) => editWorldCategory(catId)}
      onDeleteCategory={(catId) => deleteWorldCategory(catId)}
      onEditActivity={(itemId) => editWorldActivity(itemId)}
      onDeleteActivity={(itemId) => deleteWorldActivity(itemId)}
      onRollActivity={(itemId) => rollWorldActivity(itemId)}
      onSetProgress={(payload) => setWorldProgress(payload)}
      categoryControls={true}
      {onDragStart}
      {onDrop}
    />
  {/each}
</div>

<style>
    .downtime-controls {
        display: flex;
        flex-flow: row;
        justify-content: space-between;
        padding: 0 2px;
    }
  .downtime-dnd5e-controls {
    display: flex;
    align-items: flex-start;
    margin-top: 8px;
  }

  .downtime-dnd5e-controls > div {
    display: flex;
  }

  .downtime-dnd5e-controls button {
    font-size: 10px;
    padding: 0 8px;
    margin: 0 2px;
  }

  .align-end {
    margin-left: auto;
    justify-self: flex-end;
  }
</style>

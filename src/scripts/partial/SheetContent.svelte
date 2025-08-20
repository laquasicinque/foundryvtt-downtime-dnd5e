<script lang="ts">
  import { getContext } from "svelte";
  import type { Snippet } from "svelte";
  import ActorActivityButtons from "./ActorActivityButtons.svelte";
  import CONSTANTS from "../constants";
  import { localize } from "../utils/localize";
  import TrackingAndTraining from "../TrackingAndTraining";
  import { useSheet } from "../composables/useSheet";
  import ActivitiesTable from "./ActivitiesTable.svelte";
  import { pluckId } from "../utils/pluckId";
  import { getActor } from "../utils/getActor";
  import { getActorCategories, getWorldCategories } from "../utils/categories";
  import {
    getActorActivities,
    getActorActivitiesMap,
    getWorldActivities,
    getWorldActivitiesMap,
    setActorActivities,
    setWorldActivities,
  } from "../utils/activities";
  import WorldActivityButtons from "./WorldActivityButtons.svelte";
  import { map } from "../utils/iterables/map";
  import { clamp } from "../utils/clamp";

  const { sheet } = getContext("sheet") as { sheet: { actor: dnd5e.documents.Actor5e; render(bool: boolean): void } };

  const actor = getActor(sheet.actor);

  const dropdownOptions = TrackingAndTraining.getDowntimeDropdownOptions(actor.id!);

  const showToUserEditMode = !game.settings.get(CONSTANTS.MODULE_ID, "gmOnlyEditMode") && !game.users?.current?.isGM;
  const showImportButton = game.settings.get(CONSTANTS.MODULE_ID, "showImportButton");

  const categoriesActor = getActorCategories(actor);
  const categoriesWorld = getWorldCategories();

  const categoriesActorIds = new Set(pluckId(categoriesActor));
  const categoriesWorldIds = new Set(pluckId(categoriesActor));

  const appendDc = (str: string, activity: Downtime.TrackedItem) => {
    if (!activity.dc) return str;

    return `${str} (DC${activity.dc})`;
  };

  const formatProgressionStyle = (activity: Downtime.TrackedItem) => {
    switch (activity.progressionStyle) {
      case "FIXED":
        return localize("downtime-dnd5e.ProgressionStyleFixed");
      case "ABILITY":
        return appendDc(CONFIG.DND5E.abilities[activity.ability].label, activity);
      case "SKILL":
        return appendDc(CONFIG.DND5E.skills[activity.skill].label, activity);
      case "TOOL": {
        const tool = actor.items.find((item) => item.id === activity.tool);
        return appendDc(tool ? tool.name : `[${localize("downtime-dnd5e.InvalidTool")}]`, activity);
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

  const activitiesActor = getActorActivities(actor);
  const formattedActorActivities = [...mapFormatActivities(activitiesActor)];

  const activitiesWorld = getWorldActivities();
  const formattedWorldActivities = [...mapFormatActivities(activitiesWorld)];

  const activitiesActorUncategorized = formattedActorActivities.filter(
    (activity) => !(activity.category && categoriesActorIds.has(activity.category))
  );

  const activitiesWorldUncategorized = formattedWorldActivities.filter(
    (activity) => !(activity.category && categoriesWorldIds.has(activity.category))
  );

  const { isEditMode } = useSheet();

  const categorizedActorActivities = $derived(
    categoriesActor
      .map(
        (category) =>
          ({
            ...category,
            activities: formattedActorActivities.filter((x) => x.category === category.id),
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
            activities: formattedWorldActivities.filter((x) => x.category === category.id),
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

  const hasCharacterDowntimes = $derived(
    !!uncategorizedActorActivities.activities.length || categorizedActorActivities.some((x) => x.activities.length)
  );

  const hasWorldDowntimes = $derived(
    !!uncategorizedWorldActivities.activities.length || categorizedWorldActivities.some((x) => x.activities.length)
  );

  const editCategory = async (category: string) => await TrackingAndTraining.editCategory(sheet.actor.id!, category);
  const deleteCategory = async (category: string) =>
    await TrackingAndTraining.deleteCategory(sheet.actor.id!, category);
  const editActivity = async (itemId: string) =>
    await TrackingAndTraining.editFromSheet(sheet.actor.id!, itemId, dropdownOptions);
  const deleteActivity = async (itemId: string) => await TrackingAndTraining.deleteFromSheet(sheet.actor.id!, itemId);
  const rollActivity = async (itemId: string) => TrackingAndTraining.progressItem(sheet.actor.id!, itemId);
  const setProgress = ({ id, progress }: { id: string; progress: number }) => {
    const items = getActorActivitiesMap(actor);
    const item = items.get(id);

    if (!item) return;

    const clampedProgress = clamp(progress, item.completionAt);
    TrackingAndTraining.updateItemProgressFromSheet(actor.id!, id, clampedProgress.toNearest(1).toString());
  };

  const moveActivityUp = async (itemId: string) => {
    const actor = getActor(sheet.actor.id!);
    const items = getActorActivities(actor);

    const idx = items.findIndex((x) => x.id === itemId);

    if (idx <= 0) return;

    const temp = items[idx - 1];
    items[idx - 1] = items[idx];
    items[idx] = temp;

    setActorActivities(actor, items);
    sheet.render(true);
  };

  const moveActivityDown = async (itemId: string) => {
    const actor = getActor(sheet.actor.id!);
    const items = getActorActivities(actor);

    const idx = items.findIndex((x) => x.id === itemId);

    if (idx <= -1 || idx === items.length - 1) return;

    const temp = items[idx + 1];
    items[idx + 1] = items[idx];
    items[idx] = temp;

    setActorActivities(actor, items);
    sheet.render(true);
  };

  const editWorldCategory = async (category: string) =>
    await TrackingAndTraining.editCategory(sheet.actor.id!, category, true);
  const deleteWorldCategory = async (category: string) =>
    await TrackingAndTraining.deleteCategory(sheet.actor.id!, category, true);
  const editWorldActivity = async (itemId: string) =>
    await TrackingAndTraining.editFromSheet(sheet.actor.id!, itemId, dropdownOptions, true);
  const deleteWorldActivity = async (itemId: string) =>
    await TrackingAndTraining.deleteFromSheet(sheet.actor.id!, itemId, true);
  const rollWorldActivity = async (itemId: string) => TrackingAndTraining.progressItem(sheet.actor.id!, itemId, true);
  const setWorldProgress = ({ id, progress }: { id: string; progress: number }) => {
    const items = getWorldActivitiesMap();
    const item = items.get(id);
    if (!item) return;

    const clampedProgress = clamp(progress, item.completionAt);
    TrackingAndTraining.updateItemProgressFromSheet(actor.id!, id, clampedProgress.toNearest(1).toString(), true);
  };

  const moveWorldActivityUp = async (itemId: string) => {
    const items = getWorldActivities();
    const idx = items.findIndex((x) => x.id === itemId);
    if (idx <= 0) return;

    const temp = items[idx - 1];
    items[idx - 1] = items[idx];
    items[idx] = temp;

    setWorldActivities(items);
    sheet.render(true);
  };

  const moveWorldActivityDown = async (itemId: string) => {
    const items = getWorldActivities();
    const idx = items.findIndex((x) => x.id === itemId);
    if (idx <= -1 || idx === items.length - 1) return;

    const temp = items[idx + 1];
    items[idx + 1] = items[idx];
    items[idx] = temp;

    setWorldActivities(items);
    sheet.render(true);
  };
</script>

{#if !showToUserEditMode}
  <ActorActivityButtons {showImportButton}>
    <h4>Character Downtimes</h4>
  </ActorActivityButtons>
{/if}

<section class="items-list downtime-list">
  {#if uncategorizedActorActivities.activities.length}
    <ActivitiesTable
      category={uncategorizedActorActivities}
      onEditCategory={(catId) => editCategory(catId)}
      onDeleteCategory={(catId) => deleteCategory(catId)}
      onEditActivity={(itemId) => editActivity(itemId)}
      onDeleteActivity={(itemId) => deleteActivity(itemId)}
      onRollActivity={(itemId) => rollActivity(itemId)}
      onSetProgress={(payload) => setProgress(payload)}
      onMoveActivityUp={(itemId) => moveActivityUp(itemId)}
      onMoveActivityDown={(itemId) => moveActivityDown(itemId)}
    />
  {/if}

  {#each categorizedActorActivities as category (category.id)}
    <ActivitiesTable
      {category}
      onEditCategory={(catId) => editCategory(catId)}
      onDeleteCategory={(catId) => deleteCategory(catId)}
      onEditActivity={(itemId) => editActivity(itemId)}
      onDeleteActivity={(itemId) => deleteActivity(itemId)}
      onRollActivity={(itemId) => rollActivity(itemId)}
      onSetProgress={(payload) => setProgress(payload)}
      onMoveActivityUp={(itemId) => moveActivityUp(itemId)}
      onMoveActivityDown={(itemId) => moveActivityDown(itemId)}
      categoryControls={true}
    />
  {/each}
</section>

<hr />

<WorldActivityButtons>
  <h4>World Downtimes</h4>
</WorldActivityButtons>

<section class="items-list downtime-list">
  {#if uncategorizedWorldActivities.activities.length}
    <ActivitiesTable
      category={uncategorizedWorldActivities}
      onEditCategory={(catId) => editWorldCategory(catId)}
      onDeleteCategory={(catId) => deleteWorldCategory(catId)}
      onEditActivity={(itemId) => editWorldActivity(itemId)}
      onDeleteActivity={(itemId) => deleteWorldActivity(itemId)}
      onRollActivity={(itemId) => rollWorldActivity(itemId)}
      onSetProgress={(payload) => setWorldProgress(payload)}
      onMoveActivityUp={(itemId) => moveWorldActivityUp(itemId)}
      onMoveActivityDown={(itemId) => moveWorldActivityDown(itemId)}
    />
  {/if}

  {#each categorizedWorldActivities as category (category.id)}
    <ActivitiesTable
      {category}
      onEditCategory={(catId) => editWorldCategory(catId)}
      onDeleteCategory={(catId) => deleteWorldCategory(catId)}
      onEditActivity={(itemId) => editWorldActivity(itemId)}
      onDeleteActivity={(itemId) => deleteWorldActivity(itemId)}
      onRollActivity={(itemId) => rollWorldActivity(itemId)}
      onSetProgress={(payload) => setWorldProgress(payload)}
      onMoveActivityUp={(itemId) => moveWorldActivityUp(itemId)}
      onMoveActivityDown={(itemId) => moveWorldActivityDown(itemId)}
      categoryControls={true}
    />
  {/each}
</section>

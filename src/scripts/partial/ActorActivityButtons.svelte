<script lang="ts">
  import { getContext } from "svelte";
  import type { Snippet } from "svelte";
  import TrackingAndTraining from "../TrackingAndTraining";
  import { localize } from "../utils/localize";
  import AuditLogApp from "../apps/AuditLogApp.js";
  import { preventDefault } from "../utils/preventDefault";

  type ActorActivityButtonsProps = {
    showImportButton: boolean;
    children?: Snippet;
  };

  let { showImportButton, children }: ActorActivityButtonsProps = $props();

  const { sheet } = getContext("sheet");
  let actorTools = TrackingAndTraining.getActorTools(sheet.actor.id);
  const ABILITIES = TrackingAndTraining.formatAbilitiesForDropdown();
  const SKILLS = TrackingAndTraining.formatSkillsForDropdown();
  const dropdownOptions = { abilities: ABILITIES, skills: SKILLS, tools: actorTools } as Downtime.DropdownOptions;

  function exportTrackedItems() {
    return TrackingAndTraining.exportItems(sheet.actor.id);
  }
  function importTrackedItems() {
    return TrackingAndTraining.importItems(sheet.actor.id);
  }

  function openChangeLog() {
    new AuditLogApp({ actor: sheet.actor }).render({ force: true });
  }
  async function addCategory() {
    await TrackingAndTraining.addCategory(sheet.actor.id);
  }
  async function addItem() {
    await TrackingAndTraining.addItem(sheet.actor.id, dropdownOptions);
  }
</script>

<section class="downtime-dnd5e-controls">
  {@render children?.()}
  <div>
    <button
      type="button"
      class="button downtime-dnd5e-export"
      title={localize("downtime-dnd5e.ExportTrackedItemsTooltip")}
      onclick={preventDefault(exportTrackedItems)}
    >
      <i class="fas fa-file-import"></i>
      {localize("downtime-dnd5e.ExportTrackedItems")}
    </button>
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
      class="button downtime-dnd5e-audit"
      title={localize("downtime-dnd5e.ReviewChanges")}
      onclick={preventDefault(openChangeLog)}
    >
      <i class="fas fa-clipboard"></i>
      {localize("downtime-dnd5e.ChangeLog")}
    </button>
  </div>
  <div class="align-end">
    <button
      type="button"
      class="button downtime-dnd5e-new-category"
      title={localize("downtime-dnd5e.CreateNewCategory")}
      onclick={preventDefault(addCategory)}
    >
      <i class="fas fa-list"></i>
      {localize("downtime-dnd5e.AddCategory")}
    </button>
    <button
      type="button"
      class="button downtime-dnd5e-add"
      onclick={preventDefault(addItem)}
      title={localize("downtime-dnd5e.CreateNewItem")}
    >
      <i class="fas fa-plus"></i>
      {localize("downtime-dnd5e.AddItem")}
    </button>
  </div>
</section>

<style>
  .downtime-dnd5e-controls {
    display: flex;
    align-items: flex-start;
    margin-top: 8px;
  }

  .downtime-dnd5e-controls > div {
    display: flex;
  }

  button {
    font-size: 10px;
    padding: 0 8px;
    margin: 0 2px;
  }

  .align-end {
    margin-left: auto;
    justify-self: flex-end;
  }
</style>

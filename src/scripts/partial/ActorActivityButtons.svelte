<script lang="ts">
  import type { Snippet } from "svelte";
  import { TrackingAndTraining } from "../TrackingAndTraining";
  import { localize } from "../utils/localize";
  import { preventDefault } from "../utils/preventDefault";

  type ActorActivityButtonsProps = {

    children?: Snippet;
    actor: dnd5e.documents.Actor5e
  };

  let { children, actor }: ActorActivityButtonsProps = $props();

  const dropdownOptions = TrackingAndTraining.getDowntimeDropdownOptions(actor.uuid)

  async function addCategory() {
    await TrackingAndTraining.addCategory(actor.id!);
  }
  async function addItem() {
    await TrackingAndTraining.addItem(actor.id!, dropdownOptions);
  }
</script>

<section class="downtime-dnd5e-controls">
  {@render children?.()}
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

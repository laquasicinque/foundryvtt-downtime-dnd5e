<script lang="ts">
  import { getContext } from "svelte";
  import type { Snippet } from "svelte";
  import { TrackingAndTraining } from "../TrackingAndTraining";
  import { localize } from "../utils/localize";
  import { preventDefault } from "../utils/preventDefault";

  type WorldActivityButtonsProps = {
    actor: dnd5e.documents.Actor5e
    children?: Snippet;
  };

  let { actor, children }: WorldActivityButtonsProps = $props();


  const dropdownOptions = TrackingAndTraining.getDowntimeDropdownOptions(actor.id!);

  async function addCategory() {
    await TrackingAndTraining.addCategory(actor.id!, true);
  }
  async function addItem() {
    await TrackingAndTraining.addItem(actor.id!, dropdownOptions, true);
  }
</script>

<section class="downtime-dnd5e-controls">
  {@render children?.()}
  <div>
    <button
      type="button"
      class="button downtime-dnd5e-new-category"
      title={localize("downtime-dnd5e.CreateNewCategory")}
      onclick={preventDefault(addCategory)}
    >
      <i class="fas fa-folder-plus"></i>
      {localize("downtime-dnd5e.AddWorldCategory")}
    </button>
    <button
      type="button"
      class="button downtime-dnd5e-add"
      onclick={preventDefault(addItem)}
      title={localize("downtime-dnd5e.CreateNewItem")}
    >
      <i class="fas fa-circle-plus"></i>
      {localize("downtime-dnd5e.AddWorldItem")}
    </button>
  </div>
</section>

<style>
  .downtime-dnd5e-controls {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
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
</style>

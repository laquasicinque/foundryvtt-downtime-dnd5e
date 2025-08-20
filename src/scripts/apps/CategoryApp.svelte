<script lang="ts">
  import ApplicationForm, { type WithApplicationFormProps } from "../components/ApplicationForm.svelte";
  import FormGroup from "../components/FormGroup.svelte";
  import { getContext } from "svelte";
  import type { Consumer } from "../types";

  type CategoryAppProps = WithApplicationFormProps<{
    category: Downtime.Category;
  }>;

  const { category: categoryProps, onChange }: CategoryAppProps = $props();

  const category = $state<Downtime.Category>({
    id: foundry.utils.randomID(),
    name: "",
    description: "",
  });

  $effect(() => {
    Object.assign(category, categoryProps);
  });
</script>

<ApplicationForm class="standard-form downtime-dnd5e-form" {onChange}>
  <div class="dialog-content standard-form">
    <input name="id" type="hidden" value={category.id} />
    <FormGroup label="Name">
      <input type="text" name="name" bind:value={category.name} />
    </FormGroup>

    <FormGroup label="Description">
      <textarea name="description" bind:value={category.description}></textarea>
    </FormGroup>
  </div>
</ApplicationForm>

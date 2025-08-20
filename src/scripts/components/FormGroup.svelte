<script lang="ts">
  type FormGroupProps = {
    label: string;
    hint?: string;
    children?: Function;
  };

  const { label, hint = "", children }: FormGroupProps = $props();
</script>

<div class="form-group">
  <!-- Let core code handle this -->
  <!-- svelte-ignore a11y_label_has_associated_control -->
  <label>{label}</label>
  <div class="form-fields">
    {@render children?.()}
    {#if hint}
      <span class="hint">{hint}</span>
    {/if}
  </div>
</div>

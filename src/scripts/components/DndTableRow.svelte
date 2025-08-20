<script lang="ts">
  import { getContext, type Snippet } from "svelte";
  import { type TableContextValue, TableInjectionKey, type MaybeGetter } from "../types";
  import type { ColumnNormalized } from "./DndTable.svelte";

  type DndTableRow = {
    children?: Function;
    [name: `cell__${string}`]: Snippet<[{ column: ColumnNormalized }]>;
  };

  let { children, ...props }: DndTableRow = $props();

  const { columnsById } = getContext<TableContextValue>(TableInjectionKey);
</script>

<li class="item">
  <div class="item-row">
    {@render children?.()}
    {#each columnsById() as [id, column]}
      {@const cellId = props[`cell__${id}` as const]}
      {#if cellId}
        {@render cellId({ column })}
      {:else}
        Unslotted {id}
      {/if}
    {/each}
  </div>
</li>

<style>
  .item-row {
    width: 100%;
  }
</style>

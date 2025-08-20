<script lang="ts">
  import { getContext, type Snippet } from "svelte";
  import { type TableContextValue, type MaybeGetter } from "../types";
  import type { ColumnNormalized } from "./DndTable.svelte";
  import type { HTMLLiAttributes } from "svelte/elements";
  import { Iter } from "../utils/iterables/Iter";

  type DndTableRow = {
    children?: Function;
    collapsed?: boolean;
    [name: `cell__${string}`]: Snippet<[{ column: ColumnNormalized }]>;
    afterRow?: Snippet;
  } & HTMLLiAttributes;

  let {
    children,
    collapsed = true,
    ...propsAndSnippets
  }: DndTableRow = $props();

  let [snippets, props] = $derived(
    Iter.fromEntries(propsAndSnippets)
      .partition(([key]) => key.startsWith("cell__") || key === "afterRow")
      .map(Object.fromEntries)
  );

  const { columnsById } = getContext<TableContextValue>("table");
</script>

<li class="item collapsible" class:collapsed {...props}>
  <div class="item-row">
    {@render children?.()}
    {#each columnsById() as [id, column]}
      {@const cellId = snippets[`cell__${id}` as const]}
      {#if cellId}
        {@render cellId({ column })}
      {:else}
        Unslotted {id}
      {/if}
    {/each}
  </div>
  {#if snippets.afterRow}
    <div class="item-description collapsible-content">
      <div class="wrapper">
        <div class="item-summary">
          {@render snippets.afterRow()}
        </div>
      </div>
    </div>
  {/if}
</li>

<style>
  .item-row {
    width: 100%;
  }
</style>

<script module lang="ts">
  export type Column = {
    id: string;
    label: string;
    width?: MaybeGetter<number>;
  };

  export type ColumnNormalized = {
    id: string;
    label: string;
    width: number;
    formatted: string;
  };
</script>

<script lang="ts">
  import { TableInjectionKey, type MaybeGetter } from "../types";
  import { toValue } from "../utils/toValue";
  import { setContext, type Snippet } from "svelte";

  type DndTableProps = {
    name: string;
    columns: Column[];
    children?: Snippet;
    [name: `header__${string}`]: (column: Column) => string | undefined;
  };

  let { name, columns: columnsProp, children, ...props }: DndTableProps = $props();

  const columns = $derived<ColumnNormalized[]>(
    columnsProp.map((column) => {
      const width = toValue(column.width ?? 0).toNearest(1) || 80;

      return {
        id: column.id,
        label: column.label || column.id,
        width,
        formatted: width + "px",
      };
    })
  );

  const columnsById = $derived(new Map(columns.map((column) => [column.id, column])));

  setContext(TableInjectionKey, { columns: () => columns, columnsById: () => columnsById, name: () => name });
</script>

<div class="items-section card">
  <div class="items-header header">
    <h3 class="item-name">{name}</h3>
    {#each columns as column}
      {@const columnId = props[`header__${column.id}` as const]}
      <div
        class="item-header"
        data-column-id={column.id}
        data-column-width={column.width}
        style="width: {column.formatted}"
      >
        {#if columnId}
          {@render (columnId as unknown as Function)?.(column)}
        {:else}
          {column.label}
        {/if}
      </div>
    {/each}
  </div>
  <ol class="item-list unlist">
    {@render children?.()}
  </ol>
</div>

<script lang="ts">
  import type { ColumnNormalized } from "./DndTable.svelte";

  type DndTableCellProps = {
    column: ColumnNormalized;
    children?: Function;
  };

  let { column, children }: DndTableCellProps = $props();
</script>

<div class="item-detail item-{column.id}" data-column-id={column.id} style="width: {column.formatted}">
  {@render children?.()}
</div>

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, HTMLAttributes } from "svelte/elements";

  type TidyTableHeaderRowProps = {
    class?: ClassValue;
    children?: Snippet;
  } & HTMLAttributes<HTMLElement>;

  let {
    class: cssClass,
    children,
    ...rest
  }: TidyTableHeaderRowProps = $props();
</script>

<header
  class="tidy-table-header-row"
  class:cssClass
  data-tidy-sheet-part="table-header-row"
  {...rest}
>
  {@render children?.()}
</header>

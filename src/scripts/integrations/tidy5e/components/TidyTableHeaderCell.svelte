<script lang="ts">
  import { type Snippet } from 'svelte';
  import type { ClassValue, HTMLAttributes } from 'svelte/elements';

  type Props = {
    primary?: boolean;
    columnWidth?: string | null;
    hideUnder?: number;
    title?: string | null;
    children?: Snippet;
    class?: ClassValue;
  } & HTMLAttributes<HTMLElement>;

  let {
    primary = false,
    columnWidth = null,
    title = null,
    hideUnder,
    children,
    class: cssClass,
    ...rest
  }: Props = $props();

  let hideUnderClass = $derived(!!hideUnder ? `hide-under-${hideUnder}` : '');

</script>

<div
  class={['tidy-table-header-cell header-label-cell', cssClass, hideUnderClass, { primary }]}
  data-tidy-sheet-part={"table-header-cell"}
  style:--tidy-table-column-width={columnWidth}
  {title}
  {...rest}
>
  {@render children?.()}
</div>

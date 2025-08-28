<script module>
  const camelToKebab = (str: string) => str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { Iter } from "it-al";
  type TidyTableProps = {
    key: string;
    dataset?: Record<string, string>;
    header?: Snippet<[boolean]>;
    body?: Snippet;
  } & HTMLAttributes<HTMLElement>;

  const { key, dataset, class: cssClass, header, body, ...attributes }: TidyTableProps = $props();

  const datasetAttributes = $derived(
    Iter.fromEntries(dataset ?? {})
      .map(([key, value]) => [`data-${camelToKebab(key)}`, value] as const)
      .collect((x) => Object.fromEntries(x))
  );
</script>

<section class="tidy-table" class:cssClass data-tidy-sheet-part="item-table" data-tidy-section-key={key}>
  {@render header?.(false)}
  <div role="presentation">
    {@render body?.()}
  </div>
</section>

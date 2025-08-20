<script lang="ts">
  import { getContext } from "svelte";
  import { type HTMLAttributes } from "svelte/elements";

  type DndTablePrimaryCellProps = {
    img?: string;
    stacked?: boolean;
    title: string;
    subtitle?: string;
    tags?: string;
    tooltip?: string;
    tooltipDirection?: string;
  } & HTMLAttributes<HTMLDivElement>;

  let {
    img,
    stacked,
    title,
    subtitle,
    tags,
    tooltip,
    tooltipDirection = "LEFT",
    ...rest
  }: DndTablePrimaryCellProps = $props();

  const { isEditMode } = getContext("sheet");
</script>

<div
  {...rest}
  class="item-name item-action item-tooltip"
  class:cursor-pointer={!isEditMode}
  role="button"
  data-tooltip={tooltip}
  data-tooltip-class="dnd5e2 dnd5e-tooltip itemtooltip"
  data-tooltip-direction={tooltipDirection}
>
  {#if img}
    <img class="item-image gold-icon" src={img} draggable="false" alt="" />
  {/if}
  <div class="name" class:name-stacked={stacked}>
    <span class="title">{title}</span>
    <span class="subtitle">{subtitle}</span>
  </div>
  <div class="tags">{tags}</div>
</div>

<style>
  .cursor-pointer {
    cursor: pointer;
  }
</style>

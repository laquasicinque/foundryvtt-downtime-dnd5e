<script lang="ts">
  import type { HTMLProgressAttributes } from "svelte/elements";
  import { clamp } from "../utils/clamp";

  type DndProgressProps = {
    value: number | number[];
    max: number | number[];
  } & HTMLProgressAttributes;

  let { value: rawValue, max: rawMax, ...otherProps }: DndProgressProps = $props();

  const value = $derived(Array.isArray(rawValue) ? Number(rawValue[0]) : Number(rawValue));
  const max = $derived(Number(rawMax));
  const progressPercent = $derived.by(() => {
    const percent = (value / max) * 100
    if (percent >= 100) return 100
    const safePercent = percent.toNearest(1)
    // Unless it's fully complete, we don't want to say 100%
    return clamp(safePercent, 99,0)
  })
</script>

<progress data-percent={progressPercent} {value} {max} {...otherProps}>{progressPercent}%</progress>

<style>
  progress {
    -webkit-appearance: none;
    appearance: none;
  }

  progress::-webkit-progress-value {
    background: linear-gradient(to right, #1c374a 0%, #3b72a6 100%);
    border-radius: 2px;
  }

  progress::-moz-progress-bar {
    background: linear-gradient(to right, #1c374a 0%, #3b72a6 100%);
    border-radius: 2px;
  }

  progress::-webkit-progress-bar,
  progress {
    background-color: var(--dnd5e-color-light-gray);
    height: 20px;
    border-radius: 2px;
    overflow: hidden;
    position: relative;
  }

  progress::after {
    content: attr(data-percent) "%";
    font-size: 13px;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }
</style>

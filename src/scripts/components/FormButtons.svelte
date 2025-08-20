<script lang="ts">
  import type { MaybeGetter } from "../types";
  import { toValue } from "../utils/toValue";
  import { localize } from "../utils/localize";

  export type ExtendedButton = foundry.applications.api.DialogV2.Button & {
    hide?: () => unknown;
    disabled?: MaybeGetter<boolean>;
  };

  type FormButtonsProps = {
    buttons: ExtendedButton[];
  };

  let { buttons: buttonsProp = [] }: FormButtonsProps = $props();

  const defaultDefined = $derived(() => buttonsProp.some((btn) => btn.default));

  const buttons = $derived(
    buttonsProp
      .filter((btn) => !btn.hide?.())
      .map((btn, index) => ({
        ...btn,
        default: index === 0 && !defaultDefined ? true : btn.default,
        label: localize(btn.label as Downtime.I18nKeys),
        disabled: toValue(btn.disabled ?? false),
        style: Object.values(btn.style ?? {})
          .map(([key, value]) => `${key}: ${value};`)
          .join(""),
      }))
  );
</script>

{#each buttons as button}
  <button
    class={button.class}
    type={button.type}
    style={button.style}
    disabled={button.disabled}
    data-action={button.action}
  >
    {#if button.icon}
      <i class={button.icon}></i>
    {/if}
    {button.label}
  </button>
{/each}

<script lang="ts">
  import FormButtons, { type ExtendedButton } from "./FormButtons.svelte";
  import { type Consumer } from "../types";
  import { getContext } from "svelte";
  import type { Configuration } from "../utils/SvelteApplicationMixin";
  import type { HTMLFormAttributes } from "svelte/elements";

  export type WithApplicationFormProps<T> = Prettify<
    T & {
      onChange?: (e: Event | InputEvent) => void;
    }
  >;

  type ApplicationFormProps = {
    class?: string;
    onChange?: (e: Event | InputEvent) => void;
    children?: Function;
  } & HTMLFormAttributes;

  const { class: cls = "", onChange, children, style: styleProp = "", ...props }: ApplicationFormProps = $props();

  const options = getContext<Configuration>("options");
  const onSubmit = getContext<Consumer<SubmitEvent>>("onSubmit");

  const buttons: ExtendedButton[] = options.buttons ?? [];

  const onchange = (e: Event | InputEvent) => {
    e.preventDefault();
    if (onChange) onChange(e);
  };

  const onsubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (onSubmit) onSubmit(e);
  };

  const className = $derived("dialog-content standard-form " + cls);

  const style = $derived("overflow: auto;" + styleProp);
</script>

<form {...props} class={className} {style} {onchange} {onsubmit}>
  {@render children?.()}
  {#if buttons?.length}
    <footer class="form-footer">
      <FormButtons {buttons}></FormButtons>
    </footer>
  {/if}
</form>

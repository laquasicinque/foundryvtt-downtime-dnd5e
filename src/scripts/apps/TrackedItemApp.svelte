<script lang="ts">
  import FormGroup from "../components/FormGroup.svelte";
  import DndProgress from "../components/DndProgress.svelte";
  import CONSTANTS from "../constants";
  import { localize } from "../utils/localize";
  import type { ObjectUnionMerged } from "../types";
  import { pluck } from "it-al";
  import ApplicationForm, { type WithApplicationFormProps } from "../components/ApplicationForm.svelte";

  type TrackedItemAppProps = WithApplicationFormProps<{
    categories: Downtime.Category[];
    dropdownOptions: Downtime.DropdownOptions;
    item: Downtime.TrackedItem;
  }>;

  const { categories, dropdownOptions, item, onChange }: TrackedItemAppProps = $props();

  const HINT_MAP = {
    FIXED: `ProgressionStyleFixedHelp`,
    ABILITY: `ProgressionStyleAbilityCheckHelp`,
    SKILL: `ProgressionStyleSkillCheckHelp`,
    TOOL: `ProgressionStyleToolCheckHelp`,
    MACRO: `ProgressionStyleMacroHelp`,
  } as const;

  const skills = $derived(dropdownOptions.skills);
  const abilities = $derived(dropdownOptions.abilities);
  const tools = $derived(dropdownOptions.tools);

  const form = $state<Omit<ObjectUnionMerged<Downtime.TrackedItem>, "changes" | "schemaVersion">>({
    id: foundry.utils.randomID(),
    name: "",
    img: "icons/svg/book.svg",
    hidden: false,
    category: "",
    description: "",
    chat_icon: "",
    progress: 0,
    progressionStyle: "ABILITY",
    dc: undefined,
    completionAt: 300,
    macroName: "",
    ability: "str",
    skill: "ath",
    tool: "",
    fixedIncrease: 1,
  });

  $effect(() => {
    Object.assign(form, item);
  });

  const hint = $derived(localize(`${CONSTANTS.MODULE_ID}.${HINT_MAP[form.progressionStyle]}`));
  const id = $props.id();
  const macrosId = $derived(`${CONSTANTS.MODULE_ID}_MACROS_${id}`);

  const macros = pluck(game.macros.contents, "name");

  let validMacro = $state(false);

  const checkMacro = () => {
    if (!form.macroName || form.progressionStyle !== "MACRO") {
      validMacro = false;
      return;
    }
    validMacro = !!game.macros.getName(form.macroName);
  };
  const openMacro = (e: MouseEvent) => {
    e.preventDefault();
    if (!form.macroName || form.progressionStyle !== "MACRO") return;
    game.macros.getName(form.macroName)?.sheet?.render(true);
  };
</script>

<ApplicationForm {onChange}>
  <fieldset>
    <legend>Basic Details</legend>
    <FormGroup label="Id">
      <input type="text" name="id" bind:value={form.id} readonly />
    </FormGroup>

    <FormGroup label="Name">
      <input type="text" name="name" bind:value={form.name} />
    </FormGroup>

    <FormGroup label="Image">
      <file-picker name="img" type="image">
        <input class="image" type="text" placeholder="path/to/file.ext" bind:value={form.img} />
        <button
          class="fa-solid fa-file-import fa-fw icon"
          type="button"
          data-tooltip="FILES.BrowseTooltip"
          aria-label="FILES.BrowseTooltip"
          tabindex="-1"
        ></button>
      </file-picker>
    </FormGroup>

    <FormGroup label="Hidden from players?">
      <input type="checkbox" name="hidden" bind:value={form.hidden} />
    </FormGroup>

    <FormGroup label="Category">
      <select name="category" bind:value={form.category}>
        <option value="" selected>None</option>
        {#each categories as category}
          <option value={category.id}>{category.name}</option>
        {/each}
      </select>
    </FormGroup>

    <FormGroup label="Description">
      <textarea name="description" bind:value={form.description} rows="2"></textarea>
    </FormGroup>
  </fieldset>

  <fieldset>
    <legend>Type</legend>
    <FormGroup label="Type" {hint}>
      <select name="progressionStyle" bind:value={form.progressionStyle}>
        <option value="FIXED">Fixed Value</option>
        <option value="ABILITY">Ability Check</option>
        <option value="SKILL">Skill Check</option>
        <option value="TOOL">Tool Check</option>
        <option value="MACRO">Macro</option>
      </select>
    </FormGroup>

    {#if form.progressionStyle === "SKILL"}
      <FormGroup label="Skill">
        <select name="skill" bind:value={form.skill}>
          {#each skills as skill}
            <option value={skill.value}>{skill.label}</option>
          {/each}
        </select>
      </FormGroup>
    {/if}

    {#if form.progressionStyle === "TOOL"}
      <FormGroup label="Tool">
        <select name="tool">
          {#each tools as tool}
            <option value={tool.value}>{tool.label}</option>
          {/each}
        </select>
      </FormGroup>
    {/if}

    {#if form.progressionStyle === "ABILITY"}
      <FormGroup label="Ability">
        <select name="ability">
          {#each abilities as ability}
            <option value={ability.value}>{ability.label}</option>
          {/each}
        </select>
      </FormGroup>
    {/if}

    {#if form.progressionStyle === "FIXED"}
      <FormGroup label="Fixed">
        <input type="text" name="fixed" />
      </FormGroup>
    {/if}

    {#if form.progressionStyle === "MACRO"}
      <FormGroup label="Macro Name">
        <input type="text" name="macro" bind:value={form.macroName} list={macrosId} oninput={checkMacro} />
        {#if validMacro}
          <button onclick={openMacro}>Open</button>
        {/if}
      </FormGroup>
      <datalist id={macrosId}>
        {#each macros as macroName}
          <option value={macroName}></option>
        {/each}
      </datalist>
    {/if}

    {#if !["MACRO", "FIXED"].includes(form.progressionStyle)}
      <FormGroup label="Check DC (Optional)">
        <input type="number" name="dc" bind:value={form.dc} min="1" max="30" />
      </FormGroup>
    {/if}
  </fieldset>

  <fieldset>
    <legend>Progression</legend>
    <FormGroup label="Current Progress">
      <input type="number" name="progress" min="0" max={form.completionAt} bind:value={form.progress} />
    </FormGroup>

    <FormGroup label="Completion Target">
      <input type="number" name="completionAt" min="0" bind:value={form.completionAt} />
    </FormGroup>

    <DndProgress style="width: 100%;" value={form.progress} max={form.completionAt} />
  </fieldset>
</ApplicationForm>

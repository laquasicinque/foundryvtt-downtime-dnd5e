<script lang="ts">
    import { localize } from "../foundry/i18n";
    import { untrack } from "svelte";
    /**
     * The downtime tab. One component for both the core
     * dnd5e sheet and Tidy5e; the sheet adapters only mount it.
     */
    import { WORLD_STORE } from "../model/storage/stores";
    import { v3Api } from "../runtime/api";
    import type { ActorSheet } from "../dnd5e/sheets";
    import type { Actor } from "../foundry/actors";
    import { getSetting } from "../foundry/settings";
    import { isGM as currentUserIsGM } from "../foundry/users";
    import { openReview } from "./history/ReviewApp";
    import StoreSection from "./StoreSection.svelte";
    import { SheetMode } from "./SheetMode.svelte";
    import { StoreState } from "./StoreState.svelte";

    type Props = {
        actor: Actor;
        sheet?: ActorSheet;
    };

    const { actor, sheet }: Props = $props();

    // Edit and Delete only show while the sheet is in edit mode.
    const sheetMode = new SheetMode(untrack(() => sheet));
    $effect(() => sheetMode.subscribe());

    const isGM = currentUserIsGM();
    const hiddenFromPlayers = !isGM && getSetting("gmOnlyMode");

    // A mounted tab belongs to one actor for its lifetime.
    const actorUuid = untrack(() => actor.uuid!);
    const actorStore = new StoreState({ kind: "ACTOR", actorUuid });
    const worldStore = new StoreState(WORLD_STORE);

    // Each store's requirements can depend on the other (the acting character's
    // proficiencies and items, or progress on items in the other store).
    $effect(() => actorStore.subscribe(() => worldStore.refresh()));
    $effect(() => worldStore.subscribe(() => actorStore.refresh()));
</script>

{#if !hiddenFromPlayers}
    <div class="downtime-v3">
        {#if isGM}
            <div class="gm-toolbar">
                <button
                    type="button"
                    title={localize(
                        "downtime-dnd5e.DowntimeTab.PlayerChangesYouHaven",
                    )}
                    onclick={openReview}
                >
                    <i class="fas fa-list-check"></i>
                    {localize("downtime-dnd5e.DowntimeTab.UnreviewedChanges")}
                </button>
                <button
                    type="button"
                    title={localize(
                        "downtime-dnd5e.DowntimeTab.CheckStoredDowntimeData",
                    )}
                    onclick={async () =>
                        (await import("./repair/RepairApp")).openRepair()}
                >
                    <i class="fas fa-screwdriver-wrench"></i>
                    {localize("downtime-dnd5e.DowntimeTab.DataRepair")}
                </button>
                <button
                    type="button"
                    title={localize(
                        "downtime-dnd5e.DowntimeTab.AddsExamplesCoveringEach",
                    )}
                    onclick={() => v3Api.createSampleDowntimes(actorUuid)}
                >
                    <i class="fas fa-flask"></i>
                    {localize("downtime-dnd5e.DowntimeTab.AddSampleDowntimes")}
                </button>
            </div>
        {/if}
        <StoreSection
            title={localize("downtime-dnd5e.DowntimeTab.CharacterDowntimes")}
            store={actorStore}
            actingActorUuid={actorUuid}
            {isGM}
            editMode={sheetMode.editing}
        />
        <StoreSection
            title={localize("downtime-dnd5e.DowntimeTab.WorldDowntimes")}
            store={worldStore}
            actingActorUuid={actorUuid}
            {isGM}
            editMode={sheetMode.editing}
        />
    </div>
{/if}

<style>
    .gm-toolbar {
        display: flex;
        justify-content: flex-end;
        gap: 0.25rem;
    }
    .gm-toolbar button {
        width: auto;
        font-size: 0.8rem;
    }
    .downtime-v3 {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 0.5rem;
    }
</style>

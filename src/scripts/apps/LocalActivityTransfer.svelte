<script lang="ts">
  import ApplicationForm from "../components/ApplicationForm.svelte";
  import FormGroup from "../components/FormGroup.svelte";
  import { getActorActivities, getActorActivitiesMap } from "../utils/activities";

  type LocalActivityTransferProps = {
    actors: dnd5e.documents.Actor5e<"character">[];
  };

  const { actors }: LocalActivityTransferProps = $props();

  let srcActorId = $state("");
  let destActorId = $state("");
  let destActors = $derived(
    srcActorId ? actors.filter((x) => x.id !== srcActorId) : []
  );
  let actorActivities = $derived<Map<string,Downtime.TrackedItem>>(srcActorId ? getActorActivitiesMap(srcActorId) : new Map());
  let selectedActivityId = $state("");
  let selectedActivity = $derived<Downtime.TrackedItem>(selectedActivityId ? actorActivities.get(selectedActivityId) as Downtime.TrackedItem : {} as unknown as Downtime.TrackedItem)

$inspect({ srcActorId,actorActivities, selectedActivity})
</script>

<ApplicationForm>
  <FormGroup label="Source Actor">
    <select name="srcActor" bind:value={srcActorId} placeholder="Pick an Actor">
      {#each actors as actor}
        <option value={actor.id}>{actor.name}</option>
      {/each}
    </select>
  </FormGroup>

  <FormGroup label="Actor Activities" hint={selectedActivity?.description}>
    <select name="activity" bind:value={selectedActivityId}>
      {#each actorActivities as [id, activity]}
        <option value={id}>{activity.name}</option>
      {/each}
    </select>
  </FormGroup>

  <FormGroup label="Destination Actor">
    <select name="destActor" bind:value={destActorId}>
      {#each destActors as actor}
        <option value={actor.id}>{actor.name}</option>
      {/each}
    </select>
  </FormGroup>
</ApplicationForm>

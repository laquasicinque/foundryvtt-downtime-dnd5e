<script lang="ts">
  import { localize } from "../utils/localize";
  import FormGroup from "../components/FormGroup.svelte";
  import DndTable from "../components/DndTable.svelte";
  import DndTableRow from "../components/DndTableRow.svelte";
  import DndTablePrimaryCell from "../components/DndTablePrimaryCell.svelte";
  import DndTableCell from "../components/DndTableCell.svelte";
  import { Iter } from "it-al";
  import ApplicationForm from "../components/ApplicationForm.svelte";

  type AuditLogAppProps = {
    actor: dnd5e.documents.Actor5e;
    changes: Array<{
      timestamp: string;
      user: string;
      activityName: string;
      actionName: string;
      valueChanged: string;
      oldValue: number;
      newValue: number;
      diff: string | number;
      result: string;
      timeTaken: string;
      materials: string;
    }>;
    isGM: boolean;
  };

  const { actor, changes, isGM }: AuditLogAppProps = $props();

  let filterActivity = $state("");

  const filteredChanges = $derived.by(() => {
    if (!filterActivity) return changes;
    return changes.filter((change) => change.activityName === filterActivity);
  });

  const uniqueActivityNames = $derived(Iter.from(changes).pluck("activityName").unique().toArray());

  const columns = [
    { id: "user", label: "User", width: 120 },
    { id: "action", label: "Action", width: 200 },
    { id: "change", label: "Change" },
    { id: "result", label: "Result" },
    { id: "timestamp", label: "Timestamp" },
    { id: "dismiss", label: "Dismiss" },
  ];
</script>

<ApplicationForm>
  <div class="downtime-dnd5e-audit-log dnd5e2 sheet">
    <input type="hidden" name="actorId" value={actor.id} />

    <h1 class="title">{actor.name}'s {localize("downtime-dnd5e.ChangeLog")}</h1>

    <FormGroup label="Activity Type">
      <select bind:value={filterActivity} name="filterActivity" id="filterActivity">
        <option value="">-- All Activities --</option>
        {#each uniqueActivityNames as activityName}
          <option value={activityName}>
            {activityName}
          </option>
        {/each}
      </select>
    </FormGroup>

    <!-- Instructions -->
    <div class="instructions">
      {#if isGM}
        <p>
          {localize("downtime-dnd5e.ChangeLogInstructionsGm")}
        </p>
        <p>
          {localize("downtime-dnd5e.ChangeLogDeleteNote")}
        </p>
      {:else}
        <p>
          {localize("downtime-dnd5e.ChangeLogInstructionsPlayer")}
        </p>
      {/if}
    </div>
    <div class="card">
      <DndTable name="Activity" {columns}>
        {#each filteredChanges as change}
          <DndTableRow>
            <DndTablePrimaryCell title={change.activityName} stacked></DndTablePrimaryCell>
            {#snippet cell__user({ column })}
              <DndTableCell {column}>
                {change.user}
              </DndTableCell>
            {/snippet}
            {#snippet cell__action({ column })}
              <DndTableCell {column}>
                {change.actionName}
              </DndTableCell>
            {/snippet}
            {#snippet cell__change({ column })}
              <DndTableCell {column}>
                {change.diff}
              </DndTableCell>
            {/snippet}
            {#snippet cell__result({ column })}
              <DndTableCell {column}>
                {change.result}
              </DndTableCell>
            {/snippet}
            {#snippet cell__timestamp({ column })}
              <DndTableCell {column}>
                {change.timestamp}
              </DndTableCell>
            {/snippet}
            {#snippet cell__dismiss({ column })}
              <DndTableCell {column}>
                <input type="checkbox" name="dismiss" value={change.timestamp} />
              </DndTableCell>
            {/snippet}
          </DndTableRow>
        {/each}
      </DndTable>
    </div>

    <!-- No Changes Message -->
    {#if filteredChanges.length === 0}
      <div class="no-changes">
        {#if filterActivity}
          <p>No changes found for "{filterActivity}".</p>
        {:else}
          <p>No changes recorded yet.</p>
        {/if}
      </div>
    {/if}
  </div>
</ApplicationForm>

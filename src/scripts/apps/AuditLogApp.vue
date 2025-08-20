<script lang="ts" setup>
import { ref, computed, inject } from "vue";
import { localize } from "../utils/localize.js";
import FormGroup from "../components/FormGroup.vue";
import DndTable from "../components/DndTable.vue";
import DndTableRow from "../components/DndTableRow.vue";
import DndTablePrimaryCell from "../components/DndTablePrimaryCell.vue";
import DndTableCell from "../components/DndTableCell.vue";

const props = defineProps<{
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
    activities: Downtime.TrackedItem[];
}>();

const filterActivity = ref("");

// Computed property to filter changes based on selected activity
const filteredChanges = computed(() => {
    if (!filterActivity.value) {
        return props.changes;
    }
    return props.changes.filter((change) => change.activityName === filterActivity.value);
});

// Get unique activity names for the filter dropdown
const uniqueActivityNames = computed(() => {
    const names = new Set(props.changes.map((change) => change.activityName));
    return Array.from(names).sort();
});

const columns = ref([
    {
        id: "user",
        width: () => 120
    },
    {
        id: "action",
        width: () => 200
    },
    {
        id: "change",
    },
    {
        id: "result",
    },
    {
        id: "timestamp",
    },
    {
        id: "dismiss",
    },
]);
</script>

<template>
    <div class="downtime-dnd5e-audit-log dnd5e2 sheet">
        <input type="hidden" name="actorId" :value="actor.id" />

        <h1 class="title">{{ actor.name }}'s {{ localize("downtime-dnd5e.ChangeLog") }}</h1>

        <FormGroup label="Activity Type">
            <select v-model="filterActivity" name="filterActivity" id="filterActivity">
                <option value="">-- All Activities --</option>
                <option v-for="activityName in uniqueActivityNames" :key="activityName" :value="activityName">
                    {{ activityName }}
                </option>
            </select>
        </FormGroup>

        <!-- Instructions -->
        <div class="instructions">
            <template v-if="isGM">
                <p>
                    {{ localize("downtime-dnd5e.ChangeLogInstructionsGm") }}
                </p>
                <p>
                    {{ localize("downtime-dnd5e.ChangeLogDeleteNote") }}
                </p>
            </template>
            <template v-else>
                <p>
                    {{ localize("downtime-dnd5e.ChangeLogInstructionsPlayer") }}
                </p>
            </template>
        </div>
        <div class="card">
            <DndTable name="Activity" :columns="columns">
                <DndTableRow v-for="change in filteredChanges" :key="change.timestamp">
                    <DndTablePrimaryCell :title="change.activityName" stacked></DndTablePrimaryCell>
                    <template #cell(user)="{ column }">
                        <DndTableCell :column="column">
                            {{ change.user }}
                        </DndTableCell>
                    </template>
                    <template #cell(action)="{ column }">
                        <DndTableCell :column="column">{{ change.actionName }}</DndTableCell>
                    </template>
                    <template #cell(change)="{ column }">
                        <DndTableCell :column="column">{{ change.diff }}</DndTableCell>
                    </template>
                    <template #cell(result)="{ column }">
                        <DndTableCell :column="column">{{ change.result }}</DndTableCell>
                    </template>
                    <template #cell(days)="{ column }">
                        <DndTableCell :column="column">{{ change.timeTaken }}</DndTableCell>
                    </template>
                    <template #cell(materials)="{ column }">
                        <DndTableCell :column="column">{{ change.materials }}</DndTableCell>
                    </template>
                    <template #cell(timestamp)="{ column }">
                        <DndTableCell :column="column">{{ change.timestampFormat }}</DndTableCell>
                    </template>
                    <template #cell(dismiss)="{ column }">
                        <DndTableCell :column="column">
                            <input type="checkbox" name="dismiss" :value="change.timestamp"/>
                        </DndTableCell>
                    </template>
                </DndTableRow>
            </DndTable>
        </div>

        <!-- No Changes Message -->
        <div v-if="filteredChanges.length === 0" class="no-changes">
            <p v-if="filterActivity">No changes found for "{{ filterActivity }}".</p>
            <p v-else>No changes recorded yet.</p>
        </div>
    </div>
</template>

<style>
.downtime-dnd5e-audit-log-form  {
    overflow: auto;
}
</style>

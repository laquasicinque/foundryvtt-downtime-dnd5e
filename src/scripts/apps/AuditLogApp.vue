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
const dismissals = ref<Record<string, boolean>>({});

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

// Handle dismissal checkbox changes
const handleDismissalChange = (timestamp: string, dismissed: boolean) => {
    dismissals.value[timestamp] = dismissed;
};

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

        <!-- Footer with Submit Button -->
        <footer class="form-footer">
            <button type="submit" class="apply-audits" :disabled="!isGM">
                <i class="fas fa-check"></i>
                {{ localize("downtime-dnd5e.DismissSelected") }}
            </button>
        </footer>
    </div>
</template>

<style scoped>
.downtime-dnd5e-audit-log {
    padding: 16px;
    max-height: 80vh;
    overflow-y: auto;
}

.title {
    font-size: 20px;
    font-weight: bold;
    margin: 0 0 16px 0;
    text-align: center;
    border-bottom: 2px solid var(--color-border-light-1);
    padding-bottom: 8px;
}

.filter-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding: 12px;
    background: var(--color-bg-option);
    border-radius: 4px;
}

.filter-label {
    flex-basis: 20%;
    font-weight: 500;
}

.filter-select {
    flex: 1;
    padding: 6px 12px;
    border: 1px solid var(--color-border-light-1);
    border-radius: 4px;
    background: var(--color-bg-option);
}

.instructions {
    margin-bottom: 16px;
    padding: 12px;
    background: var(--color-bg-option);
    border-radius: 4px;
    border-left: 4px solid var(--color-border-info);
}

.instructions p {
    margin: 0 0 8px 0;
    color: var(--color-text-dark-6);
    font-size: 14px;
    line-height: 1.4;
}

.instructions p:last-child {
    margin-bottom: 0;
}

.action-table {
    margin-bottom: 16px;
    border: 1px solid var(--color-border-light-1);
    border-radius: 4px;
    overflow: hidden;
}

table {
    width: 100%;
    border-collapse: collapse;
}

thead {
    background: var(--color-bg-header);
}

th {
    padding: 12px 8px;
    text-align: left;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    border-right: 1px solid var(--color-border-light-1);
    color: var(--color-text-dark-primary);
}

th:last-child {
    border-right: none;
}

.change-row {
    border-bottom: 1px solid var(--color-border-light-2);
    transition: background-color 0.2s;
}

.change-row:hover {
    background: var(--color-bg-option-hover);
}

.change-row:last-child {
    border-bottom: none;
}

td {
    padding: 10px 8px;
    font-size: 13px;
    border-right: 1px solid var(--color-border-light-2);
    vertical-align: top;
}

td:last-child {
    border-right: none;
}

.timestamp {
    font-family: monospace;
    font-size: 11px;
    color: var(--color-text-light-6);
    white-space: nowrap;
}

.user {
    font-weight: 500;
    color: var(--color-text-dark-5);
}

.activity-name {
    font-weight: 500;
    color: var(--color-text-dark-primary);
}

.action-name {
    color: var(--color-text-dark-6);
    font-style: italic;
}

.value-change {
    font-family: monospace;
    font-weight: 500;
    color: var(--color-text-dark-primary);
}

.result,
.time-taken,
.materials {
    color: var(--color-text-dark-6);
}

.dismiss {
    text-align: center;
}

.dismiss input[type="checkbox"] {
    transform: scale(1.2);
    cursor: pointer;
}

.no-changes {
    text-align: center;
    padding: 32px;
    color: var(--color-text-light-6);
    font-style: italic;
    background: var(--color-bg-option);
    border-radius: 4px;
    margin-bottom: 16px;
}

.form-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 16px;
    border-top: 1px solid var(--color-border-light-1);
}

.apply-audits {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    background: var(--color-bg-positive);
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
}

.apply-audits:hover:not(:disabled) {
    background: var(--color-bg-positive-dark);
}

.apply-audits:disabled {
    background: var(--color-border-light-2);
    color: var(--color-text-light-7);
    cursor: not-allowed;
}

.apply-audits i {
    font-size: 14px;
}

/* Responsive design for smaller screens */
@media (max-width: 1000px) {
    .action-table {
        overflow-x: auto;
    }

    table {
        min-width: 800px;
    }

    .filter-row {
        flex-direction: column;
        align-items: stretch;
    }

    .filter-label {
        flex-basis: auto;
        margin-bottom: 4px;
    }
}
</style>

<script setup lang="ts">
import { computed } from "vue";
import DndTable from "../components/DndTable.vue";
import DndTableCell from "../components/DndTableCell.vue";
import DndTablePrimaryCell from "../components/DndTablePrimaryCell.vue";
import DndTableRow from "../components/DndTableRow.vue";
import { useSheet } from "../composables/useSheet";
import { localize } from "../utils/localize";
import DndProgress from "../components/DndProgress.vue";

const { isEditMode } = useSheet();

const props = defineProps<{
    category: Downtime.CategoryWithActivities
    categoryControls?: boolean;
}>();

const isGm = computed(() => game.users.current?.isGM ?? false)

const emit = defineEmits<{
    editCategory: [categoryId: string];
    deleteCategory: [categoryId: string];
    editActivity: [itemId: string];
    deleteActivity: [itemId: string];
    rollActivity: [itemId: string];
    setProgress: [{ id: string, progress: number }];
    moveActivityUp: [itemId: string];
    moveActivityDown: [itemId: string];
}>();

const columns = computed(() =>
    [
        { id: "type", width: 80 },
        { id: "override", width: 100 },
        { id: "progress", width: 150 },
        isEditMode.value ? { id: "controls", width: 80 } : undefined,
    ].filter((x) => x != null),
);

const editCategory = (categoryId: string) => emit("editCategory", categoryId);
const deleteCategory = (categoryId: string) => emit("deleteCategory", categoryId);
const editActivity = (itemId: string) => emit("editActivity", itemId);
const deleteActivity = (itemId: string) => emit("deleteActivity", itemId);
const setProgress = (id: string, progress: number) => emit('setProgress', { id, progress })
</script>

<template>
    <DndTable :name="category.name" :columns="columns">
        <template #header(override)><span></span></template>
        <template #header(controls)>
            <template v-if="props.categoryControls">
                <button
                    class="unbutton config-button item-control item-action"
                    :title="localize('downtime-dnd5e.EditItem')"
                    @click="() => editCategory(category.id)"
                >
                    <i class="fas fa-edit"></i>
                </button>
                <button
                    class="unbutton config-button item-control item-action"
                    :title="localize('downtime-dnd5e.DeleteItem')"
                    @click="() => deleteCategory(category.id)"
                >
                    <i class="fas fa-trash"></i>
                </button>
            </template>
            <span v-else></span>
        </template>
        <DndTableRow v-for="activity of category.activities">
            <DndTablePrimaryCell
                @click.prevent="() => !isEditMode ? emit('rollActivity', activity.id) : undefined"
                :title="activity.name"
                :subtitle="activity.description"
                :img="activity.img"
                stacked
            ></DndTablePrimaryCell>
            <template #cell(type)="{ column }">
                <DndTableCell :column="column">
                    {{ activity.progressionStyle }}
                </DndTableCell>
            </template>
            <template #cell(override)="{ column }">
                <DndTableCell :column="column">
                    <input
                        v-if="isGm"
                        style="width: 2.5rem"
                        type="number"
                        v-model="activity.progress"
                        @change="(e) => setProgress(activity.id, (e.target as HTMLInputElement).valueAsNumber)"
                    /><template v-else>{{ activity.progress }}</template>
                    /
                    {{ activity.completionAt }}
                </DndTableCell>
            </template>
            <template #cell(progress)="{ column }">
                <DndTableCell :column="column">
                    <DndProgress :value="activity.progress" :max="activity.completionAt"></DndProgress>
                </DndTableCell>
            </template>
            <template #cell(controls)="{ column }">
                <DndTableCell :column="column">
                    <button
                        class="unbutton config-button item-control item-action"
                        :id="`downtime-dnd5e-edit-${column.id}`"
                        :title="localize('downtime-dnd5e.EditItem')"
                        @click="() => editActivity(activity.id)"
                    >
                        <i class="fas fa-edit"></i>
                    </button>
                    <button
                        class="unbutton config-button item-control item-action"
                        :id="`downtime-dnd5e-delete-${column.id}`"
                        :title="localize('downtime-dnd5e.DeleteItem')"
                        @click="() => deleteActivity(activity.id)"
                    >
                        <i class="fas fa-trash"></i>
                    </button>
                    <button
                        class="unbutton config-button item-control item-action"
                        :id="`downtime-dnd5e-move-${column.id}`"
                        :data-tid="column.id"
                        title="Move Activity Up"
                        @click.prevent="() => emit('moveActivityUp', activity.id)"
                    >
                        <i class="fas fa-chevron-up"></i>
                    </button>
                    <button
                        class="unbutton config-button item-control item-action"
                        :id="`downtime-dnd5e-move-${column.id}`"
                        :data-tid="column.id"
                        title="Move Activity Down"
                        @click.prevent="() => emit('moveActivityDown', activity.id)"
                    >
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </DndTableCell>
            </template>
        </DndTableRow>
    </DndTable>
</template>

<style scoped>
.item-header .config-button {
    position: relative;
    top: 0;
    left: 0;
    margin: 0 2px;
}

.item-controls {
    padding-right: 4px;
}
</style>

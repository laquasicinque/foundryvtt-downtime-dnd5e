<script setup lang="ts">
import { inject } from "vue";
import TrackingAndTraining from "../TrackingAndTraining";
import { localize } from "../utils/localize";
import AuditLogApp from "../apps/AuditLogApp.js";

const props = defineProps<{
    showImportButton: boolean;
}>();

const { sheet } = inject("sheet");
let actorTools = TrackingAndTraining.getActorTools(sheet.actor.id);
const ABILITIES = TrackingAndTraining.formatAbilitiesForDropdown();
const SKILLS = TrackingAndTraining.formatSkillsForDropdown();
const DROPDOWN_OPTIONS = { abilities: ABILITIES, skills: SKILLS, tools: actorTools };

function exportTrackedItems() {
    return TrackingAndTraining.exportItems(sheet.actor.id);
}
function importTrackedItems() {
    return TrackingAndTraining.importItems(sheet.actor.id);
}

function openChangeLog() {
    new AuditLogApp(sheet.actor).render({ force: true });
}
async function addCategory() {
    await TrackingAndTraining.addCategory(sheet.actor.id);
}
async function addItem() {
    await TrackingAndTraining.addItem(sheet.actor.id, DROPDOWN_OPTIONS);
}
</script>

<template>
    <section class="downtime-dnd5e-controls">
        <slot />
        <div>
        <button
            type="button"
            class="button downtime-dnd5e-export"
            :title="localize('downtime-dnd5e.ExportTrackedItemsTooltip')"
            @click="() => exportTrackedItems()"
        >
            <i class="fas fa-file-import"></i>
            {{ localize("downtime-dnd5e.ExportTrackedItems") }}
        </button>
        <button
            v-if="props.showImportButton"
            type="button"
            class="button downtime-dnd5e-import"
            @click="() => importTrackedItems()"
            :title="localize('downtime-dnd5e.ImportTrackedItemsTooltip')"
        >
            <i class="fas fa-file-export"></i> {{ localize("downtime-dnd5e.ImportTrackedItems") }}
        </button>
        <button
            type="button"
            class="button downtime-dnd5e-audit"
            :title="localize('downtime-dnd5e.ReviewChanges')"
            @click.prevent="() => openChangeLog()"
        >
            <i class="fas fa-clipboard"></i> {{ localize("downtime-dnd5e.ChangeLog") }}
        </button>
        </div>
        <div class="align-end">
        <button
            type="button"
            class="button downtime-dnd5e-new-category"
            :title="localize('downtime-dnd5e.CreateNewCategory')"
            @click.prevent="() => addCategory()"
        >
            <i class="fas fa-list"></i> {{ localize("downtime-dnd5e.AddCategory") }}
        </button>
        <button
            type="button"
            class="button downtime-dnd5e-add"
            @click.prevent="() => addItem()"
            :title="localize('downtime-dnd5e.CreateNewItem')"
        >
            <i class="fas fa-plus"></i> {{ localize("downtime-dnd5e.AddItem") }}
        </button>
        </div>
    </section>
</template>

<style scoped>
.downtime-dnd5e-controls {
    display: flex;
    align-items: flex-start;
    margin-top: 8px;
}

.downtime-dnd5e-controls > div {
    display: flex
}

button {
    font-size: 10px;
    padding: 0 8px;
    margin: 0 2px;
}

.align-end {
    margin-left:auto;
    justify-self: flex-end;
}
</style>

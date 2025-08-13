<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import FormGroup from '../components/FormGroup.vue'
import DndProgress from '../components/DndProgress.vue'
import CONSTANTS from '../constants';
import { localize } from '../utils/localize';

const props = defineProps<{
    categories: Downtime.Category[],
    dropdownOptions: {abilities: {value: string, type: string, label: string}[], skills: {value: string, type: string, label: string}[], tools: {value: string, type: string, label: string}[]}
    item: Downtime.TrackedItem
}>()

const skills = computed(() => props.dropdownOptions.skills)
const abilities = computed(() => props.dropdownOptions.abilities)
const tools = computed(() => props.dropdownOptions.tools)

const HINT_MAP = {
    FIXED: `ProgressionStyleFixedHelp`,
    ABILITY: `ProgressionStyleAbilityCheckHelp`,
    SKILL: `ProgressionStyleSkillCheckHelp`,
    TOOL: `ProgressionStyleToolCheckHelp`,
    MACRO: `ProgressionStyleMacroHelp`,
} as const


const form = reactive<Omit<Downtime.TrackedItem, 'changes'|'schemaVersion'>>({
    id: foundry.utils.randomID(),
    name: "",
    img: "icons/svg/book.svg",
    hidden: false,
    category: "",
    description: "",
    progress:0,
    progressionStyle: "ABILITY",
    dc: undefined,
    completionAt: 300,
    macro: ""
})

watch(() => props.item, (newVal) => {
    Object.assign(form, newVal)
}, {deep:true, immediate: true})

const hint = computed(() => localize(`${CONSTANTS.MODULE_ID}.${HINT_MAP[form.progressionStyle]}`))

const macrosId = computed(() => `${CONSTANTS.MODULE_ID}_MACROS_${Math.random().toString(16)}`)

const macros = game.macros.contents.map(x=>x.name)

const validMacro = ref(false)
const checkMacro = () => validMacro.value = !!game.macros.getName(form.macro)
const openMacro = () => game.macros.getName(form.macro)?.sheet?.render(true)

</script>

<template>
    <div class="dialog-content standard-form">
        <fieldset>
            <legend>Basic Details</legend>
        <FormGroup label="Id">
            <input type="text" name="id" v-model="form.id" readonly ></input>
        </FormGroup>

        <FormGroup label="Name">
            <input type="text" name="name" v-model="form.name" ></input>
        </FormGroup>

        <FormGroup label="Image">
            <file-picker name="img" type="image">
                <input class="image" type="text" placeholder="path/to/file.ext" v-model="form.img">
                <button class="fa-solid fa-file-import fa-fw icon" type="button" data-tooltip="FILES.BrowseTooltip"
                    aria-label="FILES.BrowseTooltip" tabindex="-1"></button>
            </file-picker>
        </FormGroup>

        <FormGroup label="Hidden from players?">
            <input type="checkbox" name="hidden" v-model="form.hidden">
        </FormGroup>

        <FormGroup label="Category">
            <select name="category" v-model="form.category">
                <option value="" selected>None</option>
                <option v-for="cat of categories" :value="cat.id" :key="cat.id">{{ cat.name }}</option>
            </select>
        </FormGroup>

        <FormGroup label="Description">
            <textarea name="description" v-model="form.description" rows="2"></textarea>
        </FormGroup>

        </fieldset>


        <fieldset>
            <legend>Type</legend>
            <FormGroup label="Type" :hint="hint">
                <select name="progressionStyle" v-model="form.progressionStyle">
                    <option value="FIXED">Fixed Value</option>
                    <option value="ABILITY">Ability Check</option>
                    <option value="SKILL">Skill Check</option>
                    <option value="TOOL">Tool Check</option>
                    <option value="MACRO">Macro</option>
                </select>
            </FormGroup>

            <FormGroup label="Skill" v-if="form.progressionStyle === 'SKILL'">
                <select name="skill" v-model="form.skill">
                    <option v-for="skill of skills" :value="skill.value">{{ skill.label }}</option>
                </select>
            </FormGroup>

            <FormGroup label="Tool" v-if="form.progressionStyle === 'TOOL'">
                <select name="tool">
                    <option v-for="tool of tools" :value="tool.value">{{ tool.label }}</option>
                </select>
            </FormGroup>

            <FormGroup label="Ability" v-if="form.progressionStyle === 'ABILITY'">
                <select name="ability">
                    <option v-for="ability of abilities" :value="ability.value">{{ ability.label }}</option>
                </select>
            </FormGroup>

            <FormGroup label="Fixed" v-if="form.progressionStyle === 'FIXED'">
                <input type="text" name="fixed"/>
            </FormGroup>

            <template v-if="form.progressionStyle === 'MACRO'">
                <FormGroup label="Macro Name">
                    <input type="text" name="macro" v-model="form.macro" :list="macrosId" @input="() => checkMacro()"></input>
                    <button v-if="validMacro" @click.prevent="() => openMacro()">Open</button>
                </FormGroup>
                <datalist :id="macrosId">
                    <option v-for="macroName of macros" :value="macroName"></option>
                </datalist>
            </template>
                    <FormGroup label="Check DC (Optional)" v-if="!['MACRO','FIXED'].includes(form.progressionStyle)">
            <input type="number" name="dc" v-model="form.dc" min="1" max="30">
        </FormGroup>
        </fieldset>


        <fieldset>
            <legend>Progression</legend>
        <FormGroup label="Current Progress">
            <input type="number" name="progress"  min="0" :max="form.completionAt" v-model.number="form.progress">
        </FormGroup>

        <FormGroup label="Completion Target">
            <input type="number" name="completionAt" min="0" v-model.number="form.completionAt">
        </FormGroup>

        <DndProgress style="width: 100%;" :value="form.progress" :max="form.completionAt"/>
        </fieldset>
    </div>
</template>

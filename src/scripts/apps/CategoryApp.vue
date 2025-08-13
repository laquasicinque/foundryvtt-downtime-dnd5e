<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import FormGroup from '../components/FormGroup.vue'
import CONSTANTS from '../constants';

const props = defineProps<{
    category:Downtime.Category
}>()

const category = reactive<Downtime.Category>({
    id: foundry.utils.randomID(),
    description: '',
    name: ''
})

watch(() => props.category, (newVal) => {
    Object.assign(category, props.category)
}, {immediate:true, deep:true})
</script>

<template>
    <div class="dialog-content standard-form">
        <input name="id" type="hidden" :value="category.id"></input>
        <FormGroup label="Name">
            <input type="text" name="name" v-model="category.name" ></input>
        </FormGroup>

        <FormGroup label="Description">
            <textarea name="description" v-model="category.description"></textarea>
        </FormGroup>
    </div>
</template>

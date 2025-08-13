<script setup lang="ts">
import { computed } from 'vue';


const props = defineProps<{
    buttons: Record<string,foundry.applications.api.DialogV2.Button>
}>()


const defaultDefined = computed(() => Object.values(props.buttons).some(btn => btn.default))
const buttons = computed(()=>Object.values(props.buttons).map((btn, index) => ({
    ...btn,
    default: index === 0 && !defaultDefined.value ? true : btn.default,

})))
</script>

<template>
    <button
        v-for="btn of buttons"
        :key="btn.label"
        :data-action="btn.action"
        :type="btn.type"
        :class="btn.class"
        :style="btn.style"
    >
        <i v-if="btn.icon" :class="btn.icon"></i>
        {{ btn.label }}
    </button>
</template>

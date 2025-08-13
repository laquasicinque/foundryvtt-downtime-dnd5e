<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{ value: number, max: number }>()

const value = computed(() => Array.isArray(props.value) ? Number(props.value[0]) : Number(props.value))
const max = computed(() =>  Number(props.max))

const progressPercent = computed(() => ((value.value/max.value)*100).toNearest(1))
</script>

<template>
    <progress :data-percent="progressPercent" :="props">
        {{ progressPercent }}
    </progress>
</template>

<style >
progress {
    -webkit-appearance: none;
}

progress::-webkit-progress-value {
    background: linear-gradient(to right, #1c374a 0%, #3b72a6 100%);
    border-radius: 2px;
}

progress::-moz-progress-bar {
    background: linear-gradient(to right, #1c374a 0%, #3b72a6 100%);
    border-radius: 2px;
}

progress::-webkit-progress-bar,
progress {
    background-color: var(--dnd5e-color-light-gray);
    height: 20px;
    border-radius: 2px;
    overflow: hidden;
    position: relative;
}

progress::after {
    content: attr(data-percent) "%";
    font-size: 13px;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
}
</style>

<script setup lang="ts">
import { getCurrentInstance, inject, onMounted, onUnmounted } from 'vue';
import { useSheet } from '../composables/useSheet';

const {
    img,
    stacked,
    title,
    subtitle,
    tags,
    tooltip,
    tooltipDirection = "LEFT"
} = defineProps<{
    img?: string,
    stacked?: boolean,
    title: string,
    subtitle?: string
    tags?: string
    tooltip?: string
    tooltipDirection?: string
}>()

const { isEditMode } = useSheet()
</script>

<template>
    <div
        class="item-name item-action item-tooltip"
        :class="{ 'cursor-pointer': !isEditMode }"
        role="button"
        :data-tooltip="tooltip"
        data-tooltip-class="dnd5e2 dnd5e-tooltip itemtooltip"
        :data-tooltip-direction="tooltipDirection"
    >
        <img v-if="img" class="item-image gold-icon" :src="img" draggable="false"/>
        <div class="name" :class="{'name-stacked':stacked}">
            <span class="title">{{ title }}</span>
            <span class="subtitle">{{subtitle}}</span>
        </div>
        <div class="tags">{{ tags }}</div>
    </div>
</template>

<style >
.cursor-pointer {
    cursor:pointer;
}
</style>

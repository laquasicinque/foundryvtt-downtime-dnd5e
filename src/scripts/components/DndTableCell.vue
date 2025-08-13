<script lang="ts" setup>
const props = defineProps<{
    column: {
        id: string,
        width: number,
        formatted: string
    }
}>()
</script>

<template>
    <div class="item-detail" :class="`item-${props.column.id}`" :data-column-id="props.column.id" :style="{width: column.formatted}" >
        <slot />
    </div>
</template>

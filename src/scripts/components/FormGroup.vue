<script lang="ts" setup>
// Shorthand for vtt provided form-groups
const props = defineProps<{
    label: string,
    hint?: string
}>()

</script>

<template>
    <div class="form-group">
        <label>{{  label }}</label>
        <div class="form-fields">
            <slot />
            <p v-if="hint" class="hint">{{hint}}</p>
        </div>
    </div>
</template>

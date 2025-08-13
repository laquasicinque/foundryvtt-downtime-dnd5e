<script setup lang="ts">
import { MaybeGetter, TableInjectionKey } from '../types';
import { inject} from 'vue'

const props = defineProps<{}>()

const { columns, columnsById, name } = inject(TableInjectionKey)!

defineSlots<{
    default():void
}& Record<`cell(${string})`, (props: {
        column: {
            id: string,
            width: number,
            formatted: string
    }
}) => any>>()

</script>

<template>
    <li class="item">
        <div class="item-row">
            <slot />
            <slot v-for="[id, col] of columnsById" :name="`cell(${id})`" :column="col" >
                Unslotted {{ id }}
            </slot>
        </div>
    </li>
</template>

<style scoped>
.item-row {
    width: 100%;
}
</style>

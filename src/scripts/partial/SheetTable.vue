<script setup lang="ts">
import {ComponentInstance, provide,  ref} from 'vue'
import SheetPrimaryColumn from './SheetPrimaryColumn.vue';
const props = defineProps<{
    data: unknown[],
    columns: string[],
    name: string
}>()




</script>

<template>
    <div class="items-section card">
        <div class="items-header header">
            <h3 class="item-name">{{ name }}</h3>
            <div v-for="col of columns" class="item-header" data-column-width="80" style="width:80px">
                <slot :name="`header(${col})`">{{ col }}</slot>
            </div>
        </div>
        <ol class="item-list unlist">
            <li v-for="item of data" class="item">
                <div class="item-row">
                    <slot name="primary" :data="item"/>

                    <template v-for="col of columns">
                        <slot :name="col" :data="item">
                                {{ columns }}
                        </slot>
                    </template>
                </div>
            </li>
        </ol>
    </div>
</template>

<style scoped>
.item-row {
    width: 100%;
}

</style>

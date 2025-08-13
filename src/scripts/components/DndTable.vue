<script setup lang="ts" generic="T extends string">
import { MaybeGetter, TableInjectionKey, TableInjectionKeyType, TableInjectionValue } from "../types";
import { computed, provide, toValue } from "vue";

const props = defineProps<{
    name: string;
    columns: {
        id: T;
        width?: MaybeGetter<number>;
    }[];
}>();

type SlotType = {
    default(props: {}): any;
} & Record<`header(${string})`, (props: { column: { id: string; width: number; formatted: string } }) => any>;

defineSlots<SlotType>();

const columns = computed(() =>
    props.columns.map((col) => {
        const width = toValue(col.width ?? 0).toNearest(1) || 80;

        return {
            id: col.id,
            width,
            formatted: width + "px",
        };
    }),
);

const columnsById = computed(() => new Map(columns.value.map((col) => [col.id, col])));

provide(TableInjectionKey, { columns, columnsById, name: props.name });
</script>

<template>
    <div class="items-section card">
        <div class="items-header header">
            <h3 class="item-name">{{ name }}</h3>
            <div
                v-for="col of columns"
                :key="col.id"
                class="item-header"
                :data-column-id="col.id"
                :data-column-width="col.width"
                :style="{ width: col.formatted }"
            >
                <slot :name="`header(${col.id})`" :column="col">{{ col.id }}</slot>
            </div>
        </div>
        <ol class="item-list unlist">
            <slot />
        </ol>
    </div>
</template>

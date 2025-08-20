<script setup lang="ts">
import { computed, toValue, MaybeRefOrGetter } from "vue";
import { localize } from "../utils/localize";

const props = defineProps<{
    buttons: Record<
        string,
        foundry.applications.api.DialogV2.Button & { hide?: () => unknown; disabled?: MaybeRefOrGetter<boolean> }
    >;
}>();

const defaultDefined = computed(() => Object.values(props.buttons).some((btn) => btn.default));
const buttons = computed(() =>
    Object.values(props.buttons)
        .filter((btn) => !btn.hide?.())
        .map((btn, index) => ({
            ...btn,
            default: index === 0 && !defaultDefined.value ? true : btn.default,
            label: localize(btn.label as Downtime.I18nKeys),
        })),
);
</script>

<template>
    <button
        v-for="btn of buttons"
        :key="btn.label"
        :data-action="btn.action"
        :type="btn.type"
        :class="btn.class"
        :style="btn.style"
        :disabled="toValue(btn.disabled)"
    >
        <i v-if="btn.icon" :class="btn.icon"></i>
        {{ btn.label }}
    </button>
</template>

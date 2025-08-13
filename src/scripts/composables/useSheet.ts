/**
 * An attempt to combine vue reactivity with the sheet shenanigans
 */

import { inject, InjectionKey, readonly, Ref, toRefs } from "vue";

export const SheetKey = Symbol() as InjectionKey<{
    isEditMode: Readonly<Ref<boolean>>
}>

export function useSheet() {
    return inject(SheetKey)!
}

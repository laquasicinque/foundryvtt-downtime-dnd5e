/**
 * An attempt to combine vue reactivity with the sheet shenanigans
 */

import { getContext } from "svelte";

export const SheetKey = Symbol();

export function useSheet() {
  return getContext("sheet")!;
}

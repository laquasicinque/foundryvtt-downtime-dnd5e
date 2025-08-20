import { PrettifyType, RequiredProps, UnionToIntersection } from "fvtt-types/utils";
import CONSTANTS from "./constants.js";
import { localize } from "./utils/localize.js";

type UnionSameKeys<T> = keyof T;

type OnlySelectedPartial<T, K extends keyof T> = T extends unknown
  ? Prettify<Partial<Pick<T, K>> & Required<Omit<T, K>>>
  : never;

export function createTrackedItem<T extends Downtime.TrackedItem>(
  options: OnlySelectedPartial<T, UnionSameKeys<T>>,
): T {
  return {
    id: foundry.utils.randomID(),
    category: "",
    description: "",
    progress: 0,
    completionAt: game.settings.get(CONSTANTS.MODULE_ID, "totalToComplete"),
    changes: [],
    schemaVersion: 1,
    ...options,
    name: options.name || localize("downtime-dnd5e.NewItem"),
    img: options.img || "icons/svg/book.svg",
  } as unknown as T;
}

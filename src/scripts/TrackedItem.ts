import CONSTANTS from "./constants.js";
import type { OnlySelectedPartial, UnionSameKeys } from "./types.js";
import { localize } from "./utils/localize.js";

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

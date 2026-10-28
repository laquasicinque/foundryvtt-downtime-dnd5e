/**
 * Ambient types for this module and for consumers of its API
 * (`game.modules.get("downtime-dnd5e").api`). Classes are the read-only
 * domain objects the API returns; `*Data` are the stored JSON shapes.
 */
type Prettify<T> = {
    [P in keyof T]: T[P];
} & {};

declare namespace Downtime {
    type MODULE_ID = "downtime-dnd5e";

    /** `game.modules.get("downtime-dnd5e").api`. */
    type ModuleApi = typeof import("../runtime").moduleApi;

    type SheetRenderHook = (
        sheet: import("../dnd5e/sheets").ActorSheet,
        form: HTMLFormElement,
        context: Record<string, unknown>,
        options: { isFirstRender?: boolean } & Record<string, unknown>,
    ) => void;

    type TrackedItem = import("../domain/TrackedItem").TrackedItem;
    type Method = import("../domain/Method").AnyMethod;
    type Milestone = import("../domain/Milestone").Milestone;
    type HistoryEvent = import("../domain/HistoryEvent").AnyHistoryEvent;
    type Category = import("../domain/Category").Category;

    type TrackedItemData = import("./data").TrackedItemData;
    type MethodData = import("./data").MethodData;
    type MilestoneData = import("./data").MilestoneData;
    type HistoryEventData = import("./data").HistoryEventData;
    type CategoryData = import("./data").CategoryData;
    type StoreRef = import("./data").StoreRef;
    type Command = import("./commands").Command;
    type CommandResult = import("./commands").CommandResult;

    type I18nKeys = keyof typeof import("../languages/en.json");

    /** An actor (any type), or its uuid/id. */
    type ActorResolvable = import("../foundry/actors").Actor | string;
}

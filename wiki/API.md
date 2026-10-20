# Downtime API

```js
const downtime = game.modules.get("downtime-dnd5e").api;
```

`api.v3` is the same object, for macros written during the V3 preview. The old V1 functions are still there as deprecated wrappers (see the end of this page).

## Stores

Every tracked item lives in a **store**: a character (or NPC), or the world. Anywhere a `store` is asked for, you can pass:

- `"world"`;
- an `Actor`, an actor uuid (`"Actor.abc123"`, token actors included) or an actor id;
- a store ref: `{ kind: "WORLD" }` or `{ kind: "ACTOR", actorUuid }`.

Items are identified by **id**, not by name. Ids are stable: they survive renames, and moves keep them unless the destination already has one.

## Reading

Reads are async: an actor in a compendium is loaded first. Each has a `…Sync` version that only reads what's already in memory. World actors, token actors and the world store always are; a compendium actor only while its sheet is open, or for a few minutes after it was loaded. Use the sync versions only where that's enough.

| Function | Returns |
| --- | --- |
| `getItems(store)` / `getItemsSync(store)` | `Promise<TrackedItem[]>` / `TrackedItem[]` |
| `getItem(store, itemId)` / `getItemSync(store, itemId)` | `Promise<TrackedItem \| null>` / `TrackedItem \| null` |
| `getWorldItems()` | `TrackedItem[]` (same as `getItemsSync("world")`; the world store is always in memory) |
| `getCategories(store)` / `getCategoriesSync(store)` | `Promise<Category[]>` / `Category[]` |
| `getContributions(store, itemId, options?)` | `Promise` of the totals overall, per method, per result, per contributor, and contributor × method |
| `exportStore(store)` | `Promise` of the store as a V3 export object (see *Import and export*) |
| `previewTransfer(source, itemIds, dest, mode, choices?)` / `previewTransferSync(…)` | what a move/copy would do (see *Moving and copying*) |

Actors in a **locked** compendium can be read but not changed: writes fail with `LOCKED`.

### Domain classes

Getters return **read-only** objects wrapped around the stored data. They're deep-frozen; every write resolves to a *new* instance. Use `toJSON()` for a mutable copy of the data. The classes are on `api.classes` for `instanceof` checks.

`TrackedItem`

- `id`, `name`, `img`, `description`, `categoryId`, `hidden`, `progress` (`{ target, min, max }`), `requirements`, `approval`, `quarantine`
- derived: `state` (`value`, `completed`, `locked`, `milestoneFires`, `pendingApprovals`, …), `value`, `percent`, `completed`, `locked`
- `methods`, `method(id)`, `milestones`, `milestone(id)`, `history`, `event(id)`
- `availability(actor)`: whether the item's own requirements are met (`{ state: "AVAILABLE" }`, or `HIDE` / `DISABLE` / `DISABLE_WITH_HINT` with the unmet requirements and hints)
- `describeRequirement(requirement)`: plain-English text, e.g. "Requires proficiency in Athletics"
- `contributions(options?)`, `planRevert()` (a dry run: what reverting the latest change would undo, and what blocks it)
- writes (see below): `adjust`, `set`, `revertLatest`, `setState`, `update`, `delete`, `dismissEvents`
- `toJSON()`, `toV1()`

`Method` (subclasses per kind: `AbilityMethod`, `SkillMethod`, `ToolMethod`, `FixedMethod`, `ManualMethod`, `MacroMethod`)

- `id`, `kind`, `name`, `description`, `img`, `hidden`, `requirements`, `usage`, plus kind-specific fields (`skill`, `dc`, `results`, …)
- `availability(actor, macroResults?)`: item and method requirements together
- `usageFor(actor)`: `{ count, tier, index }` under the method's usage rule, or `null`
- `use(options)` (see `useMethod`)

`Milestone`: `label`, `at`, `match` (`CROSS` / `EXACT` / `EVERY`), `maxTimes`, `actions`, `fires`, `remaining`, `reached`.

`HistoryEvent` (subclasses per kind: `MethodEvent`, `AdjustEvent`, `SetEvent`, `LegacyEvent`, `MilestoneEvent`, `ApprovalEvent`, `RevertEvent`, `StateEvent`)

- `id`, `kind`, `seq`, `timestamp` (ms, or `null` for "date unknown"), `date`, `contributor`, `contributorName`, `dismissed`, `note`, `isReverted`
- `MilestoneEvent.actions` (live status, approvals applied), `MilestoneEvent.resolve(actionId, approved, recipientUuids?)` (GM)

## Writing

Every write goes to the active GM, who validates and applies it, so players can call these too where they're allowed. Writes resolve to the updated `TrackedItem`, or throw a `DowntimeError` with a `code`:

`INVALID` · `NOT_FOUND` · `FORBIDDEN` · `LOCKED` · `UNAVAILABLE` (requirements or usage limit) · `BLOCKED` (revert blocked) · `NO_GM` (needs a GM online) · `FAILED`

| Function | Who | Notes |
| --- | --- | --- |
| `useMethod(store, itemId, methodId, options)` | owners | `options`: `{ actor?, roll?, amount?, macroResult?, macroRequirements? }`. No dialogs: pass the result you already have. `actor` is the acting character for world items. `roll` is `{ formula, total, natural, activityDc, rolled: { kind, key, label }, rollMode, messageId }`. |
| `adjust(store, itemId, delta, { note? })` | GM | |
| `set(store, itemId, value, { note?, reason? })` | GM; owners with `reason: "API"` on their own character | |
| `revert(store, itemId)` | GM | Reverts the latest change, with everything it caused (milestones, granted items, …). History is a stack: only the latest change can be reverted. |
| `createItem(store, data)` | GM | Partial data is filled in with defaults; the new item is returned. |
| `setCategories(store, categories)` / `reorderItems(store, ids)` | GM | |
| `transfer(source, itemIds, dest, mode, choices?)` | GM | See below. |
| `importData(store, data)` | GM | See below. |
| `createSampleDowntimes(actor)` | GM | Adds the sample downtimes to the actor and the world. Safe to run again. |

Using a method through the sheet (rolls, dialogs, the chat card) is the sheet's job. `useMethod` only records a result.

```js
// A world downtime, used by the selected token's character with a fixed amount
const item = downtime.getWorldItems().find((i) => i.name === "Rebuild the Bridge");
const method = item.methods.find((m) => m.kind === "FIXED");
await downtime.useMethod("world", item.id, method.id, { actor: token.actor.uuid });
```

## Moving and copying

`transfer(source, itemIds, dest, mode, choices)` moves (`"MOVE"`: keeps progress and history) or copies (`"COPY"`: fresh progress, no history) items. References between items (requirements on other items' progress or milestones, "adjust another item" actions) keep working:

- items an item depends on, or that depend on a moved item, are **taken along** by default;
- `choices.references[key]` can instead be `"COPY_DEPENDENCY"`, `"REMOVE"` (drop that requirement/action) or `"KEEP"`;
- rewards for "this item's character" on items moving to the world switch to "whoever reaches the milestone" (`choices.recipients[key] = "KEEP"` to keep them);
- categories are matched by name, created if missing (`choices.categories[name] = "UNCATEGORISED"` to skip).

Call `previewTransfer` with the same arguments first: it returns the plan, with every issue, its `key`, its `options` and the current `choice`. Nothing is written.

## Import and export

`exportStore(store)` returns, and `downloadExport(store)` downloads:

```json
{ "module": "downtime-dnd5e", "schemaVersion": 3, "exportedAt": "2026-10-21T10:00:00.000Z", "items": [], "categories": [] }
```

`importData(store, data)` adds the items of a parsed export file to the store. It accepts V3 exports and V1 files (actor exports, world exports, and exported settings). V1 data is converted on the way in. Ids that already exist get new ones, and categories are matched by name. Unreadable parts of an item are kept aside for repair, not dropped. Resolves to `{ format, imported, skipped, notes }`.

## Macros

Macros get the usual `actor` plus a `downtime` object of plain data:

| Field | Method macro | Requirement macro | Milestone action macro |
| --- | --- | --- | --- |
| `item` | ✓ | ✓ | ✓ |
| `state` (derived: `value`, `completed`, …) | ✓ | ✓ | ✓ |
| `method` | ✓ | ✓ | |
| `requirement` | | ✓ | |
| `store`, `milestoneId`, `milestone`, `action` | | | ✓ |
| `undo` (`true` when run as the undo macro) | | | ✓ |
| `actor`, `user` | ✓ | ✓ | ✓ |

**Method macros** (method kind "Macro") run on the user's client. Return:

- a number, or `{ delta }`: the progress to add;
- `{ roll }`: a `Roll`, resolved against the method's results table like a check;
- nothing: no change, nothing recorded.

**Requirement macros** run on the user's client when they use the method, and return `true` / `false`. Until then they never hide or disable anything.

**Milestone action macros** run on the GM's client when the milestone fires. Give the action an **undo macro** (run with `downtime.undo === true`) to make reverting possible; without one, reverting the change that ran it is blocked.

## Hooks

| Hook | Arguments | When |
| --- | --- | --- |
| `downtime-dnd5e.registerActivityAdapters` | `registry` | On ready. Register roll adapters for your module's activity types. |
| `downtime-dnd5e.methodUsed` | `item`, `event` | On the client that used a method, with the updated `TrackedItem` and its `MethodEvent`. |

### Activity roll adapters

Tool methods roll through the tool's activities. Built-in adapters handle dnd5e's `check`, `save` and `utility` activities. Other modules can add their own:

```js
Hooks.once("downtime-dnd5e.registerActivityAdapters", (registry) => {
    registry.register({
        type: "my-activity",          // the activity's type
        source: "my-module",
        options(activity, actor) {    // each way it can roll; [] = not rollable
            return [{
                label: activity.name,
                roll: async () => {
                    const [roll] = (await activity.rollSomething()) ?? [];
                    return roll ? { roll, rolled: { kind: "CUSTOM", key: activity.id, label: activity.name }, dc: null } : null;
                },
            }];
        },
    });
});
```

Rolls that go through dnd5e's roll pipeline are attached to the downtime chat card instead of posting their own message.

## The V1 functions

The V1 functions on `api` work on V3 data and log a one-time deprecation warning. They find items **by name**:

| V1 | V3 replacement | Behaviour under V3 |
| --- | --- | --- |
| `updateActivity(actor, name, progress)`, `updateActivityProgress` | `set(actor, itemId, value, { reason: "API" })` | Sets progress (recorded as an API set); owners may call it for their own characters. |
| `updateWorldActivity(name, progress)`, `updateWorldActivityProgress` | `set("world", itemId, value)` | GM only. |
| `getActivities(actor)`, `getActivitiesForActor`, `getActivity(actor, name)` | `getItems`, `getItem` | V1-shaped copies (`progress`, `completionAt`, `progressionStyle`, `changes`, …) from `item.toV1()`. `tool` is the dnd5e tool key, where V1 stored the tool item's id. |
| `getWorldActivities()`, `getWorldActivity(name)` | `getItems("world")`, `getItem("world", id)` | Same. |
| `getWorldCategories()` | `getCategories("world")` | Plain category data. `getCategories(actor)` is the V3 function now: same fields, as `Category` objects. |

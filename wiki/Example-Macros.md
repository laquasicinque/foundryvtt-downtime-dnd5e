A few sample macros to get you started. They use the module API (see [API](./API.md)); every write goes to the GM, so players can run the ones that only touch their own characters.

```js
const downtime = game.modules.get("downtime-dnd5e").api;
```

Tracked items are found by **id** in the API. These examples look one up by name first, which is fine for a macro you keep for one item.

### Roll a d20 and add the result to progress

```js
const downtime = game.modules.get("downtime-dnd5e").api;
const actor = game.actors.getName("Joe Smith");
const item = (await downtime.getItems(actor)).find((i) => i.name === "Roll Lots of D20s");

const roll = await new Roll("1d20").evaluate();
await roll.toMessage({ flavor: `Progress on ${item.name}` });

// adjust() changes progress by an amount (GM). Milestones fire as usual.
await downtime.adjust(actor, item.id, roll.total);
```

### Set progress to a value

```js
const downtime = game.modules.get("downtime-dnd5e").api;
const actor = game.actors.getName("Actor Name");
const item = (await downtime.getItems(actor)).find((i) => i.name === "Item Name");

// set() with reason "API" is also allowed for the character's owner.
await downtime.set(actor, item.id, 42, { reason: "API" });
```

### Skill check with a DC and a variable increase

Usually you'd give the item a **Skill check** method with a DC and results instead (no macro needed). As a macro:

```js
const downtime = game.modules.get("downtime-dnd5e").api;
const actor = game.actors.getName("Test Doggo");
const item = (await downtime.getItems(actor)).find((i) => i.name === "Crafting Example");

const [check] = await actor.rollSkill({ skill: "med", target: 15 });
if (check.total >= 15) {
    const increase = await new Roll("1d10").evaluate();
    await increase.toMessage({ flavor: "Crafting progress" });
    await downtime.adjust(actor, item.id, increase.total);
}
```

### A method macro (the item's own "Macro" method)

A tracked item's **Macro** method runs a macro when it's used and adds whatever the macro returns: a number, `{ delta }`, `{ roll }` (resolved against the method's results), or nothing for no change. The macro gets `actor` and a `downtime` object with the item, its state and the method.

```js
// Progress equals the character's Intelligence modifier, at least 1.
return Math.max(1, actor.system.abilities.int.mod);
```

### Add a tracked item to a character

```js
const downtime = game.modules.get("downtime-dnd5e").api;
const actor = game.actors.getName("Test Actor");

// Partial data is filled in with defaults: no methods or milestones unless you give them.
const item = await downtime.createItem(actor, {
    name: "Learn Elvish",
    img: "icons/sundries/books/book-open-brown.webp",
    progress: { target: 10, min: 0, max: 10 },
    methods: [
        {
            id: foundry.utils.randomID(),
            kind: "FIXED",
            name: "Lessons",
            effect: { delta: { kind: "STATIC", value: 1 } },
            countsAs: "SUCCESS",
        },
    ],
    milestones: [
        {
            id: foundry.utils.randomID(),
            label: "Fluent",
            at: 10,
            match: "CROSS",
            maxTimes: 1, // once; null would fire every time progress crosses 10
            actions: [{ id: foundry.utils.randomID(), kind: "COMPLETE" }],
        },
    ],
});
```

The easier way to make one is **Add item** on the sheet, which has ready-made starters.

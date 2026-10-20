How to use the module, from both sides of the screen. (Screenshots to follow.)

# The Downtime tab

Every character and NPC sheet gets a **Downtime** tab (core dnd5e sheets and Tidy5e). It has two lists:

- **Character downtimes**: this character's own tracked items.
- **World downtimes**: shared by everyone, like rebuilding a bridge the whole party works on. When you use one from a sheet, that sheet's character is the one doing it.

Each list is grouped by category.

## A tracked item

A row shows the item's picture, name and a progress bar. Click the name to expand it: the description, then each **method** (a way to make progress) on its own line, with what it does ("Athletics · DC 12 · +1 on a pass"), any usage limit ("2 uses left") and why it can't be used right now, if it can't.

Click a method to use it. Checks roll through dnd5e as usual (advantage, situational bonuses, roll modes); tool checks let you pick which tool and which of its activities. The result goes to chat as one card: the roll, what it was worth, progress before and after, and any milestones it reached.

The progress bar shows how far along it is. Items that can go negative (a reputation, say) are drawn either side of a zero mark; repeating items show progress through the current batch and how many have been made.

The clock button opens the item's **History**.

## Badges

- ✓ complete · 🔒 locked
- GMs also see: hidden from players, has requirements (red when this character doesn't meet them), rewards waiting for approval, and data that couldn't be read.

# For GMs

## Changing progress

- **−** and **+** inside the progress bar change it by 1.
- Click the number to type: `+5` or `-2` changes it by that much, `12` sets it. Enter applies, Esc cancels.

## Item menu

Click **⋮** or right-click an item's header: **Edit**, **Lock / Unlock**, **Duplicate**, **Delete**. While the sheet is in edit mode, Edit and Delete also appear as buttons on each item.

## Drag and drop

- Drag an item to reorder it, or onto another category to move it there.
- Drag a method to reorder it, or onto another item (even on another sheet) to move it there.
- Hold **Ctrl** (**Cmd** on macOS) while dropping to copy instead.
- Drop an item on another character's list or the world list to move it there (or copy it, with Ctrl/Cmd). A dialog shows what else has to come along (items it depends on), what happens to categories, and anything that wouldn't work there; nothing happens until you confirm.

A copy always starts fresh: no progress, no history.

## Toolbar

- **Add item** opens the item editor for a new item.
- **Categories** edits the categories of that list.
- **Export / Import**: save the list to a file, or add items from a file (this version's files and older ones).
- **Unreviewed changes**: everything players have done that you haven't marked as reviewed yet, across every character and the world, plus rewards waiting for approval.
- **Data repair**: problems found reading stored data, with fixes, and **Restore from V1** to convert a character's or the world's original data again.
- **Add sample downtimes**: examples of every feature, on this character and the world. Safe to run twice.

# Creating and editing items

The editor walks through the item in steps; **Next** and **Back** move between them, or click any tab.

- **Presets**: start from a shape (goal, goal that locks, open-ended tally, repeating batches) or a starter (train with a tool, learn a language, craft, research, work a job, carousing, reputation, recuperate). This only fills in the form; nothing is saved until you click Create or Save.
- **1 Basics**: name, picture, category, description, hidden from players.
- **2 Progress**: target, minimum and maximum. Leave the target blank for an open-ended tally; a minimum below 0 lets progress go negative.
- **3 Methods**: the ways to make progress.
- **4 Milestones**: what happens along the way, and whether rewards need GM approval.
- **5 Who can use it**: requirements for the whole item.

Tabs with something to fix show a red count, and saving takes you to the first one.

## Methods

| Kind | What it does |
| --- | --- |
| Ability / Skill check | Rolls the check; the results table decides the progress. |
| Tool check | Rolls with one of the character's matching tools (through its activities), or a fallback skill/ability if they have none. |
| Fixed amount | Adds the same amount every time. |
| Manual entry | Someone types the amount (optionally GM only). |
| Macro | Runs a macro; it returns the amount, or a roll to look up in the results table. |

**Results** are a list checked top to bottom; the first that matches decides the progress: a natural 20, beating the DC by 5 or more, meeting the DC, … with "otherwise" last. Each result counts as a success, a failure, or neither.

**Usage** limits or changes a method after a number of uses: per character, per player, or for everyone together, counting every use, successes, failures or particular results. From use N it can give a different amount, use different results, show a message and stop, or disappear.

**Requirements** on a method work like the item's (below).

## Milestones

A milestone fires when progress **reaches** a value, lands **exactly** on it, or **every** N (repeating). It can fire once, a set number of times, or every time. Its actions:

- **Mark complete**, **Lock** (nobody can use it until unlocked), **Announce in chat**
- **Grant an item** or **Apply an effect** (drop the item or effect onto the field) to the character who reached it, this item's character, specific characters, or the contributors (filtered by how much they contributed). "GM picks" lets you choose who gets it when approving.
- **Add a tracked item** (a fresh copy of another item), **Adjust another item's progress**, **Run a macro** (with an optional undo macro).

With approval on, rewards a player triggers wait for you: approve or reject them from the chat card, the item's history or the unreviewed changes list.

## Requirements

Requirements hide an item or method, disable it, or disable it with a hint, unless the character:

- is proficient (or has expertise, or a bonus) in a skill, or proficient with a tool;
- has an ability score or modifier;
- owns an item (drop one to match it);
- has some progress on, or reached a milestone of, another tracked item;
- passes a macro check.

GMs always see and can use everything, with a note saying what a player would be missing.

# History and reverting

The **History** window lists every change: who, when, what was rolled and what it was worth. Filter it by kind, method, result or person; the **Contributions** tab totals it up per person, method and result. Players see their own contributions only. GMs can add notes and mark entries reviewed.

**Revert** undoes the latest change and everything it caused (milestones, granted items, effects, items it added), and it's on the latest entry in the history. Only the latest change can be reverted; revert again to go further back. If something can't be undone (a macro without an undo macro, an added item that already has progress of its own), the revert is blocked and the history says why.

# Players

Players see their own characters' items and the world items they qualify for, use methods, and see their own history. Creating and editing items is for GMs.

# Settings

- **GM only mode**: hide the tab from players and whisper everything to the GM.
- **Default completion target**: the target new items start with.
- **Announce completion for**: whose milestones are announced to everyone by default (player characters, NPCs, both or none).
- **Milestone actions need GM approval**: the default for items set to "world default".
- **Debug**: extra logging.

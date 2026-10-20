# Downtime Dnd5e

![Latest Release Download Count](https://img.shields.io/github/downloads/laquasicinque/foundryvtt-downtime-dnd5e/latest/module.zip?color=2b82fc&label=DOWNLOADS&style=for-the-badge)
[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fdowntime-dnd5e&colorB=006400&style=for-the-badge)](https://forge-vtt.com/bazaar#package=downtime-dnd5e)
![Foundry Core Compatible Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Flaquasicinque%2Ffoundryvtt-downtime-dnd5e%2Fmaster%2Fsrc%2Fmodule.json&label=Foundry%20Version&query=$.compatibility.verified&colorB=orange&style=for-the-badge)
![Latest Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Flaquasicinque%2Ffoundryvtt-downtime-dnd5e%2Fmaster%2Fsrc%2Fmodule.json&label=Latest%20Release&prefix=v&query=$.version&colorB=red&style=for-the-badge)
[![Foundry Hub Endorsements](https://img.shields.io/endpoint?logoColor=white&url=https%3A%2F%2Fwww.foundryvtt-hub.com%2Fwp-json%2Fhubapi%2Fv1%2Fpackage%2Fdowntime-dnd5e%2Fshield%2Fendorsements&style=for-the-badge)](https://www.foundryvtt-hub.com/package/downtime-dnd5e/)
![GitHub all releases](https://img.shields.io/github/downloads/laquasicinque/foundryvtt-downtime-dnd5e/total?style=for-the-badge)

A module for keeping track of downtime activities. Currently keeps track of both individual and world downtimes for both PCs and NPCs.

Does your group do a lot of downtime activities? Got a lot of factions? Need a simple quest log or timer? Do you have a hard time keeping track of... well... anything? Then this is the mod for you!

_Downtime 5e_ is a module for the dnd5e system in Foundry VTT that adds a tab to all actor sheets (character and NPC) that lets you add and keep track of just about anything you can keep track of with a number and a progress bar. Finally working on that History proficiency? It's in here. Learning how to use thieves tools? In here. Need to keep track of how much of the town's water supply you've accidentally (I hope) poisoned? Quest progress! Countdown timers! Faction reputation! If you can measure it with a percentage, you can track it with this module.

## Installation

It's always easiest to install modules from the in game add-on browser.

To install this module manually:
1.  Inside the Foundry "Configuration and Setup" screen, click "Add-on Modules"
2.  Click "Install Module"
3.  In the "Manifest URL" field, paste the following url:
`https://raw.githubusercontent.com/laquasicinque/foundryvtt-downtime-dnd5e/master/src/module.json`
4.  Click 'Install' and wait for installation to complete
5.  Don't forget to enable the module in game using the "Manage Module" button

## History

This project comes from a line of other downtimes such as [Crash's Tracking & Training (formerly known as Crash's Downtime Tracking)](https://github.com/crash1115/5e-training) and [Ethck's 5e Downtime Tracking](https://github.com/Ethck/Ethck-s-Downtime-Tracking), both of which have not been updated in a while/are no longer maintained.

This project was created as a continuation of the crash project [Crash's Tracking & Training (formerly known as Crash's Downtime Tracking)](https://github.com/crash1115/5e-training) and previously maintained by [p4535992](https://github.com/p4535992/foundryvtt-downtime-dnd5e).

## Differences between [Crash's](https://github.com/crash1115/5e-training), [Ethck's](https://github.com/Ethck/Ethck-s-Downtime-Tracking) and [Downtime Dnd5e](https://github.com/laquasicinque/foundryvtt-downtime-dnd5e)

[Ethck's 5e Downtime Tracking](https://github.com/Ethck/Ethck-s-Downtime-Tracking) focuses more on the implementation of "skill challenge" type downtime activities like the ones you find in xanathar's guide to everything. it lets you construct activities that are made up of multiple rolls, maybe for different skills/abilities/etc that you have to choose between, creating a sort of branching structure with varying dc's for each one. it gives you different outputs depending on how many successes/failures you get and how the activity is configured

[Crash's Tracking & Training (formerly known as Crash's Downtime Tracking)](https://github.com/crash1115/5e-training) is more of a general progress tracking tool. it's a little bit more flexible/less specifically scoped and the activities you can create are nowhere near as complex as his, but it's more useful for tracking things that take multiple days/weeks to complete and things that are less "one and done".

[Downtime Dnd5e](https://github.com/laquasicinque/foundryvtt-downtime-dnd5e) This project was created as a continuation of the crash project [Crash's Tracking & Training (formerly known as Crash's Downtime Tracking)](https://github.com/crash1115/5e-training)  but with the code rewritten to follow "standard" development rules like use the module id as prefix for the css rule, the standard folder structure ecc.

## Features

- **Tracked items** on any character or NPC, or shared by the whole world: progress towards a target, an open-ended tally, a reputation that can go negative, or a repeating activity (a batch every N, forever).
- **Ways to progress** ("methods"): ability, skill and tool checks (using the tool's own activities), a fixed amount, an amount someone enters, or a macro. Results tables decide how much a roll is worth (natural 20s, beating the DC by 5, …), and usage rules can limit or reduce a method after a number of uses.
- **Milestones** along the way: mark complete, lock, announce in chat, grant items or effects, add another tracked item, adjust another item's progress, or run a macro. Rewards can wait for GM approval, and the GM can pick who gets them.
- **Requirements**: hide or disable an item or method unless the character has a skill, a tool proficiency, an item, a score, or progress elsewhere.
- **History** of every change with who made it, a contributions breakdown, reverting the latest change (undoing what it caused), and a GM review list.
- **Chat cards** for each use, with the roll attached and live updates for approvals and reverts.
- **Starters** for common downtime activities, drag and drop to reorder, move or copy between characters and the world, import/export, and a data repair tool.

Existing data from earlier versions is converted automatically the first time a GM logs in; the old data is kept untouched as a backup.

## How To Use

Check out the [wiki](/wiki/Home.md) for instructions, sample macros, compatibility info and API documentation. Macros used by methods, requirements and milestones get the acting `actor` and a `downtime` object; see [API → Macros](./wiki/API.md#macros).

## Api

All information about the API can be found here: [API](./wiki/API.md)

# Build

```bash
vp install          # install packages
vp dev              # dev server with hot reloading, proxied to Foundry on :30000
vp run build        # clean build into dist/downtime-dnd5e
vp run build:watch  # rebuild on change
vp check            # format, lint and type check
vp test             # unit tests (the model is pure and runs without Foundry)
vp run check:svelte # type check the Svelte components
```

## [Changelog](./changelog.md)

## Issues

Any issues, bugs, or feature requests are always welcome to be reported directly to the [Issue Tracker](https://github.com/laquasicinque/foundryvtt-downtime-dnd5e/issues ), or using the [Bug Reporter Module](https://foundryvtt.com/packages/bug-reporter/).

## License

- [Crash's Tracking & Training (formerly known as Crash's Downtime Tracking)](https://github.com/crash1115/5e-training) with [Creative Commons Attribution 4.0 International License.](https://github.com/crash1115/5e-training/blob/master/LICENSE)

- [Ethck's 5e Downtime Tracking](https://github.com/Ethck/Ethck-s-Downtime-Tracking) with [MIT](https://github.com/Ethck/Ethck-s-Downtime-Tracking/blob/master/LICENSE)

This package is under an [MIT license](LICENSE) and the [Foundry Virtual Tabletop Limited License Agreement for module development](https://foundryvtt.com/article/license/).

## Attributions and Special Thanks

- Thanks to KLO#1490 for Korean translations
- Thanks to MS-PBS for Spanish translations
- Thanks Varriount for some CSS fixes
- Thanks to crash1115 for the module [Crash's Tracking & Training (formerly known as Crash's Downtime Tracking)](https://github.com/crash1115/5e-training)
- Thanks to Ethck for the module [Ethck's 5e Downtime Tracking](https://github.com/Ethck/Ethck-s-Downtime-Tracking)
- Thanks to [p4535992](https://github.com/p4535992) for maintaining the module [previous](https://github.com/p4535992/foundryvtt-downtime-dnd5e)

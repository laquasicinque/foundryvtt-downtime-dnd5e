# Contributing

## Setup

The project uses [Vite+](https://viteplus.dev/guide/) (`vp`) for installing, building, linting and testing.

```bash
vp install          # install packages
vp dev              # dev server with hot reloading, proxied to Foundry on :30000
vp run build        # clean build into dist/downtime-dnd5e
vp check            # format, lint and type check
vp test             # unit tests
vp run check:svelte # type check the Svelte components
```

Before opening a pull request, run `vp check`, `vp test` and `vp run check:svelte`.

## Typescript + Compatibility Layer

We're defining a subset of foundry and dnd5e types (just what's necessary). For the sake of backwards compatibility, we're namespacing foundry and dnd5e versions. Currently `Foundry.V14` and `Dnd5e.v6` (at time of writing this) but if we need to deal with minor versions, separate versions with `_` e.g:  `Dnd5e.v6_1`. New versions extend the types that have changed (e.g `interface Actor extends v6.Actor { … }`) and aliases the ones that haven't (e.g `type Item = v6.Item`). You can then change the latest version in `src/types/foundry/index.d.ts` and `src/types/dnd5e/index.d.ts` which should flag any type errors. Generally we should point to `latest` but if we're handling a specific version, you can use that version specifically

Globals are defined in `globals.d.ts`. This file, along with `src/foundry/*` and `src/dnd5e/*` are the only files that should use `Foundry.*` and `Dnd5e.*`. Any interaction with dnd5e/foundry should use the functions provided by that so that they can remain version agnostic.

For foundry and dnd5e types, version agnostic branded types are what should be used so that future support is contained within the above folders.

## Text and translations

Currently only `en.json` is complete and is treated as the source of truth for key names for typescript.

- Use `localize(key, vars)` from `src/foundry/i18n.ts`. Instead of using `game.i18n` . It uses this under the hood. Prefer using existing keys from Foundry/dnd5e
- For plurals: add `.one` / `.other` (and any other forms the language needs) under the key, and pass `count` in the vars. (You may have to add a blank key to en.json for types to work)
- Note: Foundry expands dotted keys into nested objects, and a clash stops the whole language file from loading. `src/tests/languages.test.ts` checks for this as I've hit this before.
- Keep console messages for module and macro authors english

## Code style

- Use `async`/`await` and `try`/`catch`, not `.then`, `.catch` or `.finally` chains.
- Use named exports, not default exports (Svelte components aside).
- Use `compareText` from `src/lib/text.ts` instead of `localeCompare`.
- `vp check --fix` handles formatting.

<script lang="ts">
    import { localize, localizeText } from "../../foundry/i18n";
    import type { I18nKey, LocalizedText } from "../../types/i18n";
    import { copyToClipboard, randomId } from "../../foundry/utils";
    import { pickImage as openImagePicker } from "../../foundry/applications";
    import { notifyInfo } from "../../foundry/notifications";
    import { getSetting } from "../../foundry/settings";
    import { untrack } from "svelte";
    import type { TrackedItem } from "../../domain/TrackedItem";
    import {
        createFromPreset,
        defaultMethod,
        syncCompletionMilestones,
        METHOD_KIND_LABELS,
    } from "../../model/authoring/editing";
    import {
        applyPreset,
        DEFAULT_ITEM_NAME,
        PRESET_CHOICES,
        type PresetChoice,
    } from "../../model/authoring/starters";
    import {
        actionProblems,
        milestoneProblems,
    } from "../../model/rules/milestones";
    import { requirementProblems } from "../../model/rules/requirements";
    import type {
        MethodData,
        MethodKind,
        Requirement,
        StoreRef,
        TrackedItemData,
    } from "../../types/data";
    import { WORLD_STORE } from "../../model/storage/stores";
    import {
        getCategoriesSync,
        getTrackedItemsSync,
        v3Api,
    } from "../../runtime/api";
    import RequirementsEditor from "./RequirementsEditor.svelte";
    import MilestonesEditor from "./MilestonesEditor.svelte";
    import MethodEditor from "./MethodEditor.svelte";
    import { parseFinite } from "../../lib/values";

    type Props = {
        /** The item being edited, or null to create a new one in `store`. */
        item: TrackedItem | null;
        store: StoreRef;
        /** New items: the category to put them in. */
        categoryId?: string | null;
        sheet: { close(): Promise<unknown> };
    };

    const {
        item,
        store: storeProp,
        categoryId = null,
        sheet,
    }: Props = $props();

    const creating = untrack(() => item === null);
    const store = untrack(() => item?.store ?? storeProp);
    // The editor works on a snapshot taken when it opens. New items start as a goal.
    const original = untrack(
        (): TrackedItemData =>
            item?.toJSON() ?? {
                ...createFromPreset(
                    "goal",
                    {
                        name: localize(DEFAULT_ITEM_NAME),
                        target: getSetting("totalToComplete"),
                        categoryId,
                    },
                    randomId,
                    localize,
                ),
                preset: null,
            },
    );
    let draft = $state<TrackedItemData>(structuredClone(original));
    /** Target the completion milestones were built for (moves with preset changes). */
    let baselineTarget = $state(original.progress.target);
    let saving = $state(false);
    let error = $state<string | null>(null);

    // ── Tabs (a guided sequence; any tab can be opened directly) ────────────

    const TABS = [
        {
            id: "presets",
            label: "downtime-dnd5e.ItemEditor.Presets",
            icon: "fa-wand-magic-sparkles",
        },
        {
            id: "basics",
            label: "downtime-dnd5e.ItemEditor.Tab.Basics",
            icon: "fa-id-card",
        },
        {
            id: "progress",
            label: "downtime-dnd5e.ItemEditor.Tab.Progress",
            icon: "fa-chart-simple",
        },
        {
            id: "methods",
            label: "downtime-dnd5e.ItemEditor.Tab.Methods",
            icon: "fa-dice-d20",
        },
        {
            id: "milestones",
            label: "downtime-dnd5e.ItemEditor.Tab.Milestones",
            icon: "fa-flag-checkered",
        },
        {
            id: "access",
            label: "downtime-dnd5e.ItemEditor.Tab.Access",
            icon: "fa-user-lock",
        },
    ] as const satisfies readonly {
        id: string;
        label: I18nKey;
        icon: string;
    }[];
    type TabId = (typeof TABS)[number]["id"];
    let tab = $state<TabId>("basics");
    const tabIndex = $derived(TABS.findIndex((t) => t.id === tab));
    const go = (step: -1 | 1) =>
        (tab =
            TABS[Math.max(0, Math.min(TABS.length - 1, tabIndex + step))]!.id);

    /** The preset last applied in this session, for the "applied" marker. */
    let applied = $state<string | null>(null);
    const choiceKey = (c: PresetChoice) => `${c.kind}:${c.id}`;

    function usePreset(choice: PresetChoice) {
        draft = applyPreset(
            $state.snapshot(draft) as TrackedItemData,
            choice,
            randomId,
            localize,
        );
        baselineTarget = draft.progress.target;
        applied = choiceKey(choice);
        tab = "basics";
    }

    // Opened from the store's sheet (or the world list), so the store is in memory.
    const categories = untrack(() => getCategoriesSync(store));
    /** Other items in the same store, for requirements that point at them. */
    const otherItems = untrack(() =>
        getTrackedItemsSync(store)
            .filter((other) => other.id !== original.id)
            .map((other) => other.toJSON()),
    );
    /** World items, which a character's item can also require progress on. */
    const worldItems = untrack(() =>
        store.kind === "ACTOR"
            ? getTrackedItemsSync(WORLD_STORE).map((other) => other.toJSON())
            : [],
    );

    const at = (where: string, problem: string) =>
        localize("downtime-dnd5e.ItemEditor.ProblemAt", { where, problem });

    /** Incomplete or always-failing configuration, by tab. */
    function blockingProblems(
        data: TrackedItemData,
    ): { tab: TabId; message: string }[] {
        const refs = {
            self: data,
            sameStore: [data, ...otherItems],
            worldStore: worldItems.length ? worldItems : null,
            actingActorStore: null,
        };
        const check = (
            tab: TabId,
            where: string,
            requirements: Requirement[],
        ) =>
            requirements.flatMap((requirement) =>
                requirementProblems(requirement, localize, refs)
                    .filter((p) => p.blocking)
                    .map((p) => ({ tab, message: at(where, p.message) })),
            );
        const milestoneContext = {
            store,
            progress: data.progress,
            items: otherItems,
            t: localize,
        };
        const milestoneIssues = data.milestones.flatMap((m) => {
            const where = localize("downtime-dnd5e.ItemEditor.MilestoneWhere", {
                milestone:
                    m.label ||
                    localize("downtime-dnd5e.Revert.MilestoneAt", { at: m.at }),
            });
            return [
                ...milestoneProblems(m, milestoneContext),
                ...m.actions.flatMap((a) =>
                    actionProblems(a, milestoneContext),
                ),
            ]
                .filter((p) => p.blocking)
                .map((p) => ({
                    tab: "milestones" as const,
                    message: at(where, p.message),
                }));
        });
        return [
            ...(data.name.trim()
                ? []
                : [
                      {
                          tab: "basics" as const,
                          message: localize(
                              "downtime-dnd5e.ItemEditor.NeedsName",
                          ),
                      },
                  ]),
            ...milestoneIssues,
            ...check(
                "access",
                localize("downtime-dnd5e.ItemEditor.ItemRequirements"),
                data.requirements,
            ),
            ...data.methods.flatMap((m) =>
                check(
                    "methods",
                    m.name || localize("downtime-dnd5e.ItemEditor.AMethod"),
                    m.requirements,
                ),
            ),
        ];
    }

    const problems = $derived(
        blockingProblems($state.snapshot(draft) as TrackedItemData),
    );
    const problemCount = (id: TabId) =>
        problems.filter((p) => p.tab === id).length;

    let newMethodKind = $state<MethodKind>("SKILL");

    function addMethod() {
        draft.methods.push(defaultMethod(newMethodKind, randomId, localize));
    }

    function updateMethod(index: number, method: MethodData) {
        draft.methods[index] = method;
    }

    function removeMethod(index: number) {
        draft.methods.splice(index, 1);
    }

    function moveMethod(index: number, direction: -1 | 1) {
        const target = index + direction;
        if (target < 0 || target >= draft.methods.length) return;
        const [method] = draft.methods.splice(index, 1);
        draft.methods.splice(target, 0, method!);
    }

    async function copyRaw(raw: unknown) {
        await copyToClipboard(JSON.stringify(raw, null, 2));
        notifyInfo(localize("downtime-dnd5e.Notify.Copied"));
    }

    function pickImage() {
        openImagePicker(draft.img, (path) => (draft.img = path));
    }

    async function save(event: SubmitEvent) {
        event.preventDefault();
        error = null;
        if (problems.length) {
            error = problems.map((p) => p.message).join(" — ");
            tab = problems[0]!.tab;
            return;
        }
        saving = true;
        try {
            const synced = syncCompletionMilestones(
                $state.snapshot(draft) as TrackedItemData,
                baselineTarget,
            );
            const {
                id: _id,
                schemaVersion: _v,
                history: _h,
                quarantine: _q,
                ...changes
            } = synced;
            if (item) await item.update(changes);
            else await v3Api.createItem(store, changes);
            await sheet.close();
        } catch (e) {
            // INVALID errors list the normaliser's issues.
            const details = (
                e as { details?: { message?: LocalizedText | string }[] }
            ).details;
            error = [
                e instanceof Error ? e.message : String(e),
                ...(Array.isArray(details)
                    ? details.map((d) => localizeText(d.message ?? null))
                    : []),
            ]
                .filter(Boolean)
                .join(" — ");
        } finally {
            saving = false;
        }
    }
</script>

<form class="item-editor" onsubmit={save}>
    <nav
        class="steps"
        aria-label={localize("downtime-dnd5e.ItemEditor.Sections")}
    >
        {#each TABS as t, index (t.id)}
            <button
                type="button"
                class="step"
                class:active={tab === t.id}
                class:optional={t.id === "presets"}
                aria-current={tab === t.id ? "step" : undefined}
                onclick={() => (tab = t.id)}
            >
                <span class="number"
                    >{#if t.id === "presets"}<i class="fas {t.icon}"
                        ></i>{:else}{index}{/if}</span
                >
                {localize(t.label)}
                {#if problemCount(t.id)}<span
                        class="problem-badge"
                        title={localize(
                            "downtime-dnd5e.ItemEditor.NeedsAttentionBeforeSaving",
                        )}>{problemCount(t.id)}</span
                    >{/if}
            </button>
        {/each}
    </nav>

    <div class="pages">
        <section hidden={tab !== "presets"}>
            <p class="intro">
                {localize(
                    creating
                        ? "downtime-dnd5e.ItemEditor.PresetsIntroCreate"
                        : "downtime-dnd5e.ItemEditor.PresetsIntroEdit",
                )}
            </p>
            <h4>{localize("downtime-dnd5e.ItemEditor.Shapes")}</h4>
            <div class="presets">
                {#each PRESET_CHOICES.filter((p) => p.choice.kind === "blank") as p (choiceKey(p.choice))}
                    <button
                        type="button"
                        class="preset"
                        class:applied={applied === choiceKey(p.choice)}
                        onclick={() => usePreset(p.choice)}
                    >
                        <strong>{localize(p.label)}</strong>
                        <span>{localize(p.hint)}</span>
                    </button>
                {/each}
            </div>
            <h4>{localize("downtime-dnd5e.ItemEditor.Starters")}</h4>
            <div class="presets">
                {#each PRESET_CHOICES.filter((p) => p.choice.kind === "starter") as p (choiceKey(p.choice))}
                    <button
                        type="button"
                        class="preset"
                        class:applied={applied === choiceKey(p.choice)}
                        onclick={() => usePreset(p.choice)}
                    >
                        <strong>{localize(p.label)}</strong>
                        <span>{localize(p.hint)}</span>
                    </button>
                {/each}
            </div>
        </section>

        <section hidden={tab !== "basics"}>
            <p class="intro">
                {localize("downtime-dnd5e.ItemEditor.BasicsIntro")}
                {#if creating}{localize("downtime-dnd5e.ItemEditor.HeadStart")}
                    <button
                        type="button"
                        class="link"
                        onclick={() => (tab = "presets")}
                        >{localize("downtime-dnd5e.ItemEditor.Presets")}</button
                    >{/if}
            </p>
            {#if applied}
                <p class="notice">
                    <i class="fas fa-wand-magic-sparkles"></i>
                    {localize(
                        creating
                            ? "downtime-dnd5e.ItemEditor.AppliedCreate"
                            : "downtime-dnd5e.ItemEditor.AppliedSave",
                    )}
                </p>
            {/if}
            <div class="row">
                <label
                    >{localize("DOCUMENT.FIELDS.name.label")}
                    <input type="text" bind:value={draft.name} /></label
                >
            </div>
            <div class="row">
                <label
                    >{localize("downtime-dnd5e.ItemEditor.Image")}
                    <input type="text" bind:value={draft.img} /></label
                >
                <button
                    type="button"
                    class="inline"
                    onclick={pickImage}
                    title={localize("downtime-dnd5e.ItemEditor.Browse")}
                    ><i class="fas fa-file-image"></i></button
                >
            </div>
            <div class="row">
                <label
                    >{localize("downtime-dnd5e.ItemEditor.Category")}
                    <select
                        value={draft.categoryId ?? ""}
                        onchange={(e) =>
                            (draft.categoryId = e.currentTarget.value || null)}
                    >
                        <option value=""
                            >{localize(
                                "downtime-dnd5e.ItemEditor.Uncategorised",
                            )}</option
                        >
                        {#each categories as category (category.id)}
                            <option value={category.id}>{category.name}</option>
                        {/each}
                    </select>
                </label>
            </div>
            <label
                >{localize("DOCUMENT.FIELDS.description.label")}
                <textarea rows="4" bind:value={draft.description}
                ></textarea></label
            >
            <div class="row">
                <label class="check"
                    ><input type="checkbox" bind:checked={draft.hidden} />
                    {localize(
                        "downtime-dnd5e.ItemEditor.HiddenFromPlayers",
                    )}</label
                >
            </div>
        </section>

        <section hidden={tab !== "progress"}>
            <p class="intro">
                {localize("downtime-dnd5e.ItemEditor.HowFarItHas")}
            </p>
            <div class="row three">
                <label
                    >{localize("downtime-dnd5e.ItemEditor.Target")}
                    <input
                        type="number"
                        value={draft.progress.target ?? ""}
                        oninput={(e) =>
                            (draft.progress.target = parseFinite(
                                e.currentTarget.value,
                            ))}
                    />
                </label>
                <label
                    >{localize("downtime-dnd5e.ItemEditor.Minimum")}
                    <input
                        type="number"
                        value={draft.progress.min ?? ""}
                        oninput={(e) =>
                            (draft.progress.min = parseFinite(
                                e.currentTarget.value,
                            ))}
                    />
                </label>
                <label
                    >{localize("downtime-dnd5e.ItemEditor.Maximum")}
                    <input
                        type="number"
                        value={draft.progress.max ?? ""}
                        oninput={(e) =>
                            (draft.progress.max = parseFinite(
                                e.currentTarget.value,
                            ))}
                    />
                </label>
            </div>
            <p class="hint">
                {localize(
                    "downtime-dnd5e.ItemEditor.MarkCompleteMilestonesThat",
                )}
            </p>
        </section>

        <section hidden={tab !== "methods"}>
            <p class="intro">
                {localize("downtime-dnd5e.ItemEditor.TheWaysToMake")}
            </p>
            {#each draft.methods as method, index (method.id)}
                <MethodEditor
                    {method}
                    onchange={(m) => updateMethod(index, m)}
                    onremove={() => removeMethod(index)}
                    onmove={(d) => moveMethod(index, d)}
                    first={index === 0}
                    last={index === draft.methods.length - 1}
                    items={otherItems}
                    {worldItems}
                    self={draft}
                />
            {:else}
                <p class="hint">
                    {localize("downtime-dnd5e.ItemEditor.NoMethodsYetAdd")}
                </p>
            {/each}
            <div class="row">
                <select bind:value={newMethodKind}>
                    {#each Object.entries(METHOD_KIND_LABELS) as [kind, label] (kind)}
                        <option value={kind}>{localize(label)}</option>
                    {/each}
                </select>
                <button type="button" class="inline" onclick={addMethod}
                    ><i class="fas fa-plus"></i>
                    {localize("downtime-dnd5e.ItemEditor.AddMethod")}</button
                >
            </div>
        </section>

        <section hidden={tab !== "milestones"}>
            <p class="intro">
                {localize("downtime-dnd5e.ItemEditor.WhatHappensAlongThe")}
            </p>
            <div class="row">
                <label
                    >{localize(
                        "downtime-dnd5e.ItemEditor.RewardsNeedGMApproval",
                    )}
                    <select bind:value={draft.approval}>
                        <option value="WORLD_DEFAULT"
                            >{localize(
                                "downtime-dnd5e.ItemEditor.WorldDefault",
                            )}</option
                        >
                        <option value="AUTO">{localize("COMMON.No")}</option>
                        <option value="GM"
                            >{localize(
                                "downtime-dnd5e.ItemEditor.YesWhenAPlayer",
                            )}</option
                        >
                    </select>
                </label>
            </div>
            <MilestonesEditor
                milestones={draft.milestones}
                onchange={(milestones) => (draft.milestones = milestones)}
                {store}
                methods={draft.methods}
                items={otherItems}
                target={draft.progress.target}
                progress={draft.progress}
            />
        </section>

        <section hidden={tab !== "access"}>
            <p class="intro">
                {localize("downtime-dnd5e.ItemEditor.WhoCanSeeAnd")}
            </p>
            <RequirementsEditor
                requirements={draft.requirements}
                onchange={(requirements) => (draft.requirements = requirements)}
                items={otherItems}
                {worldItems}
                self={draft}
                subject="item"
            />
        </section>
    </div>

    {#if original.quarantine.length}
        <fieldset class="quarantine">
            <legend
                ><i class="fas fa-triangle-exclamation"></i>
                {localize("downtime-dnd5e.ItemEditor.DataThatCouldnT")}</legend
            >
            <p class="hint">
                {localize("downtime-dnd5e.ItemEditor.ThesePartsWereSet")}
            </p>
            {#each original.quarantine as record, index (index)}
                <div class="record">
                    <code>{record.path}</code>: {record.reason}
                    <button
                        type="button"
                        class="inline"
                        onclick={() => copyRaw(record.raw)}
                        title={localize(
                            "downtime-dnd5e.ItemEditor.CopyTheRawData",
                        )}><i class="fas fa-copy"></i></button
                    >
                </div>
            {/each}
        </fieldset>
    {/if}

    {#if error}
        <p class="error">{error}</p>
    {/if}
    <footer>
        <button
            type="button"
            class="nav"
            disabled={tabIndex === 0}
            onclick={() => go(-1)}
            ><i class="fas fa-chevron-left"></i>
            {localize("downtime-dnd5e.ItemEditor.Back")}</button
        >
        {#if tabIndex < TABS.length - 1}
            <button type="button" class="nav" onclick={() => go(1)}
                >{localize("downtime-dnd5e.ItemEditor.Next")}
                <i class="fas fa-chevron-right"></i></button
            >
        {/if}
        <span class="spacer"></span>
        <button type="submit" class="save" disabled={saving}
            ><i class="fas {creating ? 'fa-plus' : 'fa-save'}"></i>
            {localize(
                creating
                    ? "downtime-dnd5e.ItemEditor.Create"
                    : "downtime-dnd5e.ItemEditor.Save",
            )}</button
        >
    </footer>
</form>

<style>
    .item-editor {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        height: 100%;
    }
    .steps {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        border-bottom: 1px solid var(--color-border-light-2, #bbb);
        padding-bottom: 0.35rem;
    }
    .step {
        width: auto;
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.8rem;
        line-height: 1.6;
        padding: 0 0.5rem;
        opacity: 0.75;
    }
    .step.active {
        opacity: 1;
        font-weight: bold;
        border-color: var(--color-border-highlight, #ff6400);
    }
    .step .number {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.2rem;
        height: 1.2rem;
        border-radius: 50%;
        font-size: 0.7rem;
        background: rgba(0, 0, 0, 0.2);
    }
    .step.active .number {
        background: var(--color-border-highlight, #ff6400);
        color: white;
    }
    .problem-badge {
        background: var(--color-level-error, #c00);
        color: white;
        border-radius: 0.6rem;
        padding: 0 0.35rem;
        font-size: 0.7rem;
        line-height: 1.2rem;
    }
    .pages {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
    }
    section {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }
    section[hidden] {
        display: none;
    }
    .intro {
        margin: 0 0 0.25rem;
        font-size: 0.85rem;
        opacity: 0.85;
    }
    .notice {
        margin: 0;
        font-size: 0.85rem;
        padding: 0.3rem 0.5rem;
        border-left: 3px solid var(--color-level-info, #3a6ea5);
        background: rgba(0, 0, 0, 0.1);
    }
    h4 {
        margin: 0.35rem 0 0;
        font-size: 0.9rem;
        border: none;
    }
    .presets {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
        gap: 0.35rem;
    }
    .preset {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        text-align: left;
        height: auto;
        line-height: 1.3;
        padding: 0.4rem 0.5rem;
        white-space: normal;
    }
    .preset span {
        font-size: 0.75rem;
        opacity: 0.8;
    }
    .preset.applied {
        border-color: var(--color-level-success, #3a3);
        box-shadow: 0 0 0 1px var(--color-level-success, #3a3);
    }
    button.link {
        all: unset;
        cursor: pointer;
        text-decoration: underline;
    }
    fieldset {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .row {
        display: flex;
        gap: 0.5rem;
        align-items: end;
    }
    .row > label {
        flex: 1;
    }
    .row.three > label {
        flex: 1 1 0;
    }
    label {
        display: flex;
        flex-direction: column;
        font-size: 0.85rem;
    }
    label.check {
        flex-direction: row;
        align-items: center;
        gap: 0.25rem;
    }
    button.inline {
        width: auto;
        flex: none;
    }
    .hint {
        font-size: 0.8rem;
        opacity: 0.7;
        margin: 0;
    }
    .quarantine .record {
        font-size: 0.8rem;
        display: flex;
        gap: 0.25rem;
        align-items: center;
    }
    .error {
        color: var(--color-level-error, #c00);
        margin: 0;
    }
    footer {
        display: flex;
        gap: 0.35rem;
        align-items: center;
        border-top: 1px solid var(--color-border-light-2, #bbb);
        padding-top: 0.35rem;
    }
    footer button {
        width: auto;
    }
    .spacer {
        flex: 1;
    }
</style>

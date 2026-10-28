<script lang="ts">
    import { localize } from "../../foundry/i18n";
    import type { I18nKey } from "../../types/i18n";
    /**
     * Requirements list editor, used for item-level and method
     * requirements. All requirements must be met (AND).
     */
    import { randomId } from "../../foundry/utils";
    import {
        describeRequirement,
        requirementProblems,
    } from "../../model/rules/requirements";
    import type { RefContext } from "../../model/rules/refs";
    import type {
        CompareOp,
        ItemMatch,
        Requirement,
        RequirementTest,
        TrackedItemData,
        WhenUnmet,
    } from "../../types/data";
    import {
        abilityChoices,
        abilityLabel,
        skillChoices,
        skillLabel,
        toolChoices,
        toolLabel,
    } from "../../dnd5e/config";
    import { itemMatchFields } from "../../foundry/documents";
    import UuidDrop from "./UuidDrop.svelte";
    import { parseFinite } from "../../lib/values";

    type Props = {
        requirements: Requirement[];
        onchange: (requirements: Requirement[]) => void;
        /** Other items in the same store that PROGRESS / MILESTONE requirements can point at. */
        items: readonly TrackedItemData[];
        /** World items, offered too when editing a character's item. */
        worldItems?: readonly TrackedItemData[];
        /** The item being edited (the draft), for "this item" references. */
        self: TrackedItemData;
        /** What "hide" hides, for the help text. */
        subject: "item" | "method";
    };

    const {
        requirements,
        onchange,
        items,
        worldItems = [],
        self,
        subject,
    }: Props = $props();

    const labels = {
        t: localize,
        skill: skillLabel,
        ability: abilityLabel,
        tool: toolLabel,
    };
    const refs = $derived<RefContext>({
        self,
        sameStore: [self, ...items],
        worldStore: worldItems.length ? worldItems : null,
        actingActorStore: null,
    });
    /** Everything a reference can be picked from, with world items marked. */
    const refOptions = $derived([
        ...items.map((i) => ({ id: i.id, label: i.name, item: i })),
        ...worldItems.map((i) => ({
            id: i.id,
            label: localize("downtime-dnd5e.RequirementsEditor.WorldItem", {
                item: i.name,
            }),
            item: i,
        })),
    ]);

    /** Fill an item match from a dropped Item: identifier, then source, then name. */
    async function matchFromUuid(uuid: string): Promise<ItemMatch | null> {
        return itemMatchFields(uuid);
    }

    const abilities = abilityChoices();
    const skills = skillChoices();
    const tools = toolChoices();

    const KINDS: { kind: RequirementTest["kind"]; label: I18nKey }[] = [
        {
            kind: "SKILL",
            label: "downtime-dnd5e.RequirementsEditor.Kind.SKILL",
        },
        {
            kind: "ABILITY",
            label: "downtime-dnd5e.RequirementsEditor.Kind.ABILITY",
        },
        {
            kind: "TOOL_PROFICIENCY",
            label: "downtime-dnd5e.RequirementsEditor.Kind.TOOL_PROFICIENCY",
        },
        { kind: "ITEM", label: "downtime-dnd5e.RequirementsEditor.Kind.ITEM" },
        {
            kind: "PROGRESS",
            label: "downtime-dnd5e.RequirementsEditor.Kind.PROGRESS",
        },
        {
            kind: "MILESTONE",
            label: "downtime-dnd5e.RequirementsEditor.Kind.MILESTONE",
        },
        {
            kind: "MACRO",
            label: "downtime-dnd5e.RequirementsEditor.Kind.MACRO",
        },
    ];

    const OPS: { op: CompareOp; label: string }[] = [
        { op: "gte", label: "≥" },
        { op: "gt", label: ">" },
        { op: "eq", label: "=" },
        { op: "lte", label: "≤" },
        { op: "lt", label: "<" },
    ];

    const snapshot = () => $state.snapshot(requirements) as Requirement[];

    function defaultTest(kind: RequirementTest["kind"]): RequirementTest {
        switch (kind) {
            case "SKILL":
                return { kind, skill: "ath" as never, min: "PROFICIENT" };
            case "ABILITY":
                return { kind, ability: "str" as never, min: { score: 13 } };
            case "TOOL_PROFICIENCY":
                return { kind, tool: tools[0]?.key ?? "smith" };
            case "ITEM":
                return {
                    kind,
                    match: { identifier: null, sourceUuid: null, name: "" },
                    quantity: 1,
                };
            case "PROGRESS":
                return {
                    kind,
                    ref: { kind: "SELF" },
                    op: "gte",
                    value: 1,
                };
            case "MILESTONE": {
                const target = refOptions.find((o) => o.item.milestones.length);
                return target
                    ? {
                          kind,
                          ref: { kind: "ITEM", id: target.id },
                          milestoneId: target.item.milestones[0]!.id,
                          reached: true,
                      }
                    : {
                          kind,
                          ref: { kind: "SELF" },
                          milestoneId: self.milestones[0]?.id ?? "",
                          reached: true,
                      };
            }
            case "MACRO":
                return { kind, macroUuid: "" };
        }
    }

    function add() {
        onchange([
            ...snapshot(),
            {
                id: randomId(),
                whenUnmet: "HIDE",
                hint: null,
                test: defaultTest("SKILL"),
            },
        ]);
    }

    function patch(index: number, fields: Partial<Requirement>) {
        onchange(
            snapshot().map((r, i) => (i === index ? { ...r, ...fields } : r)),
        );
    }

    function patchTest(index: number, fields: Record<string, unknown>) {
        const current = snapshot()[index]!;
        patch(index, {
            test: { ...current.test, ...fields } as RequirementTest,
        });
    }

    function remove(index: number) {
        onchange(snapshot().filter((_, i) => i !== index));
    }

    const num = (value: string, fallback = 0) => parseFinite(value) ?? fallback;

    const itemById = (id: string) => refOptions.find((o) => o.id === id)?.item;
</script>

<div class="requirements">
    {#each requirements as requirement, index (requirement.id)}
        {@const test = requirement.test}
        <div class="requirement">
            <div class="row">
                <select
                    value={test.kind}
                    onchange={(e) =>
                        patch(index, {
                            test: defaultTest(
                                e.currentTarget
                                    .value as RequirementTest["kind"],
                            ),
                        })}
                >
                    {#each KINDS as k (k.kind)}<option value={k.kind}
                            >{localize(k.label)}</option
                        >{/each}
                </select>

                {#if test.kind === "SKILL"}
                    <select
                        value={test.skill}
                        onchange={(e) =>
                            patchTest(index, { skill: e.currentTarget.value })}
                    >
                        {#each skills as s (s.key)}<option value={s.key}
                                >{s.label}</option
                            >{/each}
                    </select>
                    <select
                        value={typeof test.min === "string"
                            ? test.min
                            : "BONUS"}
                        onchange={(e) => {
                            const v = e.currentTarget.value;
                            patchTest(index, {
                                min: v === "BONUS" ? { bonus: 3 } : v,
                            });
                        }}
                    >
                        <option value="PROFICIENT"
                            >{localize(
                                "downtime-dnd5e.RequirementsEditor.Proficient",
                            )}</option
                        >
                        <option value="EXPERT"
                            >{localize(
                                "downtime-dnd5e.RequirementsEditor.Expertise",
                            )}</option
                        >
                        <option value="BONUS"
                            >{localize(
                                "downtime-dnd5e.RequirementsEditor.BonusAtLeast",
                            )}</option
                        >
                    </select>
                    {#if typeof test.min === "object"}
                        <input
                            type="number"
                            value={test.min.bonus}
                            oninput={(e) =>
                                patchTest(index, {
                                    min: { bonus: num(e.currentTarget.value) },
                                })}
                        />
                    {/if}
                {:else if test.kind === "ABILITY"}
                    <select
                        value={test.ability}
                        onchange={(e) =>
                            patchTest(index, {
                                ability: e.currentTarget.value,
                            })}
                    >
                        {#each abilities as a (a.key)}<option value={a.key}
                                >{a.label}</option
                            >{/each}
                    </select>
                    <select
                        value={"score" in test.min ? "score" : "mod"}
                        onchange={(e) =>
                            patchTest(index, {
                                min:
                                    e.currentTarget.value === "score"
                                        ? { score: 13 }
                                        : { mod: 1 },
                            })}
                    >
                        <option value="score"
                            >{localize(
                                "downtime-dnd5e.RequirementsEditor.ScoreAtLeast",
                            )}</option
                        >
                        <option value="mod"
                            >{localize(
                                "downtime-dnd5e.RequirementsEditor.ModifierAtLeast",
                            )}</option
                        >
                    </select>
                    <input
                        type="number"
                        value={"score" in test.min
                            ? test.min.score
                            : test.min.mod}
                        oninput={(e) =>
                            patchTest(index, {
                                min:
                                    "score" in test.min
                                        ? { score: num(e.currentTarget.value) }
                                        : { mod: num(e.currentTarget.value) },
                            })}
                    />
                {:else if test.kind === "TOOL_PROFICIENCY"}
                    <select
                        value={test.tool}
                        onchange={(e) =>
                            patchTest(index, { tool: e.currentTarget.value })}
                    >
                        {#each tools as t (t.key)}<option value={t.key}
                                >{t.label}</option
                            >{/each}
                    </select>
                {:else if test.kind === "ITEM"}
                    <input
                        type="text"
                        placeholder={localize(
                            "downtime-dnd5e.RequirementsEditor.ItemNameOrIdentifier",
                        )}
                        value={test.match.identifier ?? test.match.name ?? ""}
                        oninput={(e) => {
                            const value = e.currentTarget.value;
                            // An identifier looks like "potion-of-healing"; anything else is a name.
                            const isIdentifier =
                                /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
                            patchTest(index, {
                                match: {
                                    identifier: isIdentifier ? value : null,
                                    sourceUuid: null,
                                    name: isIdentifier ? null : value,
                                },
                            });
                        }}
                    />
                    <label class="inline"
                        >× <input
                            type="number"
                            min="1"
                            value={test.quantity}
                            oninput={(e) =>
                                patchTest(index, {
                                    quantity: Math.max(
                                        1,
                                        num(e.currentTarget.value, 1),
                                    ),
                                })}
                        /></label
                    >
                {:else if test.kind === "PROGRESS"}
                    <select
                        value={test.ref.kind === "SELF"
                            ? "__self__"
                            : test.ref.id}
                        onchange={(e) =>
                            patchTest(index, {
                                ref:
                                    e.currentTarget.value === "__self__"
                                        ? { kind: "SELF" }
                                        : {
                                              kind: "ITEM",
                                              id: e.currentTarget.value,
                                          },
                            })}
                    >
                        <option value="__self__"
                            >{localize(
                                "downtime-dnd5e.RequirementsEditor.ThisItem",
                            )}</option
                        >
                        {#each refOptions as o (o.id)}<option value={o.id}
                                >{o.label}</option
                            >{/each}
                    </select>
                    <select
                        value={test.op}
                        onchange={(e) =>
                            patchTest(index, { op: e.currentTarget.value })}
                    >
                        {#each OPS as o (o.op)}<option value={o.op}
                                >{o.label}</option
                            >{/each}
                    </select>
                    <input
                        type="number"
                        value={test.value}
                        oninput={(e) =>
                            patchTest(index, {
                                value: num(e.currentTarget.value),
                            })}
                    />
                {:else if test.kind === "MILESTONE"}
                    {@const target =
                        test.ref.kind === "ITEM" ? itemById(test.ref.id) : self}
                    <select
                        value={test.ref.kind === "ITEM"
                            ? test.ref.id
                            : "__self__"}
                        onchange={(e) => {
                            const value = e.currentTarget.value;
                            const next =
                                value === "__self__" ? self : itemById(value);
                            patchTest(index, {
                                ref:
                                    value === "__self__"
                                        ? { kind: "SELF" }
                                        : { kind: "ITEM", id: value },
                                milestoneId: next?.milestones[0]?.id ?? "",
                            });
                        }}
                    >
                        <option value="__self__"
                            >{localize(
                                "downtime-dnd5e.RequirementsEditor.ThisItem",
                            )}</option
                        >
                        {#each refOptions as o (o.id)}<option value={o.id}
                                >{o.label}</option
                            >{/each}
                    </select>
                    <select
                        value={test.milestoneId}
                        onchange={(e) =>
                            patchTest(index, {
                                milestoneId: e.currentTarget.value,
                            })}
                    >
                        {#each target?.milestones ?? [] as m (m.id)}<option
                                value={m.id}
                                >{m.label ||
                                    localize(
                                        "downtime-dnd5e.Revert.MilestoneAt",
                                        {
                                            at: m.at,
                                        },
                                    )}</option
                            >{/each}
                    </select>
                    <select
                        value={String(test.reached)}
                        onchange={(e) =>
                            patchTest(index, {
                                reached: e.currentTarget.value === "true",
                            })}
                    >
                        <option value="true"
                            >{localize(
                                "downtime-dnd5e.RequirementsEditor.Reached",
                            )}</option
                        >
                        <option value="false"
                            >{localize(
                                "downtime-dnd5e.RequirementsEditor.NotReached",
                            )}</option
                        >
                    </select>
                {/if}

                <button
                    type="button"
                    class="icon"
                    onclick={() => remove(index)}
                    title={localize(
                        "downtime-dnd5e.RequirementsEditor.RemoveRequirement",
                    )}><i class="fas fa-trash"></i></button
                >
            </div>
            {#if test.kind === "ITEM"}
                <div class="row">
                    <UuidDrop
                        value={test.match.sourceUuid ?? ""}
                        accept={["Item"]}
                        placeholder={localize(
                            "downtime-dnd5e.RequirementsEditor.OrDropAnItem",
                        )}
                        onchange={async (uuid) => {
                            const match = uuid
                                ? await matchFromUuid(uuid)
                                : null;
                            if (match) patchTest(index, { match });
                        }}
                    />
                </div>
                <p class="hint">
                    {test.match.identifier
                        ? localize(
                              "downtime-dnd5e.RequirementsEditor.MatchesIdentifier",
                              {
                                  identifier: test.match.identifier,
                              },
                          )
                        : test.match.sourceUuid
                          ? localize(
                                "downtime-dnd5e.RequirementsEditor.MatchesSource",
                            )
                          : localize(
                                "downtime-dnd5e.RequirementsEditor.MatchesName",
                                {
                                    name: test.match.name ?? "",
                                },
                            )}
                </p>
            {:else if test.kind === "MACRO"}
                <div class="row">
                    <UuidDrop
                        value={test.macroUuid}
                        accept={["Macro"]}
                        onchange={(macroUuid) =>
                            patchTest(index, { macroUuid })}
                    />
                </div>
                <p class="hint">
                    {localize(
                        "downtime-dnd5e.RequirementsEditor.RunsOnThePlayer",
                    )}
                </p>
            {/if}
            <div class="row">
                <label class="inline"
                    >{localize("downtime-dnd5e.RequirementsEditor.IfNotMet")}
                    <select
                        value={requirement.whenUnmet}
                        onchange={(e) =>
                            patch(index, {
                                whenUnmet: e.currentTarget.value as WhenUnmet,
                            })}
                    >
                        <option value="HIDE"
                            >{localize(
                                subject === "item"
                                    ? "downtime-dnd5e.RequirementsEditor.HideItem"
                                    : "downtime-dnd5e.RequirementsEditor.HideMethod",
                            )}</option
                        >
                        <option value="DISABLE"
                            >{localize(
                                "downtime-dnd5e.RequirementsEditor.DisableIt",
                            )}</option
                        >
                        <option value="DISABLE_WITH_HINT"
                            >{localize(
                                "downtime-dnd5e.RequirementsEditor.DisableItWithA",
                            )}</option
                        >
                    </select>
                </label>
                {#if requirement.whenUnmet === "DISABLE_WITH_HINT"}
                    <input
                        type="text"
                        placeholder={describeRequirement(
                            requirement,
                            labels,
                            refs,
                        )}
                        title={localize(
                            "downtime-dnd5e.RequirementsEditor.HintShownToPlayers",
                        )}
                        value={requirement.hint ?? ""}
                        oninput={(e) =>
                            patch(index, {
                                hint: e.currentTarget.value || null,
                            })}
                    />
                {/if}
            </div>
            <p class="describe">
                {describeRequirement(requirement, labels, refs)}
            </p>
            {#each requirementProblems(requirement, localize, refs) as problem (problem.message)}
                <p class="problem" class:blocking={problem.blocking}>
                    <i class="fas fa-triangle-exclamation"></i>
                    {problem.message}
                </p>
            {/each}
        </div>
    {:else}
        <p class="hint">
            {localize(
                subject === "item"
                    ? "downtime-dnd5e.RequirementsEditor.NoneItem"
                    : "downtime-dnd5e.RequirementsEditor.NoneMethod",
            )}
        </p>
    {/each}
    <button type="button" class="add" onclick={add}
        ><i class="fas fa-plus"></i>
        {localize("downtime-dnd5e.RequirementsEditor.AddRequirement")}</button
    >
</div>

<style>
    .requirements {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .requirement {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        border-left: 3px solid var(--color-border-light-2, #bbb);
        padding: 0.2rem 0.4rem;
    }
    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        align-items: center;
    }
    .row select,
    .row input {
        width: auto;
        flex: 1 1 6rem;
    }
    .row input[type="number"] {
        flex: 0 0 4.5rem;
    }
    label.inline {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.85rem;
    }
    button.icon {
        width: 1.75rem;
        flex: none;
    }
    button.add {
        width: auto;
        align-self: flex-start;
    }
    .hint {
        font-size: 0.8rem;
        opacity: 0.7;
        margin: 0;
    }
    .describe {
        font-size: 0.8rem;
        font-style: italic;
        opacity: 0.8;
        margin: 0;
    }
    .problem {
        font-size: 0.8rem;
        margin: 0;
        color: var(--color-level-warning, #c80);
    }
    .problem.blocking {
        color: var(--color-level-error, #c00);
    }
</style>

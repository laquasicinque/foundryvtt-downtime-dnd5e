/**
 * Sample downtimes: one baseline item per feature the model supports, so UI
 * and behaviour changes have something realistic to be checked against.
 * Each sample is marked with `preset: "sample:<key>"` so seeding is
 * idempotent.
 */
import { defaultResultTable, otherwiseBand } from "./editing";

import type {
    CategoryData,
    MethodData,
    MilestoneAction,
    MilestoneData,
    Recipient,
    ResultBand,
    TrackedItemData,
    IdGenerator,
} from "../../types/data";
import type { Translate } from "../../types/i18n";
import { SCHEMA_VERSION } from "../storage/schema";

export interface SampleOptions {
    newId: IdGenerator;
    t: Translate;
    /** Item to grant from milestones (e.g. a compendium Potion of Healing). null → announce instead. */
    grantItemUuid: string | null;
    /** Name of a macro returning a number, for the macro sample. null → skip it. */
    macroName: string | null;
    /** Item granted per batch by the repeating samples (e.g. compendium Arrows). null → announce instead. */
    batchItemUuid?: string | null;
    /** Active Effect applied by the effect sample. null → skip it. */
    effectUuid?: string | null;
    /** Macro run by the macro-action sample, and the macro that undoes it. null → skip it. */
    actionMacroUuid?: string | null;
    undoMacroUuid?: string | null;
}

export interface SampleSet {
    category: CategoryData;
    actor: TrackedItemData[];
    world: TrackedItemData[];
}

export const SAMPLE_PREFIX = "sample:";
export const isSample = (item: { preset: string | null }) =>
    item.preset?.startsWith(SAMPLE_PREFIX) ?? false;

export function buildSamples(options: SampleOptions): SampleSet {
    const {
        newId,
        t,
        grantItemUuid,
        macroName,
        batchItemUuid = null,
        effectUuid = null,
        actionMacroUuid = null,
        undoMacroUuid = null,
    } = options;
    const category: CategoryData = {
        id: newId(),
        name: t("downtime-dnd5e.Sample.Category.Name"),
        description: t("downtime-dnd5e.Sample.Category.Description"),
    };

    const item = (
        key: string,
        fields: Partial<TrackedItemData> & { name: string },
    ): TrackedItemData => ({
        schemaVersion: SCHEMA_VERSION,
        id: newId(),
        img: "icons/svg/book.svg",
        description: "",
        categoryId: category.id,
        hidden: false,
        preset: SAMPLE_PREFIX + key,
        progress: { target: 10, min: 0, max: 10 },
        requirements: [],
        approval: "WORLD_DEFAULT",
        methods: [],
        milestones: [],
        history: [],
        quarantine: [],
        ...fields,
    });

    const base = (name: string, description = "") => ({
        id: newId(),
        name,
        description,
        img: null,
        hidden: false,
        requirements: [],
        usage: null,
    });

    const band = (
        label: string,
        value: number,
        when: ResultBand["when"],
        countsAs: ResultBand["countsAs"] = "SUCCESS",
    ): ResultBand => ({
        id: newId(),
        label,
        when,
        effect: { delta: { kind: "STATIC", value } },
        countsAs,
    });

    const fixed = (
        name: string,
        value: number,
        countsAs: "SUCCESS" | "FAILURE" = "SUCCESS",
        description = "",
    ): MethodData => ({
        ...base(name, description),
        kind: "FIXED",
        effect: { delta: { kind: "STATIC", value } },
        countsAs,
    });

    const milestone = (
        label: string,
        at: number,
        actions: MilestoneAction[],
        extra: Partial<MilestoneData> = {},
    ): MilestoneData => ({
        id: newId(),
        label,
        at,
        match: "CROSS",
        maxTimes: 1,
        revertWithCause: true,
        actions,
        ...extra,
    });

    const complete = (): MilestoneAction => ({ id: newId(), kind: "COMPLETE" });
    const lock = (): MilestoneAction => ({ id: newId(), kind: "LOCK" });
    const announce = (message: string | null = null): MilestoneAction => ({
        id: newId(),
        kind: "ANNOUNCE",
        message,
        audience: "WORLD_DEFAULT",
    });
    const reward = (recipient: Recipient, message: string): MilestoneAction =>
        grantItemUuid
            ? {
                  id: newId(),
                  kind: "GRANT_ITEM",
                  sourceUuid: grantItemUuid,
                  quantity: 1,
                  recipient,
              }
            : announce(message);

    // ── Actor store ─────────────────────────────────────────────────────────

    const research = item("research", {
        name: t("downtime-dnd5e.Sample.Research.Name"),
        description: t("downtime-dnd5e.Sample.Research.Description"),
        progress: { target: 20, min: 0, max: 20 },
        methods: [
            {
                ...base(t("downtime-dnd5e.Sample.Research.SearchTheStacks")),
                kind: "SKILL",
                skill: "inv" as never,
                dc: 12,
                results: {
                    bands: [
                        band(t("downtime-dnd5e.Sample.Research.Critical"), 3, [
                            { on: "NATURAL", op: "eq", value: 20 },
                        ]),
                        band(
                            t("downtime-dnd5e.Sample.Research.Botch"),
                            -1,
                            [{ on: "NATURAL", op: "eq", value: 1 }],
                            "FAILURE",
                        ),
                        band(t("downtime-dnd5e.Sample.Research.GreatFind"), 2, [
                            { on: "MARGIN", op: "gte", value: 5 },
                        ]),
                        band("", 1, [{ on: "MARGIN", op: "gte", value: 0 }]),
                        otherwiseBand(newId),
                    ],
                },
            },
        ],
        milestones: [
            milestone(t("downtime-dnd5e.Sample.Research.ArchiveMastered"), 20, [
                complete(),
                announce(),
            ]),
        ],
    });

    const reputation = item("reputation", {
        name: t("downtime-dnd5e.Sample.Reputation.Name"),
        description: t("downtime-dnd5e.Sample.Reputation.Description"),
        progress: { target: 10, min: -10, max: 10 },
        methods: [
            fixed(t("downtime-dnd5e.Sample.Reputation.DoThemAFavour"), 1),
            fixed(
                t("downtime-dnd5e.Sample.Reputation.SnubThem"),
                -1,
                "FAILURE",
            ),
            {
                ...base(t("downtime-dnd5e.Sample.Reputation.CharmTheirAgent")),
                kind: "SKILL",
                skill: "per" as never,
                dc: 15,
                results: {
                    bands: [
                        band(
                            t("downtime-dnd5e.Sample.Reputation.Impressed"),
                            2,
                            [{ on: "MARGIN", op: "gte", value: 0 }],
                        ),
                        band(
                            t("downtime-dnd5e.Sample.Reputation.Offended"),
                            -1,
                            [{ on: "MARGIN", op: "lte", value: -5 }],
                            "FAILURE",
                        ),
                        otherwiseBand(newId),
                    ],
                },
            },
        ],
        milestones: [
            milestone(t("downtime-dnd5e.Sample.Reputation.Trusted"), 5, [
                reward(
                    { type: "TRIGGERING_ACTOR" },
                    t("downtime-dnd5e.Sample.Reputation.TheHarpersSendA"),
                ),
            ]),
            milestone(t("downtime-dnd5e.Sample.Reputation.Ally"), 10, [
                complete(),
                announce(),
            ]),
            milestone(
                t("downtime-dnd5e.Sample.Reputation.EnemyOfTheHarpers"),
                -10,
                [
                    announce(
                        t(
                            "downtime-dnd5e.Sample.Reputation.TheHarpersNowConsider",
                        ),
                    ),
                ],
                {
                    match: "EXACT",
                    maxTimes: null,
                },
            ),
        ],
    });

    const items: TrackedItemData[] = [
        item("smith", {
            name: t("downtime-dnd5e.Sample.Smith.Name"),
            description: t("downtime-dnd5e.Sample.Smith.Description"),
            methods: [
                {
                    ...base(t("downtime-dnd5e.Sample.Smith.WorkTheForge")),
                    kind: "TOOL",
                    tool: "smith",
                    fallback: { kind: "ABILITY", ability: "str" as never },
                    dc: 12,
                    results: defaultResultTable(true, newId),
                },
            ],
            milestones: [milestone("", 10, [complete(), announce()])],
        }),
        research,
        reputation,
        item("study", {
            name: t("downtime-dnd5e.Sample.Study.Name"),
            description: t("downtime-dnd5e.Sample.Study.Description"),
            methods: [
                {
                    ...fixed(t("downtime-dnd5e.Sample.Study.TakeALesson"), 2),
                    usage: {
                        count: { kind: "ATTEMPTS" },
                        per: "ACTOR",
                        tiers: [
                            {
                                from: 2,
                                kind: "EFFECT",
                                effect: { delta: { kind: "STATIC", value: 1 } },
                            },
                            {
                                from: 4,
                                kind: "DISABLE",
                                hint: t(
                                    "downtime-dnd5e.Sample.Study.TheMasterHasNothing",
                                ),
                            },
                        ],
                    },
                },
            ],
            milestones: [milestone("", 10, [complete()])],
        }),
        item("potion", {
            name: t("downtime-dnd5e.Sample.Potion.Name"),
            description: t("downtime-dnd5e.Sample.Potion.Description"),
            progress: { target: 5, min: 0, max: 5 },
            methods: [
                {
                    ...base(t("downtime-dnd5e.Sample.Potion.Brew")),
                    kind: "TOOL",
                    tool: "alchemist",
                    fallback: null,
                    dc: 13,
                    results: defaultResultTable(true, newId),
                    requirements: [
                        {
                            id: newId(),
                            whenUnmet: "DISABLE_WITH_HINT",
                            hint: t(
                                "downtime-dnd5e.Sample.Potion.NeedsProficiencyWithAlchemist",
                            ),
                            test: {
                                kind: "TOOL_PROFICIENCY",
                                tool: "alchemist",
                            },
                        },
                    ],
                },
                {
                    ...base(t("downtime-dnd5e.Sample.Potion.UseTheArchiveS")),
                    kind: "SKILL",
                    skill: "arc" as never,
                    dc: 10,
                    results: defaultResultTable(true, newId),
                    requirements: [
                        {
                            id: newId(),
                            whenUnmet: "DISABLE_WITH_HINT",
                            hint: t(
                                "downtime-dnd5e.Sample.Potion.FinishResearchingTheArchive",
                            ),
                            test: {
                                kind: "MILESTONE",
                                ref: { kind: "ITEM", id: research.id },
                                milestoneId: research.milestones[0]!.id,
                                reached: true,
                            },
                        },
                    ],
                },
            ],
            milestones: [
                milestone(t("downtime-dnd5e.Sample.Potion.PotionBrewed"), 5, [
                    complete(),
                    lock(),
                    announce(),
                ]),
            ],
        }),
        item("carousing", {
            name: t("downtime-dnd5e.Sample.Carousing.Name"),
            description: t("downtime-dnd5e.Sample.Carousing.Description"),
            progress: { target: null, min: 0, max: null },
            methods: [
                fixed(t("downtime-dnd5e.Sample.Carousing.ANightOut"), 1),
                {
                    ...base(t("downtime-dnd5e.Sample.Carousing.LogNights")),
                    kind: "MANUAL",
                    gmOnly: false,
                },
            ],
        }),
        item("contract", {
            name: t("downtime-dnd5e.Sample.Contract.Name"),
            description: t("downtime-dnd5e.Sample.Contract.Description"),
            progress: { target: 3, min: 0, max: 3 },
            methods: [
                fixed(t("downtime-dnd5e.Sample.Contract.CompleteAJob"), 1),
            ],
            milestones: [
                milestone(
                    t("downtime-dnd5e.Sample.Contract.ContractFulfilled"),
                    3,
                    [
                        complete(),
                        {
                            id: newId(),
                            kind: "ADJUST_PROGRESS",
                            ref: { kind: "ITEM", id: reputation.id },
                            delta: 2,
                        },
                        lock(),
                    ],
                ),
            ],
        }),
        item("overflow", {
            name: t("downtime-dnd5e.Sample.Overflow.Name"),
            description: t("downtime-dnd5e.Sample.Overflow.Description"),
            progress: { target: 5, min: 0, max: null },
            methods: [fixed(t("downtime-dnd5e.Sample.Overflow.Practise"), 1)],
            milestones: [
                milestone(t("downtime-dnd5e.Sample.Overflow.Trained"), 5, [
                    complete(),
                    announce(),
                ]),
                milestone(t("downtime-dnd5e.Sample.Overflow.Mastery"), 10, [
                    announce(
                        t("downtime-dnd5e.Sample.Overflow.MasteryAchieved"),
                    ),
                ]),
            ],
        }),
        item("secret", {
            name: t("downtime-dnd5e.Sample.Secret.Name"),
            description: t("downtime-dnd5e.Sample.Secret.Description"),
            hidden: true,
            progress: { target: 6, min: 0, max: 6 },
            methods: [
                fixed(t("downtime-dnd5e.Sample.Secret.AdvanceTheClock"), 1),
            ],
        }),
    ];

    if (macroName) {
        items.push(
            item("macro", {
                name: t("downtime-dnd5e.Sample.Macro.Name"),
                description: `<p>Progress comes from the macro "${macroName}", which returns a number.</p>`,
                methods: [
                    {
                        ...base(t("downtime-dnd5e.Sample.Macro.RunTheMacro")),
                        kind: "MACRO",
                        macroUuid: "",
                        macroName,
                        results: null,
                    },
                ],
                milestones: [milestone("", 10, [complete()])],
            }),
        );
    }

    items.push(
        item("apprentice", {
            name: t("downtime-dnd5e.Sample.Apprentice.Name"),
            description: t("downtime-dnd5e.Sample.Apprentice.Description"),
            progress: { target: 3, min: 0, max: 3 },
            methods: [
                fixed(t("downtime-dnd5e.Sample.Apprentice.AssistTheMaster"), 1),
            ],
            milestones: [
                milestone(
                    t(
                        "downtime-dnd5e.Sample.Apprentice.ApprenticeshipFinished",
                    ),
                    3,
                    [
                        complete(),
                        {
                            id: newId(),
                            kind: "ADD_TRACKED_ITEM",
                            store: "SAME",
                            recipient: null,
                            template: {
                                name: t(
                                    "downtime-dnd5e.Sample.Apprentice.JourneymanWork",
                                ),
                                img: "icons/svg/book.svg",
                                description: t(
                                    "downtime-dnd5e.Sample.Apprentice.Description2",
                                ),
                                categoryId: category.id,
                                hidden: false,
                                preset: null,
                                progress: { target: 5, min: 0, max: 5 },
                                requirements: [],
                                approval: "WORLD_DEFAULT",
                                methods: [
                                    fixed(
                                        t(
                                            "downtime-dnd5e.Sample.Apprentice.TakeACommission",
                                        ),
                                        1,
                                    ),
                                ],
                                milestones: [milestone("", 5, [complete()])],
                            },
                        },
                        announce(
                            t(
                                "downtime-dnd5e.Sample.Apprentice.YourApprenticeshipIsComplete",
                            ),
                        ),
                    ],
                ),
            ],
        }),
    );

    if (effectUuid) {
        items.push(
            item("effect", {
                name: t("downtime-dnd5e.Sample.Effect.Name"),
                description: t("downtime-dnd5e.Sample.Effect.Description"),
                progress: { target: 3, min: 0, max: 3 },
                methods: [fixed(t("downtime-dnd5e.Sample.Effect.Train"), 1)],
                milestones: [
                    milestone(
                        t("downtime-dnd5e.Sample.Effect.RegimenComplete"),
                        3,
                        [
                            complete(),
                            {
                                id: newId(),
                                kind: "APPLY_EFFECT",
                                sourceUuid: effectUuid,
                                recipient: { type: "OWNING_ACTOR" },
                            },
                        ],
                    ),
                ],
            }),
        );
    }

    if (actionMacroUuid) {
        items.push(
            item("macro-action", {
                name: t("downtime-dnd5e.Sample.MacroAction.Name"),
                description: undoMacroUuid
                    ? t("downtime-dnd5e.Sample.MacroAction.Description")
                    : t("downtime-dnd5e.Sample.MacroAction.Description2"),
                progress: { target: 3, min: 0, max: 3 },
                methods: [
                    fixed(
                        t("downtime-dnd5e.Sample.MacroAction.PlanTheParty"),
                        1,
                    ),
                    fixed(
                        t("downtime-dnd5e.Sample.MacroAction.CancelPlans"),
                        -1,
                        "FAILURE",
                    ),
                ],
                milestones: [
                    milestone(
                        t("downtime-dnd5e.Sample.MacroAction.Party"),
                        3,
                        [
                            {
                                id: newId(),
                                kind: "MACRO",
                                macroUuid: actionMacroUuid,
                                undoMacroUuid,
                            },
                        ],
                        { maxTimes: null },
                    ),
                ],
            }),
        );
    }

    const batchReward = (message: string): MilestoneAction =>
        batchItemUuid
            ? {
                  id: newId(),
                  kind: "GRANT_ITEM",
                  sourceUuid: batchItemUuid,
                  quantity: 20,
                  recipient: { type: "TRIGGERING_ACTOR" },
              }
            : announce(message);
    const hoursOfWork = (): MethodData[] => [
        fixed(t("downtime-dnd5e.Sample.MacroAction.WorkAnHour"), 1),
        {
            ...base(
                t("downtime-dnd5e.Sample.MacroAction.LogHours"),
                t("downtime-dnd5e.Sample.MacroAction.EnterHowManyHours"),
            ),
            kind: "MANUAL",
            gmOnly: false,
        },
    ];
    const everyBatch = (
        label: string,
        size: number,
        message: string,
    ): MilestoneData =>
        milestone(label, size, [batchReward(message)], {
            match: "EVERY",
            maxTimes: null,
        });

    items.push(
        item("fletch", {
            name: t("downtime-dnd5e.Sample.Fletch.Name"),
            description: t("downtime-dnd5e.Sample.Fletch.Description"),
            progress: { target: null, min: 0, max: null },
            methods: hoursOfWork(),
            milestones: [
                everyBatch(
                    t("downtime-dnd5e.Sample.Fletch.BatchOfArrows"),
                    8,
                    t("downtime-dnd5e.Sample.Fletch.ABatchOfArrows"),
                ),
            ],
        }),
    );

    // ── World store ─────────────────────────────────────────────────────────

    const world: TrackedItemData[] = [
        item("bridge", {
            name: t("downtime-dnd5e.Sample.Bridge.Name"),
            description: t("downtime-dnd5e.Sample.Bridge.Description"),
            progress: { target: 20, min: 0, max: 20 },
            methods: [
                {
                    ...base(t("downtime-dnd5e.Sample.Bridge.HaulTimber")),
                    kind: "SKILL",
                    skill: "ath" as never,
                    dc: 10,
                    results: defaultResultTable(true, newId),
                },
                {
                    ...base(t("downtime-dnd5e.Sample.Bridge.Carpentry")),
                    kind: "TOOL",
                    tool: "carpenter",
                    fallback: { kind: "SKILL", skill: "ath" as never },
                    dc: 12,
                    results: {
                        bands: [
                            band("", 2, [
                                { on: "MARGIN", op: "gte", value: 0 },
                            ]),
                            otherwiseBand(newId),
                        ],
                    },
                },
            ],
            milestones: [
                milestone(t("downtime-dnd5e.Sample.Bridge.BridgeRebuilt"), 20, [
                    complete(),
                    reward(
                        {
                            type: "CONTRIBUTORS",
                            filter: {
                                window: "ALL_TIME",
                                minNet: null,
                                minAttempts: 1,
                                methodIds: [],
                            },
                            selection: "GM_PICKS",
                        },
                        t("downtime-dnd5e.Sample.Bridge.TheTownThanksEveryone"),
                    ),
                    announce(),
                ]),
            ],
        }),
        item("festival", {
            name: t("downtime-dnd5e.Sample.Festival.Name"),
            description: t("downtime-dnd5e.Sample.Festival.Description"),
            approval: "GM",
            progress: { target: 3, min: 0, max: 3 },
            methods: [fixed(t("downtime-dnd5e.Sample.Festival.HelpSetUp"), 1)],
            milestones: [
                milestone(
                    t("downtime-dnd5e.Sample.Festival.FestivalReady"),
                    3,
                    [
                        complete(),
                        reward(
                            { type: "TRIGGERING_ACTOR" },
                            t(
                                "downtime-dnd5e.Sample.Festival.TheMayorRewardsYour",
                            ),
                        ),
                    ],
                ),
            ],
        }),
        item("strength", {
            name: t("downtime-dnd5e.Sample.Strength.Name"),
            description: t("downtime-dnd5e.Sample.Strength.Description"),
            progress: { target: 100, min: 0, max: 100 },
            methods: [
                {
                    ...base(
                        t("downtime-dnd5e.Sample.Strength.LiftSomethingHeavy"),
                    ),
                    kind: "ABILITY",
                    ability: "str" as never,
                    dc: null,
                    results: defaultResultTable(false, newId),
                },
            ],
            milestones: [milestone("", 100, [complete(), announce()])],
        }),
    ];

    world.push(
        item("guild-fletching", {
            name: t("downtime-dnd5e.Sample.GuildFletching.Name"),
            description: t("downtime-dnd5e.Sample.GuildFletching.Description"),
            progress: { target: null, min: 0, max: null },
            requirements: [
                {
                    id: newId(),
                    whenUnmet: "HIDE",
                    hint: null,
                    test: { kind: "TOOL_PROFICIENCY", tool: "woodcarver" },
                },
            ],
            methods: hoursOfWork(),
            milestones: [
                everyBatch(
                    t("downtime-dnd5e.Sample.GuildFletching.GuildOrderFilled"),
                    6,
                    t("downtime-dnd5e.Sample.GuildFletching.AGuildOrderOf"),
                ),
            ],
        }),
        item("healers-hall", {
            name: t("downtime-dnd5e.Sample.HealersHall.Name"),
            description: t("downtime-dnd5e.Sample.HealersHall.Description"),
            progress: { target: 10, min: 0, max: 10 },
            requirements: [
                {
                    id: newId(),
                    whenUnmet: "DISABLE_WITH_HINT",
                    hint: t(
                        "downtime-dnd5e.Sample.HealersHall.OnlyCharactersProficientIn",
                    ),
                    test: {
                        kind: "SKILL",
                        skill: "med" as never,
                        min: "PROFICIENT",
                    },
                },
            ],
            methods: [
                {
                    ...base(t("downtime-dnd5e.Sample.HealersHall.TendTheSick")),
                    kind: "SKILL",
                    skill: "med" as never,
                    dc: 12,
                    results: defaultResultTable(true, newId),
                },
            ],
            milestones: [milestone("", 10, [complete(), announce()])],
        }),
    );

    return { category, actor: items, world };
}

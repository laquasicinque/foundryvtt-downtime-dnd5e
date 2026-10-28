/**
 * Starter downtimes: ready-made versions of common
 * downtime activities, as a starting point a GM then adjusts. Wording is our
 * own; numbers are sensible defaults, not rules text.
 */
import {
    createFromPreset,
    otherwiseBand,
    PRESETS,
    repeatingMilestoneSize,
    type PresetId,
} from "./editing";
import type {
    Id,
    MethodData,
    MilestoneAction,
    MilestoneData,
    ResultBand,
    TrackedItemData,
    IdGenerator,
} from "../../types/data";
import type { I18nKey, Translate } from "../../types/i18n";
import { SCHEMA_VERSION } from "../storage/schema";

export const STARTERS = [
    {
        id: "train-tool",
        label: "downtime-dnd5e.Starter.TrainTool.Label",
        hint: "downtime-dnd5e.Starter.TrainTool.Hint",
    },
    {
        id: "learn-language",
        label: "downtime-dnd5e.Starter.LearnLanguage.Label",
        hint: "downtime-dnd5e.Starter.LearnLanguage.Hint",
    },
    {
        id: "craft",
        label: "downtime-dnd5e.Starter.Craft.Label",
        hint: "downtime-dnd5e.Starter.Craft.Hint",
    },
    {
        id: "research",
        label: "downtime-dnd5e.Starter.Research.Label",
        hint: "downtime-dnd5e.Starter.Research.Hint",
    },
    {
        id: "work",
        label: "downtime-dnd5e.Starter.Work.Label",
        hint: "downtime-dnd5e.Starter.Work.Hint",
    },
    {
        id: "carousing",
        label: "downtime-dnd5e.Starter.Carousing.Label",
        hint: "downtime-dnd5e.Starter.Carousing.Hint",
    },
    {
        id: "reputation",
        label: "downtime-dnd5e.Starter.Reputation.Label",
        hint: "downtime-dnd5e.Starter.Reputation.Hint",
    },
    {
        id: "recuperate",
        label: "downtime-dnd5e.Starter.Recuperate.Label",
        hint: "downtime-dnd5e.Starter.Recuperate.Hint",
    },
] as const satisfies readonly { id: string; label: I18nKey; hint: I18nKey }[];

export type StarterId = (typeof STARTERS)[number]["id"];

export function buildStarter(
    starter: StarterId,
    newId: IdGenerator,
    t: Translate,
    categoryId: Id | null = null,
): TrackedItemData {
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
        margin: number | null,
        countsAs: ResultBand["countsAs"] = "SUCCESS",
    ): ResultBand => ({
        id: newId(),
        label,
        when:
            margin === null ? [] : [{ on: "MARGIN", op: "gte", value: margin }],
        effect: { delta: { kind: "STATIC", value } },
        countsAs,
    });
    const fixed = (
        name: string,
        value: number,
        countsAs: "SUCCESS" | "FAILURE" = "SUCCESS",
    ): MethodData => ({
        ...base(name),
        kind: "FIXED",
        effect: { delta: { kind: "STATIC", value } },
        countsAs,
    });
    const action = <K extends MilestoneAction["kind"]>(
        kind: K,
        extra: object = {},
    ) => ({ id: newId(), kind, ...extra }) as MilestoneAction;
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
    const announce = (message: string | null = null) =>
        action("ANNOUNCE", { message, audience: "WORLD_DEFAULT" });

    const item = (
        fields: Partial<TrackedItemData> & { name: string },
    ): TrackedItemData => ({
        schemaVersion: SCHEMA_VERSION,
        id: newId(),
        img: "icons/svg/book.svg",
        description: "",
        categoryId,
        hidden: false,
        preset: `starter:${starter}`,
        progress: { target: 10, min: 0, max: 10 },
        requirements: [],
        approval: "WORLD_DEFAULT",
        methods: [],
        milestones: [],
        history: [],
        quarantine: [],
        ...fields,
    });

    switch (starter) {
        case "train-tool":
            return item({
                name: t("downtime-dnd5e.Starter.TrainTool.Name"),
                img: "icons/tools/smithing/hammer-sledge-steel-grey.webp",
                description: t("downtime-dnd5e.Starter.TrainTool.Description"),
                methods: [
                    {
                        ...base(
                            t("downtime-dnd5e.Starter.TrainTool.Practise"),
                            t("downtime-dnd5e.Starter.TrainTool.PractiseHint"),
                        ),
                        kind: "TOOL",
                        tool: "smith",
                        fallback: { kind: "ABILITY", ability: "int" as never },
                        dc: 10,
                        results: {
                            bands: [
                                band(
                                    t(
                                        "downtime-dnd5e.Starter.TrainTool.GoodSession",
                                    ),
                                    2,
                                    5,
                                ),
                                band("", 1, 0),
                                otherwiseBand(newId),
                            ],
                        },
                    },
                    fixed(
                        t("downtime-dnd5e.Starter.TrainTool.StudyWithATeacher"),
                        1,
                    ),
                ],
                milestones: [
                    milestone(
                        t("downtime-dnd5e.Starter.TrainTool.Proficient"),
                        10,
                        [action("COMPLETE"), action("LOCK"), announce()],
                    ),
                ],
            });
        case "learn-language":
            return item({
                name: t("downtime-dnd5e.Starter.LearnLanguage.Name"),
                img: "icons/sundries/books/book-open-brown.webp",
                description: t(
                    "downtime-dnd5e.Starter.LearnLanguage.Description",
                ),
                methods: [
                    fixed(t("downtime-dnd5e.Starter.LearnLanguage.Lessons"), 1),
                    {
                        ...base(
                            t("downtime-dnd5e.Starter.LearnLanguage.Immersion"),
                            t(
                                "downtime-dnd5e.Starter.LearnLanguage.ImmersionHint",
                            ),
                        ),
                        kind: "SKILL",
                        skill: "ins" as never,
                        dc: 12,
                        results: {
                            bands: [
                                band("", 2, 0),
                                band(
                                    t(
                                        "downtime-dnd5e.Starter.LearnLanguage.LostInTranslation",
                                    ),
                                    0,
                                    null,
                                    "FAILURE",
                                ),
                            ],
                        },
                    },
                ],
                milestones: [
                    milestone(
                        t("downtime-dnd5e.Starter.LearnLanguage.Fluent"),
                        10,
                        [action("COMPLETE"), action("LOCK"), announce()],
                    ),
                ],
            });
        case "craft":
            return item({
                name: t("downtime-dnd5e.Starter.Craft.Name"),
                img: "icons/tools/hand/hammer-and-nail.webp",
                description: t("downtime-dnd5e.Starter.Craft.Description"),
                progress: { target: 20, min: 0, max: 20 },
                methods: [
                    {
                        ...base(t("downtime-dnd5e.Starter.Craft.WorkOnIt")),
                        kind: "TOOL",
                        tool: "smith",
                        fallback: null,
                        dc: 12,
                        results: {
                            bands: [
                                band(
                                    t("downtime-dnd5e.Starter.Craft.FineWork"),
                                    3,
                                    5,
                                ),
                                band("", 2, 0),
                                band(
                                    t(
                                        "downtime-dnd5e.Starter.Craft.WastedMaterials",
                                    ),
                                    -1,
                                    -5,
                                    "FAILURE",
                                ),
                                otherwiseBand(newId, 1),
                            ],
                        },
                    },
                ],
                milestones: [
                    milestone(t("downtime-dnd5e.Starter.Craft.Finished"), 20, [
                        action("COMPLETE"),
                        action("LOCK"),
                        announce(),
                    ]),
                ],
            });
        case "research":
            return item({
                name: t("downtime-dnd5e.Starter.Research.Name"),
                img: "icons/sundries/scrolls/scroll-bound-sealed-brown.webp",
                description: t("downtime-dnd5e.Starter.Research.Description"),
                methods: [
                    {
                        ...base(t("downtime-dnd5e.Starter.Research.Search")),
                        kind: "SKILL",
                        skill: "inv" as never,
                        dc: 15,
                        results: {
                            bands: [
                                {
                                    ...band(
                                        t(
                                            "downtime-dnd5e.Starter.Research.Breakthrough",
                                        ),
                                        3,
                                        null,
                                    ),
                                    when: [
                                        { on: "NATURAL", op: "eq", value: 20 },
                                    ],
                                },
                                band(
                                    t(
                                        "downtime-dnd5e.Starter.Research.StrongLead",
                                    ),
                                    2,
                                    5,
                                ),
                                band("", 1, 0),
                                otherwiseBand(newId),
                            ],
                        },
                    },
                ],
                milestones: [
                    milestone(
                        t("downtime-dnd5e.Starter.Research.AnswerFound"),
                        10,
                        [action("COMPLETE"), announce()],
                    ),
                ],
            });
        case "work":
            return item({
                name: t("downtime-dnd5e.Starter.Work.Name"),
                img: "icons/commodities/currency/coins-plain-stack-gold.webp",
                description: t("downtime-dnd5e.Starter.Work.Description"),
                progress: { target: null, min: 0, max: null },
                methods: [
                    fixed(t("downtime-dnd5e.Starter.Work.ADaysWork"), 1),
                    {
                        ...base(
                            t("downtime-dnd5e.Starter.Work.LogDays"),
                            t("downtime-dnd5e.Starter.Work.LogDaysHint"),
                        ),
                        kind: "MANUAL",
                        gmOnly: false,
                    },
                ],
                milestones: [
                    milestone(
                        t("downtime-dnd5e.Starter.Work.PaidWeek"),
                        5,
                        [
                            announce(
                                t(
                                    "downtime-dnd5e.Starter.Work.PaidWeekMessage",
                                ),
                            ),
                        ],
                        {
                            match: "EVERY",
                            maxTimes: null,
                        },
                    ),
                ],
            });
        case "carousing":
            return item({
                name: t("downtime-dnd5e.Starter.Carousing.Name"),
                img: "icons/consumables/drinks/alcohol-beer-stein-wooden-brown.webp",
                description: t("downtime-dnd5e.Starter.Carousing.Description"),
                progress: { target: null, min: 0, max: null },
                methods: [
                    {
                        ...base(
                            t("downtime-dnd5e.Starter.Carousing.ANightOut"),
                        ),
                        kind: "SKILL",
                        skill: "per" as never,
                        dc: 12,
                        results: {
                            bands: [
                                band(
                                    t(
                                        "downtime-dnd5e.Starter.Carousing.MadeAFriend",
                                    ),
                                    2,
                                    5,
                                ),
                                band(
                                    t(
                                        "downtime-dnd5e.Starter.Carousing.NewContact",
                                    ),
                                    1,
                                    0,
                                ),
                                band(
                                    t(
                                        "downtime-dnd5e.Starter.Carousing.Trouble",
                                    ),
                                    0,
                                    -5,
                                    "FAILURE",
                                ),
                                otherwiseBand(newId),
                            ],
                        },
                    },
                ],
            });
        case "reputation":
            return item({
                name: t("downtime-dnd5e.Starter.Reputation.Name"),
                img: "icons/sundries/flags/banner-flag-white.webp",
                description: t("downtime-dnd5e.Starter.Reputation.Description"),
                progress: { target: 10, min: -10, max: 10 },
                methods: [
                    fixed(
                        t("downtime-dnd5e.Starter.Reputation.DoThemAFavour"),
                        1,
                    ),
                    fixed(
                        t("downtime-dnd5e.Starter.Reputation.CrossThem"),
                        -1,
                        "FAILURE",
                    ),
                    {
                        ...base(
                            t("downtime-dnd5e.Starter.Reputation.MakeYourCase"),
                        ),
                        kind: "SKILL",
                        skill: "per" as never,
                        dc: 15,
                        results: {
                            bands: [
                                band(
                                    t(
                                        "downtime-dnd5e.Starter.Reputation.Impressed",
                                    ),
                                    2,
                                    0,
                                ),
                                band(
                                    t(
                                        "downtime-dnd5e.Starter.Reputation.Offended",
                                    ),
                                    -1,
                                    -5,
                                    "FAILURE",
                                ),
                                otherwiseBand(newId),
                            ],
                        },
                    },
                ],
                milestones: [
                    milestone(
                        t("downtime-dnd5e.Starter.Reputation.Trusted"),
                        5,
                        [announce()],
                    ),
                    milestone(t("downtime-dnd5e.Starter.Reputation.Ally"), 10, [
                        action("COMPLETE"),
                        announce(),
                    ]),
                    milestone(
                        t("downtime-dnd5e.Starter.Reputation.Enemy"),
                        -10,
                        [announce()],
                        {
                            match: "EXACT",
                            maxTimes: null,
                        },
                    ),
                ],
            });
        case "recuperate":
            return item({
                name: t("downtime-dnd5e.Starter.Recuperate.Name"),
                img: "icons/svg/regen.svg",
                description: t("downtime-dnd5e.Starter.Recuperate.Description"),
                progress: { target: 3, min: 0, max: 3 },
                methods: [
                    fixed(t("downtime-dnd5e.Starter.Recuperate.ADayOfRest"), 1),
                ],
                milestones: [
                    milestone(
                        t("downtime-dnd5e.Starter.Recuperate.Recovered"),
                        3,
                        [action("COMPLETE"), action("LOCK"), announce()],
                    ),
                ],
            });
    }
}

// ── Applying a preset to a draft ─────────────────────────────────────────────

export interface BlankPresetChoice {
    kind: "blank";
    id: PresetId;
}

export interface StarterPresetChoice {
    kind: "starter";
    id: StarterId;
}

export type PresetChoice = BlankPresetChoice | StarterPresetChoice;

export const DEFAULT_ITEM_IMG = "icons/svg/book.svg";
export const DEFAULT_ITEM_NAME: I18nKey = "downtime-dnd5e.Item.DefaultName";

/** Every choice, for the editor's Presets tab. */
export const PRESET_CHOICES: {
    choice: PresetChoice;
    label: I18nKey;
    hint: I18nKey;
}[] = [
    ...PRESETS.map((p) => ({
        choice: { kind: "blank" as const, id: p.id },
        label: p.label,
        hint: p.hint,
    })),
    ...STARTERS.map((s) => ({
        choice: { kind: "starter" as const, id: s.id },
        label: s.label,
        hint: s.hint,
    })),
];

/**
 * Reshape a draft to a preset: its progress, methods and milestones are
 * replaced. Identity, history, category, visibility, approval and the item's
 * own requirements stay. A starter also fills in the name, image and
 * description while those are still blank. Nothing is saved.
 */
export function applyPreset(
    draft: TrackedItemData,
    choice: PresetChoice,
    newId: IdGenerator,
    t: Translate,
): TrackedItemData {
    const shaped =
        choice.kind === "starter"
            ? buildStarter(choice.id, newId, t, draft.categoryId)
            : createFromPreset(
                  choice.id,
                  {
                      name: draft.name,
                      target:
                          choice.id === "repeating"
                              ? (repeatingMilestoneSize(draft.milestones) ?? 8)
                              : (draft.progress.target ?? 10),
                      categoryId: draft.categoryId,
                  },
                  newId,
                  t,
              );
    const starter = choice.kind === "starter";
    const blankName = !draft.name.trim() || draft.name === t(DEFAULT_ITEM_NAME);
    return {
        ...draft,
        preset: shaped.preset,
        progress: shaped.progress,
        methods: shaped.methods,
        milestones: shaped.milestones,
        name: starter && blankName ? shaped.name : draft.name,
        img:
            starter && (!draft.img || draft.img === DEFAULT_ITEM_IMG)
                ? shaped.img
                : draft.img,
        description:
            starter && !draft.description.trim()
                ? shaped.description
                : draft.description,
    };
}

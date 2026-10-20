import type {
    Contributor,
    MilestoneData,
    ResultBand,
    SkillMethodData,
    TrackedItemData,
} from "../../types/data";

export function counterIds(prefix = "gen") {
    let n = 0;
    return () => `${prefix}${++n}`;
}

export const alice: Contributor = {
    actorUuid: "Actor.alice",
    actorName: "Alice",
    userId: "user-a",
    userName: "Player A",
    userWasGM: false,
};

export const bob: Contributor = {
    actorUuid: "Actor.bob",
    actorName: "Bob",
    userId: "user-b",
    userName: "Player B",
    userWasGM: false,
};

export const gm: Contributor = {
    actorUuid: null,
    actorName: null,
    userId: "user-gm",
    userName: "Gamemaster",
    userWasGM: true,
};

export function item(
    overrides: Partial<TrackedItemData> = {},
): TrackedItemData {
    return {
        schemaVersion: 3,
        id: "item1",
        name: "Train Smith's Tools",
        img: "",
        description: "",
        categoryId: null,
        hidden: false,
        preset: null,
        progress: { target: 10, min: 0, max: 10 },
        requirements: [],
        approval: "WORLD_DEFAULT",
        methods: [],
        milestones: [],
        history: [],
        quarantine: [],
        ...overrides,
    };
}

export function band(
    id: string,
    value: number,
    when: ResultBand["when"] = [],
    countsAs: ResultBand["countsAs"] = "SUCCESS",
): ResultBand {
    return {
        id,
        label: id,
        when,
        effect: { delta: { kind: "STATIC", value } },
        countsAs,
    };
}

export function skillMethod(
    overrides: Partial<SkillMethodData> = {},
): SkillMethodData {
    return {
        id: "m1",
        kind: "SKILL",
        name: "Practice",
        description: "",
        img: null,
        hidden: false,
        requirements: [],
        usage: null,
        dc: 10,
        skill: "ath" as SkillMethodData["skill"],
        results: {
            bands: [
                band("pass", 1, [{ on: "MARGIN", op: "gte", value: 0 }]),
                band("fail", 0, [], "FAILURE"),
            ],
        },
        ...overrides,
    };
}

export function milestone(
    overrides: Partial<MilestoneData> = {},
): MilestoneData {
    return {
        id: "ms1",
        label: "Complete",
        at: 10,
        match: "CROSS",
        maxTimes: 1,
        revertWithCause: true,
        actions: [{ id: "a-complete", kind: "COMPLETE" }],
        ...overrides,
    };
}

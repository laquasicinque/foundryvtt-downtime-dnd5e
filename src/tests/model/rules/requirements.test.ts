import { describe, expect, it } from "vite-plus/test";
import { t } from "../../helpers/i18n";
import {
    referencedIds,
    remapRefs,
    resolveRef,
    type RefContext,
} from "../../../model/rules/refs";
import {
    describeRequirement,
    evaluateRequirements,
    requirementProblems,
    type RequirementContext,
} from "../../../model/rules/requirements";
import type { ActorView } from "../../../types/actors";
import { item, milestone, skillMethod } from "../../helpers/fixtures";
import { HistoryBuilder } from "../../helpers/HistoryBuilder";
import type {
    Requirement,
    RequirementTest,
    WhenUnmet,
} from "../../../types/data";

const actor: ActorView = {
    skills: {
        ath: { proficiency: 1, total: 5 },
        arc: { proficiency: 2, total: 9 },
        ste: { proficiency: 0, total: 1 },
    },
    abilities: { str: { score: 16, mod: 3 }, int: { score: 8, mod: -1 } },
    toolProficiencies: new Set(["smith"]),
    items: [
        {
            name: "Iron Ingot",
            identifier: "iron-ingot",
            sourceUuid: null,
            quantity: 2,
        },
        {
            name: "Iron Ingot",
            identifier: "iron-ingot",
            sourceUuid: null,
            quantity: 1,
        },
        {
            name: "Hammer",
            identifier: null,
            sourceUuid: "Compendium.x.Item.hammer",
            quantity: 1,
        },
    ],
};

const progressed = item({
    id: "other",
    history: new HistoryBuilder()
        .method("e1", 6)
        .milestone("ms-e1", "ms1", "e1").events,
});
const self = item();
const refs: RefContext = {
    self,
    sameStore: [self, progressed],
    worldStore: null,
    actingActorStore: null,
};

const ctx = (
    overrides: Partial<RequirementContext> = {},
): RequirementContext => ({
    actor,
    refs,
    macroResults: new Map(),
    ...overrides,
});

const req = (
    test: RequirementTest,
    whenUnmet: WhenUnmet = "DISABLE",
    id = "r1",
): Requirement => ({
    id,
    whenUnmet,
    hint: null,
    test,
});

const check = (requirements: Requirement[], context = ctx()) =>
    evaluateRequirements(
        skillMethod({ requirements }),
        context,
        (r) => `needs ${r.test.kind}`,
    );

describe("requirement tests", () => {
    it.each<[string, RequirementTest, boolean]>([
        [
            "skill proficient (met)",
            { kind: "SKILL", skill: "ath" as never, min: "PROFICIENT" },
            true,
        ],
        [
            "skill proficient (unmet)",
            { kind: "SKILL", skill: "ste" as never, min: "PROFICIENT" },
            false,
        ],
        [
            "skill expertise",
            { kind: "SKILL", skill: "arc" as never, min: "EXPERT" },
            true,
        ],
        [
            "skill bonus",
            { kind: "SKILL", skill: "ath" as never, min: { bonus: 6 } },
            false,
        ],
        [
            "ability score",
            { kind: "ABILITY", ability: "str" as never, min: { score: 15 } },
            true,
        ],
        [
            "ability mod",
            { kind: "ABILITY", ability: "int" as never, min: { mod: 0 } },
            false,
        ],
        ["tool proficiency", { kind: "TOOL_PROFICIENCY", tool: "smith" }, true],
        [
            "item quantity summed across stacks",
            {
                kind: "ITEM",
                match: {
                    identifier: "iron-ingot",
                    sourceUuid: null,
                    name: null,
                },
                quantity: 3,
            },
            true,
        ],
        [
            "item by source",
            {
                kind: "ITEM",
                match: {
                    identifier: null,
                    sourceUuid: "Compendium.x.Item.hammer",
                    name: null,
                },
                quantity: 1,
            },
            true,
        ],
        [
            "item by name, case-insensitive",
            {
                kind: "ITEM",
                match: { identifier: null, sourceUuid: null, name: "hammer" },
                quantity: 1,
            },
            true,
        ],
        [
            "progress of another item",
            {
                kind: "PROGRESS",
                ref: { kind: "ITEM", id: "other" },
                op: "gte",
                value: 5,
            },
            true,
        ],
        [
            "progress of self",
            { kind: "PROGRESS", ref: { kind: "SELF" }, op: "gte", value: 1 },
            false,
        ],
        [
            "milestone reached",
            {
                kind: "MILESTONE",
                ref: { kind: "ITEM", id: "other" },
                milestoneId: "ms1",
                reached: true,
            },
            true,
        ],
        [
            "milestone not reached",
            {
                kind: "MILESTONE",
                ref: { kind: "ITEM", id: "other" },
                milestoneId: "ms1",
                reached: false,
            },
            false,
        ],
    ])("%s", (_name, test, met) => {
        expect(check([req(test)]).state === "AVAILABLE").toBe(met);
    });

    it("uses the client's macro result", () => {
        const test: RequirementTest = { kind: "MACRO", macroUuid: "Macro.x" };
        expect(
            check([req(test)], ctx({ macroResults: new Map([["r1", true]]) }))
                .state,
        ).toBe("AVAILABLE");
        const missing = check([req(test)]);
        expect(missing.state !== "AVAILABLE" && missing.unmet[0]!.reason).toBe(
            "MACRO_NOT_EVALUATED",
        );
    });

    it("is unmet without an acting actor", () => {
        const result = check(
            [req({ kind: "TOOL_PROFICIENCY", tool: "smith" })],
            ctx({ actor: null }),
        );
        expect(result.state !== "AVAILABLE" && result.unmet[0]!.reason).toBe(
            "NO_ACTOR",
        );
    });

    it("is unmet (never crashes) for unresolvable references", () => {
        const result = check([
            req({
                kind: "PROGRESS",
                ref: { kind: "ITEM", id: "gone" },
                op: "gte",
                value: 0,
            }),
        ]);
        expect(result.state !== "AVAILABLE" && result.unmet[0]!.reason).toBe(
            "UNRESOLVED_REF",
        );
    });
});

describe("evaluateRequirements", () => {
    const unmetTest: RequirementTest = {
        kind: "TOOL_PROFICIENCY",
        tool: "alchemist",
    };

    it("picks the strictest unmet behaviour", () => {
        expect(
            check([
                req(unmetTest, "DISABLE_WITH_HINT", "a"),
                req(unmetTest, "HIDE", "b"),
            ]).state,
        ).toBe("HIDE");
        expect(
            check([
                req(unmetTest, "DISABLE_WITH_HINT", "a"),
                req(unmetTest, "DISABLE", "b"),
            ]).state,
        ).toBe("DISABLE");
    });

    it("only shows hints from DISABLE_WITH_HINT requirements, with auto-generated fallback", () => {
        const result = check([
            {
                ...req(unmetTest, "DISABLE_WITH_HINT", "a"),
                hint: "Learn alchemy first",
            },
            req(unmetTest, "DISABLE_WITH_HINT", "b"),
            req(unmetTest, "DISABLE", "c"),
        ]);
        expect(result.state !== "AVAILABLE" && result.hints).toEqual([
            "Learn alchemy first",
            "needs TOOL_PROFICIENCY",
        ]);
    });
});

describe("references", () => {
    it("resolves same store, then world, then acting actor", () => {
        const world = item({ id: "w" });
        const onActor = item({ id: "a" });
        const shadowed = item({ id: "w", name: "local copy" });
        const context: RefContext = {
            self,
            sameStore: [self, shadowed],
            worldStore: [world],
            actingActorStore: [onActor],
        };
        expect(resolveRef({ kind: "ITEM", id: "w" }, context)?.name).toBe(
            "local copy",
        );
        expect(
            resolveRef(
                { kind: "ITEM", id: "a" },
                { ...context, sameStore: [self] },
            ),
        ).toBe(onActor);
        expect(resolveRef({ kind: "SELF" }, context)).toBe(self);
    });

    it("lists and remaps referenced ids", () => {
        const linked = item({
            methods: [
                skillMethod({
                    requirements: [
                        req({
                            kind: "PROGRESS",
                            ref: { kind: "ITEM", id: "x" },
                            op: "gte",
                            value: 1,
                        }),
                    ],
                }),
            ],
            milestones: [
                milestone({
                    actions: [
                        {
                            id: "adj",
                            kind: "ADJUST_PROGRESS",
                            ref: { kind: "ITEM", id: "y" },
                            delta: 1,
                        },
                    ],
                }),
            ],
        });
        expect([...referencedIds(linked)].sort()).toEqual(["x", "y"]);
        const remapped = remapRefs(linked, new Map([["x", "x2"]]));
        expect([...referencedIds(remapped)].sort()).toEqual(["x2", "y"]);
    });

    it("includes item-level requirements", () => {
        const linked = item({
            requirements: [
                req({
                    kind: "MILESTONE",
                    ref: { kind: "ITEM", id: "z" },
                    milestoneId: "ms1",
                    reached: true,
                }),
            ],
        });
        expect([...referencedIds(linked)]).toEqual(["z"]);
        const remapped = remapRefs(linked, new Map([["z", "z2"]]));
        expect([...referencedIds(remapped)]).toEqual(["z2"]);
    });
});

const labels = {
    t,
    skill: (k: string) => ({ ath: "Athletics" })[k] ?? k,
    ability: (k: string) => ({ str: "Strength" })[k] ?? k,
    tool: (k: string) => ({ smith: "Smith's Tools" })[k] ?? k,
};

describe("describeRequirement", () => {
    const d = (test: RequirementTest, refs?: RefContext) =>
        describeRequirement(req(test), labels, refs);

    it("describes actor tests", () => {
        expect(
            d({ kind: "SKILL", skill: "ath" as never, min: "PROFICIENT" }),
        ).toBe("Requires proficiency in Athletics");
        expect(
            d({ kind: "SKILL", skill: "ath" as never, min: { bonus: 5 } }),
        ).toBe("Requires Athletics +5 or better");
        expect(
            d({ kind: "ABILITY", ability: "str" as never, min: { score: 13 } }),
        ).toBe("Requires Strength 13 or higher");
        expect(d({ kind: "TOOL_PROFICIENCY", tool: "smith" })).toBe(
            "Requires proficiency with Smith's Tools",
        );
        expect(
            d({
                kind: "ITEM",
                match: {
                    identifier: null,
                    sourceUuid: null,
                    name: "Iron Ingot",
                },
                quantity: 3,
            }),
        ).toBe("Requires 3× Iron Ingot");
    });

    it("names referenced items and milestones when it can", () => {
        const other = item({
            id: "other",
            name: "Harpers",
            milestones: [milestone({ id: "ms1", label: "Trusted" })],
        });
        const refs: RefContext = {
            self: item(),
            sameStore: [other],
            worldStore: null,
            actingActorStore: null,
        };
        expect(
            d(
                {
                    kind: "MILESTONE",
                    ref: { kind: "ITEM", id: "other" },
                    milestoneId: "ms1",
                    reached: true,
                },
                refs,
            ),
        ).toBe('Requires "Trusted" on "Harpers"');
        expect(
            d({
                kind: "PROGRESS",
                ref: { kind: "ITEM", id: "gone" },
                op: "gte",
                value: 5,
            }),
        ).toBe("Requires progress on another tracked item to be at least 5");
    });
});

describe("requirementProblems", () => {
    const refs: RefContext = {
        self: item(),
        sameStore: [item()],
        worldStore: null,
        actingActorStore: null,
    };

    it("blocks incomplete requirements", () => {
        const p = (test: RequirementTest) =>
            requirementProblems(req(test), t, refs).map((x) => x.blocking);
        expect(p({ kind: "MACRO", macroUuid: "" })).toEqual([true]);
        expect(
            p({
                kind: "ITEM",
                match: { identifier: null, sourceUuid: null, name: "" },
                quantity: 1,
            }),
        ).toEqual([true]);
        expect(
            p({
                kind: "MILESTONE",
                ref: { kind: "SELF" },
                milestoneId: "missing",
                reached: true,
            }),
        ).toEqual([true]);
    });

    it("only warns about references it can't find", () => {
        expect(
            requirementProblems(
                req({
                    kind: "PROGRESS",
                    ref: { kind: "ITEM", id: "elsewhere" },
                    op: "gte",
                    value: 1,
                }),
                t,
                refs,
            ),
        ).toEqual([expect.objectContaining({ blocking: false })]);
        expect(
            requirementProblems(
                req({ kind: "SKILL", skill: "ath" as never, min: "EXPERT" }),
                t,
                refs,
            ),
        ).toEqual([]);
    });
});

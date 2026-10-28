import { describe, expect, it } from "vite-plus/test";
import { t } from "../../helpers/i18n";
import {
    approvalCandidates,
    buildMethodCard,
} from "../../../model/views/methodCard";
import {
    alice,
    bob,
    item,
    milestone,
    skillMethod,
} from "../../helpers/fixtures";
import { HistoryBuilder } from "../../helpers/HistoryBuilder";
import type { TrackedItemData, UsageRule } from "../../../types/data";
import { usageSummary } from "../../../model/rules/usage";

const names = {
    actorName: () => null,
    userName: () => null,
    unknown: () => "Unknown",
};
const options = { isGM: false, names, t };

const limited: UsageRule = {
    count: { kind: "ATTEMPTS" },
    per: "ACTOR",
    tiers: [
        {
            from: 1,
            kind: "EFFECT",
            effect: { delta: { kind: "STATIC", value: 0 } },
        },
        { from: 3, kind: "DISABLE", hint: "Come back tomorrow" },
    ],
};

describe("usageSummary", () => {
    it("counts uses left before the next blocking tier", () => {
        expect(usageSummary(limited, 0, t)).toEqual({
            blocked: false,
            text: "3 uses left",
        });
        expect(usageSummary(limited, 2, t)).toEqual({
            blocked: false,
            text: "Next use: reduced effect · 1 use left",
        });
    });

    it("reports the DISABLE hint once blocked", () => {
        expect(usageSummary(limited, 3, t)).toEqual({
            blocked: true,
            text: "Come back tomorrow",
        });
        expect(
            usageSummary(
                { ...limited, tiers: [{ from: 1, kind: "HIDE" }] },
                1,
                t,
            ).text,
        ).toBe("No uses left");
    });

    it("is silent without limits or reduced tiers", () => {
        expect(usageSummary({ ...limited, tiers: [] }, 5, t).text).toBeNull();
    });
});

describe("buildMethodCard", () => {
    function withHistory(build: (h: HistoryBuilder) => HistoryBuilder) {
        return item({
            methods: [skillMethod({ usage: limited })],
            milestones: [
                milestone({
                    actions: [
                        { id: "a-complete", kind: "COMPLETE" },
                        {
                            id: "a-grant",
                            kind: "GRANT_ITEM",
                            sourceUuid: "Item.x",
                            quantity: 1,
                            recipient: {
                                type: "CONTRIBUTORS",
                                filter: {
                                    window: "ALL_TIME",
                                    minNet: null,
                                    minAttempts: null,
                                    methodIds: [],
                                },
                                selection: "GM_PICKS",
                            },
                        },
                    ],
                }),
            ],
            history: build(new HistoryBuilder()).events,
        });
    }

    it("returns null for unknown or non-method events", () => {
        const data = withHistory((h) => h.method("e1", 1).adjust("e2", 1));
        expect(buildMethodCard(data, "nope", options)).toBeNull();
        expect(buildMethodCard(data, "e2", options)).toBeNull();
    });

    it("shows progress as of the use, with clamping and percent", () => {
        const data = withHistory((h) =>
            h.method("e1", 8).method("e2", 5).method("e3", 1),
        );
        const card = buildMethodCard(data, "e2", options)!;
        expect(card.progress).toEqual({
            before: 8,
            after: 10,
            applied: 2,
            requested: 5,
            clamped: true,
            target: 10,
            percent: 100,
        });
        expect(card.band).toEqual({ label: "pass", countsAs: "SUCCESS" });
    });

    it("computes usage from the history up to this use only", () => {
        const data = withHistory((h) =>
            h.method("e1", 1).method("e2", 1).method("e3", 1),
        );
        expect(buildMethodCard(data, "e1", options)!.usage).toEqual({
            text: "Next use: reduced effect · 2 uses left",
            blocked: false,
        });
        expect(buildMethodCard(data, "e3", options)!.usage).toEqual({
            text: "Come back tomorrow",
            blocked: true,
        });
    });

    it("lists the milestones it fired with live action status", () => {
        const data = withHistory((h) =>
            h.method("e1", 10).milestone("ms-e", "ms1", "e1", [
                { actionId: "a-complete", kind: "COMPLETE" },
                {
                    actionId: "a-grant",
                    kind: "GRANT_ITEM",
                    status: "PENDING_APPROVAL",
                },
            ]),
        );
        const pending = buildMethodCard(data, "e1", options)!;
        expect(pending.milestones).toHaveLength(1);
        expect(pending.milestones[0]!.label).toBe("Complete");
        expect(
            pending.milestones[0]!.actions.map((a) => [
                a.actionId,
                a.status,
                a.gmPicks,
            ]),
        ).toEqual([
            ["a-complete", "APPLIED", false],
            ["a-grant", "PENDING_APPROVAL", true],
        ]);

        const approved: TrackedItemData = {
            ...data,
            history: new HistoryBuilder()
                .method("e1", 10)
                .milestone("ms-e", "ms1", "e1", [
                    { actionId: "a-complete", kind: "COMPLETE" },
                    {
                        actionId: "a-grant",
                        kind: "GRANT_ITEM",
                        status: "PENDING_APPROVAL",
                    },
                ])
                .approval("ap", "ms-e", "a-grant", true, {
                    kind: "GRANT_ITEM",
                }).events,
        };
        expect(
            buildMethodCard(approved, "e1", options)!.milestones[0]!.actions[1]!
                .status,
        ).toBe("APPLIED");
    });

    it("marks reverted uses and their milestones", () => {
        const data = withHistory((h) =>
            h
                .method("e1", 10)
                .milestone("ms-e", "ms1", "e1")
                .revert("r1", "e1", ["ms-e"]),
        );
        const card = buildMethodCard(data, "e1", options)!;
        expect(card.reverted).toBe(true);
        expect(card.milestones[0]!.reverted).toBe(true);
        expect(card.milestones[0]!.actions[0]!.status).toBe("REVERTED");
    });

    it("hides the note from players", () => {
        const data = withHistory((h) => h.method("e1", 1));
        data.history[0]!.note = "secret";
        expect(buildMethodCard(data, "e1", options)!.note).toBeNull();
        expect(
            buildMethodCard(data, "e1", { ...options, isGM: true })!.note,
        ).toBe("secret");
    });

    it("explains a tool fallback and names the tool and activity used", () => {
        const base = item({
            methods: [
                {
                    ...skillMethod(),
                    kind: "TOOL",
                    tool: "smith",
                    fallback: { kind: "SKILL", skill: "ath" },
                } as never,
            ],
            history: new HistoryBuilder().method("e1", 1).events,
        });
        const roll = (rolled: object) => ({
            ...base,
            history: base.history.map((e) => ({
                ...e,
                roll: {
                    formula: "1d20",
                    total: 12,
                    natural: 12,
                    dc: 10,
                    dcSource: "METHOD",
                    rolled,
                    rollMode: "publicroll",
                    messageId: null,
                },
            })) as TrackedItemData["history"],
        });
        const toolLabel = (k: string) => (k === "smith" ? "Smith's Tools" : k);
        expect(
            buildMethodCard(
                roll({ kind: "SKILL", key: "ath", label: "Athletics" }),
                "e1",
                { ...options, toolLabel },
            )!.rolledWith,
        ).toBe("Smith's Tools not found, rolled Athletics");
        expect(
            buildMethodCard(
                roll({
                    kind: "TOOL",
                    key: "smith",
                    label: "Smith's Tools",
                    toolItemName: "Fine Hammer",
                    activityName: "Forge",
                }),
                "e1",
                { ...options, toolLabel },
            )!.rolledWith,
        ).toBe("Fine Hammer · Forge");
    });
});

describe("approvalCandidates", () => {
    it("lists eligible contributors with an actor", () => {
        const data = item({
            milestones: [
                milestone({
                    actions: [
                        {
                            id: "a-grant",
                            kind: "GRANT_ITEM",
                            sourceUuid: "Item.x",
                            quantity: 1,
                            recipient: {
                                type: "CONTRIBUTORS",
                                filter: {
                                    window: "ALL_TIME",
                                    minNet: null,
                                    minAttempts: null,
                                    methodIds: [],
                                },
                                selection: "GM_PICKS",
                            },
                        },
                    ],
                }),
            ],
            history: new HistoryBuilder()
                .method("e1", 4, { contributor: alice })
                .method("e2", 6, { contributor: bob })
                .milestone("ms-e", "ms1", "e2", [
                    {
                        actionId: "a-grant",
                        kind: "GRANT_ITEM",
                        status: "PENDING_APPROVAL",
                    },
                ]).events,
        });
        expect(approvalCandidates(data, "ms-e", "a-grant")).toEqual([
            {
                actorUuid: "Actor.alice",
                eligible: true,
                stats: { net: 4, attempts: 1 },
            },
            {
                actorUuid: "Actor.bob",
                eligible: true,
                stats: { net: 6, attempts: 1 },
            },
        ]);
        expect(approvalCandidates(data, "ms-e", "missing")).toBeNull();
    });

    it("lists filtered-out contributors unticked", () => {
        const recipient = {
            type: "CONTRIBUTORS" as const,
            filter: {
                window: "ALL_TIME" as const,
                minNet: 5,
                minAttempts: null,
                methodIds: [],
            },
            selection: "GM_PICKS" as const,
        };
        const data = item({
            milestones: [
                milestone({
                    actions: [
                        {
                            id: "a-grant",
                            kind: "GRANT_ITEM",
                            sourceUuid: "Item.x",
                            quantity: 1,
                            recipient,
                        },
                    ],
                }),
            ],
            history: new HistoryBuilder()
                .method("e1", 4, { contributor: alice })
                .method("e2", 6, { contributor: bob })
                .milestone("ms-e", "ms1", "e2", [
                    {
                        actionId: "a-grant",
                        kind: "GRANT_ITEM",
                        status: "PENDING_APPROVAL",
                    },
                ]).events,
        });
        expect(
            approvalCandidates(data, "ms-e", "a-grant")!.map((c) => [
                c.actorUuid,
                c.eligible,
            ]),
        ).toEqual([
            ["Actor.alice", false],
            ["Actor.bob", true],
        ]);
    });
});

import { describe, expect, it } from "vite-plus/test";
import {
    contributions,
    eligibleContributors,
    lastFireSeq,
    UNATTRIBUTED,
} from "../../../model/rules/contributions";
import {
    contributorDisplayName,
    contributorKey,
} from "../../../model/rules/contributor";
import { alice, bob, gm, item } from "../../helpers/fixtures";
import { HistoryBuilder } from "../../helpers/HistoryBuilder";
import type { ContributorFilter } from "../../../types/data";

const unbounded = { target: 20, min: null, max: null };

describe("contributions", () => {
    const history = new HistoryBuilder(unbounded)
        .method("e1", 3, { contributor: alice })
        .method("e2", -1, { contributor: alice })
        .method("e3", 2, { contributor: bob, methodId: "m2" })
        .adjust("e4", 5, gm)
        .set("e5", 0, gm).events;

    it("totals net, gained and lost, excluding SET", () => {
        const { total } = contributions(history);
        expect(total).toMatchObject({
            net: 9,
            gained: 10,
            lost: -1,
            attempts: 3,
            successes: 2,
            failures: 1,
        });
    });

    it("breaks down by method, band and contributor", () => {
        const result = contributions(history);
        expect(result.byMethod.m1!.net).toBe(2);
        expect(result.byMethod.m2!.net).toBe(2);
        expect(result.byMethod[UNATTRIBUTED]!.net).toBe(5);
        expect(result.byBand.pass!.net).toBe(5);
        expect(result.byContributor[contributorKey(alice)]).toMatchObject({
            net: 2,
            attempts: 2,
        });
        expect(
            result.byContributorAndMethod[contributorKey(bob)]!.m2!.net,
        ).toBe(2);
    });

    it("filters to the viewer's own contributions", () => {
        const result = contributions(history, {
            viewer: { userId: "user-b", ownedActorUuids: new Set() },
        });
        expect(Object.keys(result.byContributor)).toEqual([
            contributorKey(bob),
        ]);
        expect(result.total.net).toBe(2);
    });

    it("counts owned actors as the viewer's own", () => {
        const result = contributions(history, {
            viewer: {
                userId: "someone-else",
                ownedActorUuids: new Set(["Actor.alice"]),
            },
        });
        expect(result.total.net).toBe(2);
    });

    it("filters by method", () => {
        expect(contributions(history, { methodIds: ["m2"] }).total.net).toBe(2);
    });
});

describe("eligibleContributors", () => {
    const filter: ContributorFilter = {
        window: "ALL_TIME",
        minNet: null,
        minAttempts: null,
        methodIds: [],
    };

    it("applies minNet and minAttempts", () => {
        const history = new HistoryBuilder(unbounded)
            .method("e1", 3, { contributor: alice })
            .method("e2", 1, { contributor: bob }).events;
        const tracked = item({ history, progress: unbounded });
        expect(
            eligibleContributors(tracked, "ms1", filter).map((c) => c.key),
        ).toHaveLength(2);
        expect(
            eligibleContributors(tracked, "ms1", { ...filter, minNet: 2 }).map(
                (c) => c.contributor.actorName,
            ),
        ).toEqual(["Alice"]);
        expect(
            eligibleContributors(tracked, "ms1", { ...filter, minAttempts: 2 }),
        ).toEqual([]);
    });

    it("SINCE_LAST_FIRE only counts contributions after the previous firing", () => {
        const history = new HistoryBuilder(unbounded)
            .method("e1", 5, { contributor: alice })
            .milestone("ms-e1", "ms1", "e1")
            .method("e2", 5, { contributor: bob })
            .milestone("ms-e2", "ms1", "e2").events;
        const tracked = item({ history, progress: unbounded });
        expect(lastFireSeq(history, "ms1")).toBe(3);

        // Evaluating the second firing (seq 3): only Bob contributed since the first.
        const eligible = eligibleContributors(
            tracked,
            "ms1",
            { ...filter, window: "SINCE_LAST_FIRE" },
            3,
        );
        expect(eligible.map((c) => c.contributor.actorName)).toEqual(["Bob"]);
    });
});

describe("contributorDisplayName", () => {
    const lookup = {
        actorName: (uuid: string) =>
            uuid === "Actor.alice" ? "Alice (renamed)" : null,
        userName: (id: string) => (id === "user-gm" ? "GM Live" : null),
        unknown: () => "Unknown",
    };

    it("prefers the live actor name", () => {
        expect(contributorDisplayName(alice, lookup)).toBe("Alice (renamed)");
    });

    it("falls back to the stored actor name, then user names", () => {
        expect(contributorDisplayName(bob, lookup)).toBe("Bob");
        expect(
            contributorDisplayName(
                { ...bob, actorUuid: null, actorName: null },
                lookup,
            ),
        ).toBe("Player B");
    });

    it("shows GM user first with the actor in brackets", () => {
        expect(contributorDisplayName(gm, lookup)).toBe("GM Live");
        expect(
            contributorDisplayName(
                { ...gm, actorUuid: "Actor.alice", actorName: "Alice" },
                lookup,
            ),
        ).toBe("GM Live (Alice (renamed))");
    });

    it("is Unknown when nothing is known", () => {
        expect(
            contributorDisplayName(
                {
                    actorUuid: null,
                    actorName: null,
                    userId: null,
                    userName: null,
                    userWasGM: false,
                },
                lookup,
            ),
        ).toBe("Unknown");
    });
});

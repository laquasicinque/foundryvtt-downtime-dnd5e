import { describe, expect, it } from "vite-plus/test";
import { t } from "../../helpers/i18n";
import {
    EMPTY_FILTER,
    filterEvents,
    filterOptions,
    unreviewedEvents,
    type HistoryViewer,
} from "../../../model/views/historyView";
import { alice, bob, item, skillMethod } from "../../helpers/fixtures";
import { HistoryBuilder } from "../../helpers/HistoryBuilder";

const names = {
    actorName: () => null,
    userName: () => null,
    unknown: () => "Unknown",
};
const gmViewer: HistoryViewer = {
    userId: "user-gm",
    ownedActorUuids: new Set(),
    isGM: true,
};
const aliceViewer: HistoryViewer = {
    userId: "user-a",
    ownedActorUuids: new Set(["Actor.alice"]),
    isGM: false,
};

function data() {
    return item({
        methods: [skillMethod(), skillMethod({ id: "m2", name: "Study" })],
        history: new HistoryBuilder()
            .method("e1", 1, { contributor: alice })
            .method("e2", 0, { contributor: bob, methodId: "m2" })
            .adjust("e3", 2)
            .method("e4", 1, { contributor: alice })
            .revert("r1", "e4").events,
    });
}

const ids = (events: { id: string }[]) => events.map((e) => e.id);

describe("filterEvents", () => {
    it("is newest first and hides reverted entries by default", () => {
        expect(ids(filterEvents(data(), EMPTY_FILTER, gmViewer))).toEqual([
            "e3",
            "e2",
            "e1",
        ]);
        expect(
            ids(
                filterEvents(
                    data(),
                    { ...EMPTY_FILTER, showReverted: true },
                    gmViewer,
                ),
            ),
        ).toEqual(["r1", "e4", "e3", "e2", "e1"]);
    });

    it("filters by kind, method, band and contributor", () => {
        const f = (patch: Partial<typeof EMPTY_FILTER>) =>
            ids(filterEvents(data(), { ...EMPTY_FILTER, ...patch }, gmViewer));
        expect(f({ kinds: ["ADJUST"] })).toEqual(["e3"]);
        expect(f({ methodIds: ["m2"] })).toEqual(["e2"]);
        expect(f({ bandIds: ["pass"] })).toEqual(["e1"]);
        expect(f({ contributorKeys: ["actor:Actor.bob"] })).toEqual(["e2"]);
    });

    it("shows players only their own contributions", () => {
        expect(ids(filterEvents(data(), EMPTY_FILTER, aliceViewer))).toEqual([
            "e1",
        ]);
    });
});

describe("filterOptions", () => {
    it("offers what the viewer can see, with live names", () => {
        const options = filterOptions(data(), gmViewer, names, t);
        expect(options.methods).toEqual([
            { value: "m1", label: "Practice" },
            { value: "m2", label: "Study" },
        ]);
        expect(options.bands.map((b) => b.value).sort()).toEqual([
            "fail",
            "pass",
        ]);
        expect(options.contributors.map((c) => c.label)).toEqual([
            "Alice",
            "Bob",
            "Gamemaster",
        ]);
        expect(
            filterOptions(data(), aliceViewer, names, t).contributors,
        ).toHaveLength(1);
    });
});

describe("unreviewedEvents", () => {
    it("lists undismissed, unreverted player changes", () => {
        const d = data();
        d.history[0]!.dismissed = true;
        expect(ids(unreviewedEvents(d))).toEqual(["e2"]);
        expect(ids(unreviewedEvents(d, (c) => c.userId === "user-b"))).toEqual(
            [],
        );
    });
});

import { describe, expect, it } from "vite-plus/test";
import { t } from "../../helpers/i18n";
import {
    decodeActorCollection,
    diffTrackedItem,
    encodeTrackedItem,
    orderTrackedItems,
} from "../../../model/storage/storage";
import { counterIds, item } from "../../helpers/fixtures";
import { HistoryBuilder } from "../../helpers/HistoryBuilder";

describe("encodeTrackedItem / decode", () => {
    it("stores history keyed by event id and round-trips through decode", () => {
        const history = new HistoryBuilder()
            .method("e1", 1)
            .method("e2", 2).events;
        const original = item({ history });
        const stored = encodeTrackedItem(original);
        expect(Object.keys(stored.history)).toEqual(["e1", "e2"]);

        const decoded = decodeActorCollection(
            {
                schemaVersion: 3,
                items: { item1: stored },
                order: ["item1"],
                categories: [],
            },
            counterIds(),
            t,
        );
        expect(decoded.items).toEqual([original]);
        expect(decoded.broken).toEqual([]);
    });

    it("never throws on garbage", () => {
        expect(decodeActorCollection(undefined, counterIds(), t).items).toEqual(
            [],
        );
        expect(
            decodeActorCollection({ items: "x", order: 3 }, counterIds(), t)
                .items,
        ).toEqual([]);
    });

    it("reports unrecoverable items as broken, keeping the rest", () => {
        const decoded = decodeActorCollection(
            {
                items: {
                    good: encodeTrackedItem(item({ id: "good" })),
                    bad: "junk",
                },
            },
            counterIds(),
            t,
        );
        expect(decoded.items.map((i) => i.id)).toEqual(["good"]);
        expect(decoded.broken.map((b) => b.key)).toEqual(["bad"]);
    });

    it("treats the storage key as the item id", () => {
        const decoded = decodeActorCollection(
            { items: { key1: encodeTrackedItem(item({ id: "other" })) } },
            counterIds(),
            t,
        );
        expect(decoded.items[0]!.id).toBe("key1");
    });

    it("decodes categories, dropping duplicates", () => {
        const decoded = decodeActorCollection(
            {
                categories: [
                    { id: "c1", name: "A", description: "" },
                    { id: "c1", name: "B" },
                    "junk",
                ],
            },
            counterIds(),
            t,
        );
        expect(decoded.categories).toEqual([
            { id: "c1", name: "A", description: "" },
        ]);
    });
});

describe("orderTrackedItems", () => {
    it("uses the stored order, appending unknown items by name", () => {
        const items = [
            item({ id: "c", name: "Charlie" }),
            item({ id: "a", name: "Alpha" }),
            item({ id: "b", name: "Bravo" }),
        ];
        expect(
            orderTrackedItems(items, ["b", "missing"]).map((i) => i.id),
        ).toEqual(["b", "a", "c"]);
    });
});

describe("diffTrackedItem", () => {
    it("writes only appended events", () => {
        const builder = new HistoryBuilder().method("e1", 1);
        const before = item({ history: [...builder.events] });
        builder.method("e2", 1);
        const after = item({ history: builder.events });
        expect(diffTrackedItem(before, after)).toEqual([
            { kind: "set", path: ["history", "e2"], value: after.history[1] },
        ]);
    });

    it("rewrites events whose dismissed/note changed", () => {
        const history = new HistoryBuilder().method("e1", 1).events;
        const before = item({ history });
        const after = item({ history: [{ ...history[0]!, dismissed: true }] });
        expect(diffTrackedItem(before, after).map((op) => op.path)).toEqual([
            ["history", "e1"],
        ]);
    });

    it("writes changed config fields individually", () => {
        const before = item();
        const after = item({
            name: "Renamed",
            progress: { target: 20, min: 0, max: 20 },
        });
        expect(diffTrackedItem(before, after).map((op) => op.path)).toEqual([
            ["name"],
            ["progress"],
        ]);
    });

    it("writes the whole item when it is new", () => {
        const created = item();
        expect(diffTrackedItem(null, created)).toEqual([
            { kind: "set", path: [], value: encodeTrackedItem(created) },
        ]);
    });
});

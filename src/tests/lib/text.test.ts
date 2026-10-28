import { describe, expect, it } from "vite-plus/test";
import { compareText, pluralKey, resolveText } from "../../lib/text";
import { t } from "../helpers/i18n";

describe("compareText", () => {
    it("orders like localeCompare", () => {
        const words = ["banana", "Apple", "cherry", "apple", "Éclair"];
        expect([...words].sort(compareText)).toEqual(
            [...words].sort((a, b) => a.localeCompare(b)),
        );
        expect(compareText("a", "a")).toBe(0);
    });
});

describe("pluralKey", () => {
    const has = (forms: string[]) => (key: string) =>
        forms.some((form) => key === `x.${form}`);

    it("picks the language's plural form when the key has forms", () => {
        const en = has(["one", "other"]);
        expect(pluralKey("x", { count: 1 }, "en", en)).toBe("x.one");
        expect(pluralKey("x", { count: 0 }, "en", en)).toBe("x.other");
        expect(pluralKey("x", { count: 2 }, "en", en)).toBe("x.other");
        // Polish: 2–4 is "few", 5+ is "many".
        const pl = has(["one", "few", "many", "other"]);
        expect(pluralKey("x", { count: 3 }, "pl", pl)).toBe("x.few");
        expect(pluralKey("x", { count: 5 }, "pl", pl)).toBe("x.many");
    });

    it("falls back to other, and leaves keys without forms alone", () => {
        expect(pluralKey("x", { count: 3 }, "pl", has(["one", "other"]))).toBe(
            "x.other",
        );
        expect(pluralKey("x", { count: 1 }, "en", has([]))).toBe("x");
        expect(pluralKey("x", undefined, "en", has(["one", "other"]))).toBe(
            "x",
        );
    });
});

describe("resolveText", () => {
    it("localizes keys, nested values and plural forms; plain strings stay", () => {
        expect(resolveText("as typed", t)).toBe("as typed");
        expect(resolveText(null, t)).toBeNull();
        expect(
            resolveText(
                {
                    key: "downtime-dnd5e.Revert.AlsoMilestones",
                    vars: {
                        milestones: {
                            key: "downtime-dnd5e.Count.Milestones",
                            vars: { count: 2 },
                        },
                    },
                },
                t,
            ),
        ).toBe("This also reverts 2 milestones.");
    });
});

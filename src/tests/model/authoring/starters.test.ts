import { describe, expect, it } from "vite-plus/test";
import { t } from "../../helpers/i18n";
import { parseTrackedItem } from "../../../model/storage/normalize/item";
import {
    applyPreset,
    buildStarter,
    STARTERS,
} from "../../../model/authoring/starters";
import { counterIds } from "../../helpers/fixtures";

describe("starter downtimes", () => {
    it.each(STARTERS.map((s) => s.id))("%s parses cleanly", (id) => {
        const item = buildStarter(id, counterIds(id), t, "cat");
        const parsed = parseTrackedItem(JSON.parse(JSON.stringify(item)), {
            randomId: counterIds("x"),
            t,
        });
        expect(parsed.issues).toEqual([]);
        expect(parsed.value).toEqual(item);
        expect(item.preset).toBe(`starter:${id}`);
        expect(item.categoryId).toBe("cat");
    });
});

describe("applyPreset", () => {
    const draft = () => ({
        ...buildStarter("research", counterIds("d"), t, "cat"),
        id: "keep",
        name: "My research",
        preset: null,
        hidden: true,
        requirements: [],
        history: [],
    });

    it("reshapes progress, methods and milestones, keeping the rest", () => {
        const applied = applyPreset(
            draft(),
            { kind: "blank", id: "open-ended" },
            counterIds("p"),
            t,
        );
        expect(applied).toMatchObject({
            id: "keep",
            name: "My research",
            categoryId: "cat",
            hidden: true,
            preset: "open-ended",
            progress: { target: null },
        });
        expect(applied.methods.map((m) => m.kind)).toEqual(["FIXED"]);
        expect(applied.milestones).toEqual([]);
    });

    it("keeps the target for goals and fills blank fields from starters", () => {
        const base = { ...draft(), progress: { target: 25, min: 0, max: 25 } };
        expect(
            applyPreset(base, { kind: "blank", id: "goal" }, counterIds("p"), t)
                .milestones[0]!.at,
        ).toBe(25);
        const blank = { ...base, name: "", description: "", img: "" };
        const starter = applyPreset(
            blank,
            { kind: "starter", id: "craft" },
            counterIds("p"),
            t,
        );
        expect(starter.name).toBe("Craft an item");
        expect(starter.description).not.toBe("");
        expect(
            applyPreset(
                base,
                { kind: "starter", id: "craft" },
                counterIds("p"),
                t,
            ).name,
        ).toBe("My research");
    });
});

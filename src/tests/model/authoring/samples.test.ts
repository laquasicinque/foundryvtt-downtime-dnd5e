import { describe, expect, it } from "vite-plus/test";
import { parseTrackedItem } from "../../../model/storage/normalize/item";
import { referencedIds } from "../../../model/rules/refs";
import { buildSamples, isSample } from "../../../model/authoring/samples";
import { counterIds } from "../../helpers/fixtures";
import { t } from "../../helpers/i18n";

const build = (overrides: Partial<Parameters<typeof buildSamples>[0]> = {}) =>
    buildSamples({
        newId: counterIds("s"),
        t,
        grantItemUuid: "Compendium.dnd5e.items.Item.potion",
        macroName: "Sample macro",
        effectUuid: "Item.feat.ActiveEffect.inspired",
        actionMacroUuid: "Macro.celebrate",
        undoMacroUuid: "Macro.uncelebrate",
        ...overrides,
    });

describe("sample downtimes", () => {
    it("are all valid and parse without repairs or quarantine", () => {
        const samples = build();
        for (const item of [...samples.actor, ...samples.world]) {
            const parsed = parseTrackedItem(JSON.parse(JSON.stringify(item)), {
                randomId: counterIds("x"),
                t,
            });
            expect(parsed.issues, item.name).toEqual([]);
            expect(parsed.value).toEqual(item);
        }
    });

    it("are marked as samples, in the Samples category, with unique ids", () => {
        const samples = build();
        const all = [...samples.actor, ...samples.world];
        expect(all.every(isSample)).toBe(true);
        expect(all.every((i) => i.categoryId === samples.category.id)).toBe(
            true,
        );
        expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
        expect(new Set(all.map((i) => i.preset)).size).toBe(all.length);
    });

    it("only reference items in the same store", () => {
        const samples = build();
        const actorIds = new Set(samples.actor.map((i) => i.id));
        for (const item of samples.actor) {
            for (const id of referencedIds(item))
                expect(actorIds.has(id), `${item.name} → ${id}`).toBe(true);
        }
        for (const item of samples.world)
            expect([...referencedIds(item)]).toEqual([]);
    });

    it("cover the feature set", () => {
        const all = [...build().actor, ...build().world];
        const methods = all.flatMap((i) => i.methods);
        const actions = all.flatMap((i) =>
            i.milestones.flatMap((m) => m.actions),
        );
        expect(new Set(methods.map((m) => m.kind))).toEqual(
            new Set(["ABILITY", "SKILL", "TOOL", "FIXED", "MANUAL", "MACRO"]),
        );
        expect(new Set(actions.map((a) => a.kind))).toEqual(
            new Set([
                "COMPLETE",
                "LOCK",
                "ANNOUNCE",
                "GRANT_ITEM",
                "APPLY_EFFECT",
                "ADD_TRACKED_ITEM",
                "ADJUST_PROGRESS",
                "MACRO",
            ]),
        );
        expect(
            all.some((i) => i.progress.min !== null && i.progress.min < 0),
        ).toBe(true);
        expect(all.some((i) => i.progress.target === null)).toBe(true);
        expect(
            all.some(
                (i) => i.progress.max === null && i.progress.target !== null,
            ),
        ).toBe(true);
        expect(all.some((i) => i.hidden)).toBe(true);
        expect(all.some((i) => i.approval === "GM")).toBe(true);
        expect(methods.some((m) => m.usage !== null)).toBe(true);
        expect(methods.some((m) => m.requirements.length > 0)).toBe(true);
        expect(
            all.some((i) => i.milestones.some((m) => m.match === "EXACT")),
        ).toBe(true);
        expect(
            all.some((i) => i.milestones.some((m) => m.match === "EVERY")),
        ).toBe(true);
        expect(
            all.some((i) => i.requirements.some((r) => r.whenUnmet === "HIDE")),
        ).toBe(true);
        expect(
            all.some((i) =>
                i.requirements.some((r) => r.whenUnmet === "DISABLE_WITH_HINT"),
            ),
        ).toBe(true);
    });

    it("fall back to announcements without a grant item, and skip the macro sample without a macro", () => {
        const samples = build({
            grantItemUuid: null,
            macroName: null,
            effectUuid: null,
            actionMacroUuid: null,
        });
        const actions = [...samples.actor, ...samples.world].flatMap((i) =>
            i.milestones.flatMap((m) => m.actions),
        );
        expect(actions.some((a) => a.kind === "GRANT_ITEM")).toBe(false);
        expect(
            samples.actor.some((i) =>
                i.methods.some((m) => m.kind === "MACRO"),
            ),
        ).toBe(false);
        expect(
            actions.some(
                (a) => a.kind === "APPLY_EFFECT" || a.kind === "MACRO",
            ),
        ).toBe(false);
    });
});

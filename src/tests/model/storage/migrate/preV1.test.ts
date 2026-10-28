import { describe, expect, it } from "vite-plus/test";
import { counterIds } from "../../../helpers/fixtures";
import { upgradePreV1 } from "../../../../model/storage/migrate/preV1";

describe("upgradePreV1", () => {
    const up = (raw: unknown) => upgradePreV1(raw, counterIds("id"));

    it("leaves V1 data alone", () => {
        const v1 = {
            schemaVersion: 1,
            progressionStyle: "ABILITY",
            ability: "ath",
        };
        expect(up(v1)).toBe(v1);
    });

    it("splits the old ability field into ability / skill / tool", () => {
        expect(
            up({ progressionStyle: "ABILITY", ability: "str" }),
        ).toMatchObject({
            progressionStyle: "ABILITY",
            ability: "str",
            schemaVersion: 1,
        });
        expect(
            up({ progressionStyle: "ABILITY", ability: "ath" }),
        ).toMatchObject({
            progressionStyle: "SKILL",
            skill: "ath",
            ability: null,
        });
        expect(
            up({ progressionStyle: "ABILITY", ability: "tool-smith" }),
        ).toMatchObject({
            progressionStyle: "TOOL",
            tool: "tool-smith",
        });
    });

    it("turns anything else into a +1 counter and ids the log", () => {
        const raw = { name: "Old", progressionStyle: "simple", changes: [{}] };
        const result = up(raw) as Record<string, unknown>;
        expect(result).toMatchObject({
            id: "id1",
            progressionStyle: "FIXED",
            fixedIncrease: 1,
            img: "icons/svg/book.svg",
        });
        expect((result.changes as { id: string }[])[0]!.id).toBe("id2");
        expect(raw).not.toHaveProperty("id"); // the input isn't modified
    });
});

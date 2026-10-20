import { describe, expect, it } from "vite-plus/test";
import { toV1 } from "../../../model/storage/legacy";
import { item, skillMethod } from "../../helpers/fixtures";
import { HistoryBuilder } from "../../helpers/HistoryBuilder";

describe("toV1", () => {
    it("projects derived progress, the first method and the audit trail", () => {
        const v1 = toV1(
            item({
                categoryId: "cat",
                methods: [skillMethod({ dc: 12 })],
                history: new HistoryBuilder()
                    .method("e1", 2)
                    .adjust("e2", 3)
                    .method("e3", 1)
                    .revert("r1", "e3").events,
            }),
        );
        expect(v1).toMatchObject({
            category: "cat",
            progressionStyle: "SKILL",
            skill: "ath",
            dc: 12,
            progress: 5,
            completionAt: 10,
            schemaVersion: 1,
        });
        expect(
            v1.changes.map((c) => [c.actionName, c.oldValue, c.newValue]),
        ).toEqual([
            ["Practice", 0, 2],
            ["Adjust Progress", 2, 5],
        ]);
    });
});

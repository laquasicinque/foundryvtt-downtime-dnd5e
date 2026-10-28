import { describe, expect, it } from "vite-plus/test";
import { SerialQueue } from "../../lib/SerialQueue";

describe("SerialQueue", () => {
    it("runs jobs one at a time, in order, even when one fails", async () => {
        const queue = new SerialQueue();
        const log: string[] = [];
        const job =
            (name: string, ms: number, fail = false) =>
            () =>
                new Promise<string>((resolve, reject) =>
                    setTimeout(() => {
                        log.push(name);
                        if (fail) reject(new Error(name));
                        else resolve(name);
                    }, ms),
                );

        const results = await Promise.allSettled([
            queue.run(job("slow", 20)),
            queue.run(job("fails", 1, true)),
            queue.run(job("fast", 1)),
        ]);
        expect(log).toEqual(["slow", "fails", "fast"]);
        expect(results.map((r) => r.status)).toEqual([
            "fulfilled",
            "rejected",
            "fulfilled",
        ]);
    });
});

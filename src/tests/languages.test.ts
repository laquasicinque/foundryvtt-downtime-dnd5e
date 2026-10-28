import { describe, expect, it } from "vite-plus/test";
import en from "../languages/en.json";
import es from "../languages/es.json";
import ko from "../languages/ko.json";
import ptBR from "../languages/pt-BR.json";

const files = { en, es, ko, "pt-BR": ptBR } as Record<
    string,
    Record<string, string>
>;

describe("language files", () => {
    // Foundry expands dotted keys into objects, so "a.b" and "a.b.c" can't both
    // exist: the file then fails to load and every key shows raw.
    it.each(Object.keys(files))(
        "%s has no key that's also a prefix",
        (lang) => {
            const keys = new Set(Object.keys(files[lang]!));
            const prefixes = (key: string) =>
                key
                    .split(".")
                    .slice(0, -1)
                    .map((_, i, parts) => parts.slice(0, i + 1).join("."));
            const clashes = [...keys].filter((key) =>
                prefixes(key).some((prefix) => keys.has(prefix)),
            );
            expect(clashes).toEqual([]);
        },
    );

    it("translations only use keys English has", () => {
        for (const [lang, strings] of Object.entries(files))
            expect(
                Object.keys(strings).filter((key) => !(key in en)),
                lang,
            ).toEqual([]);
    });
});

import type { LocalizedText } from "../../../types/i18n";

/** A record that can't be normalised at `path`; quarantined or reported by the caller. */
export class InvalidRecord extends Error {
    readonly path: string;
    readonly text: LocalizedText;

    constructor(path: string, text: LocalizedText) {
        super(text.key);
        this.name = "InvalidRecord";
        this.path = path;
        this.text = text;
    }
}

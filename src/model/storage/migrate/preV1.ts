/**
 * Pre-0.6 (schemaVersion < 1) tracked items → the V1 shape, so the V1 → V3
 * migration only has to understand one V1 format. Old items had a single
 * "ABILITY" progression whose `ability` field held an ability, a skill or a
 * `tool-…` key; anything else was a simple +1 counter.
 */

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const SKILLS = [
    "acr",
    "ani",
    "arc",
    "ath",
    "dec",
    "his",
    "ins",
    "inv",
    "itm",
    "med",
    "nat",
    "per",
    "prc",
    "prf",
    "rel",
    "slt",
    "ste",
    "sur",
];
const V1_STYLES = ["ABILITY", "SKILL", "TOOL", "MACRO", "FIXED"];

type Raw = Record<string, unknown>;

function oldRollType(
    item: Raw,
): "ability" | "skill" | "tool" | "macro" | "simple" | null {
    const style = item.progressionStyle;
    if (style === "ABILITY") {
        const ability = typeof item.ability === "string" ? item.ability : "";
        if (ABILITIES.includes(ability)) return "ability";
        if (SKILLS.includes(ability)) return "skill";
        if (ability.startsWith("tool-")) return "tool";
        return null;
    }
    if (style === "MACRO") return "macro";
    return "simple";
}

/** Upgrade one pre-V1 item in place (a copy is the caller's job). */
function upgrade(item: Raw, randomId: () => string): Raw {
    item.id ||= randomId();
    item.category ||= "";
    item.img ||= "icons/svg/book.svg";
    item.ability ||= null;
    item.skill ||= null;
    item.tool ||= null;
    item.fixedIncrease ||= null;
    item.macroName ||= null;
    item.dc ||= null;

    // Already a V1 style: only the bookkeeping above was missing.
    if (
        !V1_STYLES.includes(item.progressionStyle as string) ||
        item.progressionStyle === "ABILITY"
    ) {
        switch (oldRollType(item)) {
            case "ability":
                item.progressionStyle = "ABILITY";
                break;
            case "skill":
                item.progressionStyle = "SKILL";
                item.skill = item.ability;
                item.ability = null;
                break;
            case "tool":
                item.progressionStyle = "TOOL";
                item.tool = item.ability;
                item.ability = null;
                break;
            case "simple":
                item.progressionStyle = "FIXED";
                item.fixedIncrease = 1;
                break;
            case "macro":
                item.progressionStyle = "MACRO";
                break;
        }
    }
    const changes = Array.isArray(item.changes) ? (item.changes as Raw[]) : [];
    for (const entry of changes) entry.id ||= randomId();
    item.schemaVersion = 1;
    return item;
}

/** V1 (or newer) data passes through untouched; older items are upgraded on a copy. */
export function upgradePreV1(raw: unknown, randomId: () => string): unknown {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
        return raw;
    const record = raw as Raw;
    if (typeof record.schemaVersion === "number" && record.schemaVersion >= 1)
        return raw;
    return upgrade(structuredClone(record), randomId);
}

import type {
    AbilityKey,
    BandCondition,
    BandEffect,
    CompareOp,
    CountsAs,
    DeltaSpec,
    ItemMatch,
    ItemRef,
    MethodData,
    MethodBaseData,
    Requirement,
    RequirementTest,
    ResultBand,
    ResultTable,
    SkillKey,
    ToolFallback,
    UsageCount,
    UsageRule,
    UsageTier,
} from "../../../types/data";
import {
    bool,
    fail,
    id,
    join,
    list,
    nullableNum,
    nullableStr,
    num,
    obj,
    oneOf,
    repaired,
    requiredStr,
    str,
    strList,
    type NormalizeContext,
} from "./fields";
import { isFiniteNumber, isRecord } from "../../../lib/values";

/*
 * Fail-closed rule: anything structurally wrong inside a method (a band, a
 * requirement, the usage rule) quarantines the whole method rather than
 * silently dropping the broken part, which could make a method easier to use
 * than the GM intended.
 */

const COMPARE_OPS = [
    "lt",
    "lte",
    "eq",
    "gte",
    "gt",
] as const satisfies readonly CompareOp[];

export function parseCountsAs(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): CountsAs {
    if (raw === null || raw === undefined) return null;
    if (raw === "SUCCESS" || raw === "FAILURE") return raw;
    repaired(ctx, path, "downtime-dnd5e.Data.ReplacedWithNull", {
        value: JSON.stringify(raw),
    });
    return null;
}

export function parseDelta(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): DeltaSpec {
    // Bare numbers are accepted as STATIC (hand-edited data).
    if (isFiniteNumber(raw)) {
        repaired(ctx, path, "downtime-dnd5e.Data.NumberToStaticDelta");
        return { kind: "STATIC", value: raw };
    }
    const o = obj(raw, path);
    const kind = oneOf(o, "kind", ["STATIC", "FORMULA"], path, ctx);
    if (kind === "STATIC") return { kind, value: num(o, "value", path, ctx) };
    return { kind, formula: requiredStr(o, "formula", path) };
}

export function parseEffect(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): BandEffect {
    const o = obj(raw, path);
    return { delta: parseDelta(o.delta, join(path, "delta"), ctx) };
}

function parseCondition(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): BandCondition {
    const o = obj(raw, path);
    return {
        on: oneOf(o, "on", ["NATURAL", "TOTAL", "MARGIN"], path, ctx),
        op: oneOf(o, "op", COMPARE_OPS, path, ctx),
        value: num(o, "value", path, ctx),
    };
}

function parseBand(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): ResultBand {
    const o = obj(raw, path);
    return {
        id: id(o, "id", path, ctx),
        label: str(o, "label", path, ctx, ""),
        when: list(o, "when", path, ctx).map((c, i) =>
            parseCondition(c, join(join(path, "when"), i), ctx),
        ),
        effect: parseEffect(o.effect, join(path, "effect"), ctx),
        countsAs: parseCountsAs(o.countsAs, join(path, "countsAs"), ctx),
    };
}

/** The repair for a table whose last band isn't unconditional. */
export function fallbackBand(ctx: NormalizeContext): ResultBand {
    return {
        id: ctx.randomId(),
        label: "",
        when: [],
        effect: { delta: { kind: "STATIC", value: 0 } },
        countsAs: "FAILURE",
    };
}

export function parseResultTable(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): ResultTable {
    const o = obj(raw, path);
    const bandsPath = join(path, "bands");
    const bands = list(o, "bands", path, ctx).map((b, i) =>
        parseBand(b, join(bandsPath, i), ctx),
    );
    const seen = new Set<string>();
    for (const band of bands) {
        if (seen.has(band.id))
            fail(bandsPath, "downtime-dnd5e.Data.DuplicateBandId", {
                id: band.id,
            });
        seen.add(band.id);
    }
    if (bands.length === 0 || bands.at(-1)!.when.length > 0) {
        repaired(ctx, bandsPath, "downtime-dnd5e.Data.AppendedOtherwise");
        bands.push(fallbackBand(ctx));
    }
    return { bands };
}

function parseUsageCount(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): UsageCount {
    const o = obj(raw, path);
    const kind = oneOf(
        o,
        "kind",
        ["ATTEMPTS", "SUCCESSES", "FAILURES", "BANDS"],
        path,
        ctx,
    );
    if (kind === "BANDS")
        return { kind, bandIds: strList(o, "bandIds", path, ctx) };
    return { kind };
}

function parseTier(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
    methodKind: MethodData["kind"],
): UsageTier {
    const o = obj(raw, path);
    const from = num(o, "from", path, ctx);
    if (from < 0) fail(join(path, "from"), "downtime-dnd5e.Data.TierNegative");
    const kind = oneOf(
        o,
        "kind",
        ["NORMAL", "RESULTS", "EFFECT", "DISABLE", "HIDE"],
        path,
        ctx,
    );
    switch (kind) {
        case "NORMAL":
        case "HIDE":
            return { from, kind };
        case "DISABLE":
            return { from, kind, hint: nullableStr(o, "hint", path, ctx) };
        case "RESULTS":
            if (methodKind === "FIXED" || methodKind === "MANUAL")
                fail(
                    join(path, "kind"),
                    "downtime-dnd5e.Data.ResultsTierInvalid",
                    { kind: methodKind },
                );
            return {
                from,
                kind,
                results: parseResultTable(
                    o.results,
                    join(path, "results"),
                    ctx,
                ),
            };
        case "EFFECT":
            if (methodKind !== "FIXED")
                fail(
                    join(path, "kind"),
                    "downtime-dnd5e.Data.EffectTierInvalid",
                );
            return {
                from,
                kind,
                effect: parseEffect(o.effect, join(path, "effect"), ctx),
            };
    }
}

function parseUsage(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
    methodKind: MethodData["kind"],
): UsageRule | null {
    if (raw === null || raw === undefined) return null;
    const o = obj(raw, path);
    const tiers = list(o, "tiers", path, ctx).map((t, i) =>
        parseTier(t, join(join(path, "tiers"), i), ctx, methodKind),
    );
    const sorted = [...tiers].sort((a, b) => a.from - b.from);
    if (sorted.some((tier, i) => tier !== tiers[i]))
        repaired(ctx, join(path, "tiers"), "downtime-dnd5e.Data.SortedTiers");
    return {
        count: parseUsageCount(o.count, join(path, "count"), ctx),
        per: oneOf(o, "per", ["ITEM", "ACTOR", "USER"], path, ctx, "ACTOR"),
        tiers: sorted,
    };
}

export function parseTrackedItemRef(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): ItemRef {
    const o = obj(raw, path);
    const kind = oneOf(o, "kind", ["SELF", "ITEM"], path, ctx);
    if (kind === "SELF") return { kind };
    return { kind, id: requiredStr(o, "id", path) };
}

function parseItemMatch(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): ItemMatch {
    const o = obj(raw, path);
    const match = {
        identifier: nullableStr(o, "identifier", path, ctx),
        sourceUuid: nullableStr(o, "sourceUuid", path, ctx),
        name: nullableStr(o, "name", path, ctx),
    };
    if (!match.identifier && !match.sourceUuid && !match.name)
        fail(path, "downtime-dnd5e.Data.ItemMatchEmpty");
    return match;
}

function parseTest(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): RequirementTest {
    const o = obj(raw, path);
    const kind = oneOf(
        o,
        "kind",
        [
            "PROGRESS",
            "MILESTONE",
            "SKILL",
            "ABILITY",
            "TOOL_PROFICIENCY",
            "ITEM",
            "MACRO",
        ],
        path,
        ctx,
    );
    switch (kind) {
        case "PROGRESS":
            return {
                kind,
                ref: parseTrackedItemRef(o.ref, join(path, "ref"), ctx),
                op: oneOf(o, "op", COMPARE_OPS, path, ctx),
                value: num(o, "value", path, ctx),
            };
        case "MILESTONE":
            return {
                kind,
                ref: parseTrackedItemRef(o.ref, join(path, "ref"), ctx),
                milestoneId: requiredStr(o, "milestoneId", path),
                reached: bool(o, "reached", path, ctx, true),
            };
        case "SKILL": {
            const min = o.min;
            let parsedMin: "PROFICIENT" | "EXPERT" | { bonus: number };
            if (min === "PROFICIENT" || min === "EXPERT") parsedMin = min;
            else if (isRecord(min))
                parsedMin = {
                    bonus: num(min, "bonus", join(path, "min"), ctx),
                };
            else
                fail(join(path, "min"), "downtime-dnd5e.Data.InvalidSkillMin", {
                    value: JSON.stringify(min),
                });
            return {
                kind,
                skill: requiredStr(o, "skill", path) as SkillKey,
                min: parsedMin,
            };
        }
        case "ABILITY": {
            const min = obj(o.min, join(path, "min"));
            const parsedMin =
                "score" in min
                    ? { score: num(min, "score", join(path, "min"), ctx) }
                    : { mod: num(min, "mod", join(path, "min"), ctx) };
            return {
                kind,
                ability: requiredStr(o, "ability", path) as AbilityKey,
                min: parsedMin,
            };
        }
        case "TOOL_PROFICIENCY":
            return { kind, tool: requiredStr(o, "tool", path) };
        case "ITEM":
            return {
                kind,
                match: parseItemMatch(o.match, join(path, "match"), ctx),
                quantity: Math.max(1, num(o, "quantity", path, ctx, 1)),
            };
        case "MACRO":
            return { kind, macroUuid: requiredStr(o, "macroUuid", path) };
    }
}

export function parseRequirement(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): Requirement {
    const o = obj(raw, path);
    return {
        id: id(o, "id", path, ctx),
        whenUnmet: oneOf(
            o,
            "whenUnmet",
            ["HIDE", "DISABLE", "DISABLE_WITH_HINT"],
            path,
            ctx,
            "DISABLE",
        ),
        hint: nullableStr(o, "hint", path, ctx),
        test: parseTest(o.test, join(path, "test"), ctx),
    };
}

function parseFallback(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): ToolFallback | null {
    if (raw === null || raw === undefined) return null;
    const o = obj(raw, path);
    const kind = oneOf(o, "kind", ["SKILL", "ABILITY"], path, ctx);
    if (kind === "SKILL")
        return { kind, skill: requiredStr(o, "skill", path) as SkillKey };
    return { kind, ability: requiredStr(o, "ability", path) as AbilityKey };
}

export const METHOD_KINDS = [
    "ABILITY",
    "SKILL",
    "TOOL",
    "FIXED",
    "MANUAL",
    "MACRO",
] as const satisfies readonly MethodData["kind"][];

export function parseMethod(
    raw: unknown,
    path: string,
    ctx: NormalizeContext,
): MethodData {
    const o = obj(raw, path);
    const kind = oneOf(o, "kind", METHOD_KINDS, path, ctx);

    const requirements = list(o, "requirements", path, ctx).map((r, i) =>
        parseRequirement(r, join(join(path, "requirements"), i), ctx),
    );
    const requirementIds = new Set<string>();
    for (const requirement of requirements) {
        if (requirementIds.has(requirement.id))
            fail(
                join(path, "requirements"),
                "downtime-dnd5e.Data.DuplicateRequirementId",
                { id: requirement.id },
            );
        requirementIds.add(requirement.id);
    }

    const base: MethodBaseData = {
        id: id(o, "id", path, ctx),
        name: str(
            o,
            "name",
            path,
            ctx,
            ctx.t("downtime-dnd5e.Data.UnnamedMethod"),
        ),
        description: str(o, "description", path, ctx, ""),
        img: nullableStr(o, "img", path, ctx),
        hidden: bool(o, "hidden", path, ctx, false),
        requirements,
        usage: parseUsage(o.usage, join(path, "usage"), ctx, kind),
    };

    switch (kind) {
        case "ABILITY":
        case "SKILL":
        case "TOOL": {
            const check = {
                ...base,
                dc: nullableNum(o, "dc", path, ctx),
                results: parseResultTable(
                    o.results,
                    join(path, "results"),
                    ctx,
                ),
            };
            if (kind === "ABILITY")
                return {
                    ...check,
                    kind,
                    ability: requiredStr(o, "ability", path) as AbilityKey,
                };
            if (kind === "SKILL")
                return {
                    ...check,
                    kind,
                    skill: requiredStr(o, "skill", path) as SkillKey,
                };
            return {
                ...check,
                kind,
                tool: requiredStr(o, "tool", path),
                fallback: parseFallback(
                    o.fallback,
                    join(path, "fallback"),
                    ctx,
                ),
            };
        }
        case "FIXED":
            return {
                ...base,
                kind,
                effect: parseEffect(o.effect, join(path, "effect"), ctx),
                countsAs: parseCountsAs(
                    o.countsAs,
                    join(path, "countsAs"),
                    ctx,
                ),
            };
        case "MANUAL":
            return {
                ...base,
                kind,
                gmOnly: bool(o, "gmOnly", path, ctx, true),
            };
        case "MACRO": {
            const macroUuid =
                typeof o.macroUuid === "string" ? o.macroUuid : "";
            const macroName = nullableStr(o, "macroName", path, ctx);
            if (!macroUuid && !macroName)
                fail(path, "downtime-dnd5e.Data.MacroMethodEmpty");
            return {
                ...base,
                kind,
                macroUuid,
                macroName,
                results:
                    o.results === null || o.results === undefined
                        ? null
                        : parseResultTable(
                              o.results,
                              join(path, "results"),
                              ctx,
                          ),
            };
        }
    }
}

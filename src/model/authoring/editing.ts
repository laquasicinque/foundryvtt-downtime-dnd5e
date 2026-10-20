/**
 * Pure helpers for editors: result tables, method defaults and
 * presets. Everything returns new data; nothing mutates.
 */
import type {
    BandCondition,
    CategoryData,
    Id,
    ManualMethodData,
    MethodData,
    MethodKind,
    MilestoneAction,
    MilestoneData,
    Recipient,
    ResultBand,
    ResultTable,
    TrackedItemData,
    TrackedItemTemplate,
    UsageRule,
    UsageTier,
    IdGenerator,
} from "../../types/data";
import type { I18nKey, Translate } from "../../types/i18n";
import { SCHEMA_VERSION } from "../storage/schema";

// ── Result tables ────────────────────────────────────────────────────────────

export function otherwiseBand(newId: IdGenerator, value = 0): ResultBand {
    return {
        id: newId(),
        label: "",
        when: [],
        effect: { delta: { kind: "STATIC", value } },
        countsAs: "FAILURE",
    };
}

/**
 * Default table. With a DC, the DC is the lowest success band:
 * `meet the DC → +1 (success)`, `otherwise → +0 (failure)`. Without a DC,
 * every roll adds its total (V1 behaviour).
 */
export function defaultResultTable(
    hasDc: boolean,
    newId: IdGenerator,
): ResultTable {
    if (!hasDc) {
        return {
            bands: [
                {
                    id: newId(),
                    label: "",
                    when: [],
                    effect: { delta: { kind: "FORMULA", formula: "@total" } },
                    countsAs: "SUCCESS",
                },
            ],
        };
    }
    return {
        bands: [
            {
                id: newId(),
                label: "",
                when: [{ on: "MARGIN", op: "gte", value: 0 }],
                effect: { delta: { kind: "STATIC", value: 1 } },
                countsAs: "SUCCESS",
            },
            otherwiseBand(newId),
        ],
    };
}

export const isOtherwise = (band: ResultBand) => band.when.length === 0;

/** The last band must be unconditional; append one if it isn't. */
export function ensureOtherwise(
    table: ResultTable,
    newId: IdGenerator,
): ResultTable {
    const last = table.bands.at(-1);
    if (last && isOtherwise(last)) return table;
    return { bands: [...table.bands, otherwiseBand(newId)] };
}

/**
 * Insert a band above/below `index`. Nothing goes below the final
 * "otherwise" row: "below" the last band inserts just above it.
 */
export function insertBand(
    table: ResultTable,
    index: number,
    where: "above" | "below",
    band: ResultBand,
): ResultTable {
    const bands = [...table.bands];
    let at = where === "above" ? index : index + 1;
    const lastIndex = bands.length - 1;
    if (at > lastIndex && bands[lastIndex] && isOtherwise(bands[lastIndex]))
        at = lastIndex;
    bands.splice(Math.max(0, at), 0, band);
    return { bands };
}

/** A new conditional band relative to the DC (or total without one). */
export function newConditionalBand(
    newId: IdGenerator,
    hasDc: boolean,
    value = 0,
): ResultBand {
    const condition: BandCondition = hasDc
        ? { on: "MARGIN", op: "gte", value }
        : { on: "TOTAL", op: "gte", value };
    return {
        id: newId(),
        label: "",
        when: [condition],
        effect: { delta: { kind: "STATIC", value: 1 } },
        countsAs: "SUCCESS",
    };
}

/** Move a band up/down. The final "otherwise" row stays last. */
export function moveBand(
    table: ResultTable,
    index: number,
    direction: -1 | 1,
): ResultTable {
    const bands = [...table.bands];
    const target = index + direction;
    const lastIsOtherwise = isOtherwise(bands.at(-1)!);
    const maxMovable = lastIsOtherwise ? bands.length - 2 : bands.length - 1;
    if (index > maxMovable || target < 0 || target > maxMovable) return table;
    [bands[index], bands[target]] = [bands[target]!, bands[index]!];
    return { bands };
}

/** Remove a band. The final "otherwise" row can't be removed. */
export function removeBand(table: ResultTable, index: number): ResultTable {
    const isLast = index === table.bands.length - 1;
    if (isLast && isOtherwise(table.bands[index]!)) return table;
    return { bands: table.bands.filter((_, i) => i !== index) };
}

export function updateBand(
    table: ResultTable,
    index: number,
    patch: Partial<ResultBand>,
): ResultTable {
    return {
        bands: table.bands.map((band, i) =>
            i === index ? { ...band, ...patch } : band,
        ),
    };
}

/** Human-readable threshold for the editor ladder, e.g. "15+" for MARGIN gte 5 at DC 10. */
export function describeCondition(
    condition: BandCondition,
    dc: number | null,
    t: Translate,
): string {
    const symbol = { lt: "<", lte: "≤", eq: "=", gte: "≥", gt: ">" }[
        condition.op
    ];
    switch (condition.on) {
        case "NATURAL":
            return t("downtime-dnd5e.Band.Condition.Natural", {
                op: symbol,
                value: condition.value,
            });
        case "TOTAL":
            return t("downtime-dnd5e.Band.Condition.Total", {
                op: symbol,
                value: condition.value,
            });
        case "MARGIN": {
            const margin = t(
                condition.value >= 0
                    ? "downtime-dnd5e.Band.Condition.DcPlus"
                    : "downtime-dnd5e.Band.Condition.DcMinus",
                { value: Math.abs(condition.value) },
            );
            return dc === null
                ? t("downtime-dnd5e.Band.Condition.Margin", {
                      op: symbol,
                      margin,
                  })
                : t("downtime-dnd5e.Band.Condition.MarginAt", {
                      op: symbol,
                      margin,
                      total: dc + condition.value,
                  });
        }
    }
}

// ── Methods ──────────────────────────────────────────────────────────────────

export const METHOD_KIND_LABELS: Record<MethodKind, I18nKey> = {
    ABILITY: "downtime-dnd5e.MethodKind.ABILITY",
    SKILL: "downtime-dnd5e.MethodKind.SKILL",
    TOOL: "downtime-dnd5e.MethodKind.TOOL",
    FIXED: "downtime-dnd5e.MethodKind.FIXED",
    MANUAL: "downtime-dnd5e.MethodKind.MANUAL",
    MACRO: "downtime-dnd5e.MethodKind.MACRO",
};

export function defaultMethod(
    kind: MethodKind,
    newId: IdGenerator,
    t: Translate,
): MethodData {
    const base = {
        id: newId(),
        name: t(METHOD_KIND_LABELS[kind]),
        description: "",
        img: null,
        hidden: false,
        requirements: [],
        usage: null,
    };
    switch (kind) {
        case "ABILITY":
            return {
                ...base,
                kind,
                ability: "str" as never,
                dc: 10,
                results: defaultResultTable(true, newId),
            };
        case "SKILL":
            return {
                ...base,
                kind,
                skill: "ath" as never,
                dc: 10,
                results: defaultResultTable(true, newId),
            };
        case "TOOL":
            return {
                ...base,
                kind,
                tool: "",
                fallback: null,
                dc: 10,
                results: defaultResultTable(true, newId),
            };
        case "FIXED":
            return {
                ...base,
                kind,
                effect: { delta: { kind: "STATIC", value: 1 } },
                countsAs: "SUCCESS",
            };
        case "MANUAL":
            return { ...base, kind, gmOnly: true };
        case "MACRO":
            return {
                ...base,
                kind,
                macroUuid: "",
                macroName: null,
                results: null,
            };
    }
}

/**
 * Change a method's kind, keeping the shared fields (name, description,
 * requirements, usage) and the DC/results where both kinds have them.
 */
export function changeMethodKind(
    method: MethodData,
    kind: MethodKind,
    newId: IdGenerator,
    t: Translate,
): MethodData {
    if (method.kind === kind) return method;
    const fresh = defaultMethod(kind, newId, t);
    const shared = {
        id: method.id,
        name: method.name,
        description: method.description,
        img: method.img,
        hidden: method.hidden,
        requirements: method.requirements,
        usage: method.usage,
    };
    const checkKinds = ["ABILITY", "SKILL", "TOOL"];
    if (
        checkKinds.includes(kind) &&
        checkKinds.includes(method.kind) &&
        "dc" in method &&
        "dc" in fresh
    ) {
        return {
            ...fresh,
            ...shared,
            dc: method.dc,
            results: (method as { results: ResultTable }).results,
        } as MethodData;
    }
    return { ...fresh, ...shared } as MethodData;
}

// ── Presets (UI-only quick starts) ───────────────────────────────────────────

export type PresetId = "goal" | "goal-lock" | "open-ended" | "repeating";

export const PRESETS: { id: PresetId; label: I18nKey; hint: I18nKey }[] = [
    {
        id: "goal",
        label: "downtime-dnd5e.Preset.Goal",
        hint: "downtime-dnd5e.Preset.GoalHint",
    },
    {
        id: "goal-lock",
        label: "downtime-dnd5e.Preset.GoalLock",
        hint: "downtime-dnd5e.Preset.GoalLockHint",
    },
    {
        id: "open-ended",
        label: "downtime-dnd5e.Preset.OpenEnded",
        hint: "downtime-dnd5e.Preset.OpenEndedHint",
    },
    {
        id: "repeating",
        label: "downtime-dnd5e.Preset.Repeating",
        hint: "downtime-dnd5e.Preset.RepeatingHint",
    },
];

/** Batch size of a draft's repeating ("every N") milestone, if it has one. */
export function repeatingMilestoneSize(
    milestones: readonly MilestoneData[],
): number | null {
    return milestones.find((m) => m.match === "EVERY")?.at ?? null;
}

export function createFromPreset(
    preset: PresetId,
    options: { name: string; target: number; categoryId?: Id | null },
    newId: IdGenerator,
    t: Translate,
): TrackedItemData {
    const base: TrackedItemData = {
        schemaVersion: SCHEMA_VERSION,
        id: newId(),
        name: options.name,
        img: "icons/svg/book.svg",
        description: "",
        categoryId: options.categoryId ?? null,
        hidden: false,
        preset,
        progress: { target: options.target, min: 0, max: options.target },
        requirements: [],
        approval: "WORLD_DEFAULT",
        methods: [defaultMethod("SKILL", newId, t)],
        milestones: [],
        history: [],
        quarantine: [],
    };
    if (preset === "repeating") {
        // Total progress keeps counting; a milestone fires for every `target` (batch size).
        return {
            ...base,
            progress: { target: null, min: 0, max: null },
            methods: [
                defaultMethod("FIXED", newId, t),
                {
                    ...(defaultMethod("MANUAL", newId, t) as ManualMethodData),
                    gmOnly: false,
                },
            ],
            milestones: [
                {
                    id: newId(),
                    label: t("downtime-dnd5e.Preset.BatchComplete"),
                    at: Math.max(1, options.target),
                    match: "EVERY",
                    maxTimes: null,
                    revertWithCause: true,
                    actions: [
                        {
                            id: newId(),
                            kind: "ANNOUNCE",
                            message: null,
                            audience: "WORLD_DEFAULT",
                        },
                    ],
                },
            ],
        };
    }
    if (preset === "open-ended") {
        return {
            ...base,
            progress: { target: null, min: 0, max: null },
            methods: [defaultMethod("FIXED", newId, t)],
        };
    }
    return {
        ...base,
        milestones: [
            {
                id: newId(),
                label: "",
                at: options.target,
                match: "CROSS",
                maxTimes: 1,
                revertWithCause: true,
                actions: [
                    { id: newId(), kind: "COMPLETE" },
                    ...(preset === "goal-lock"
                        ? [{ id: newId(), kind: "LOCK" as const }]
                        : []),
                    {
                        id: newId(),
                        kind: "ANNOUNCE",
                        message: null,
                        audience: "WORLD_DEFAULT",
                    },
                ],
            },
        ],
    };
}

// ── Categories ───────────────────────────────────────────────────────────────

export interface CategoryGroup<T> {
    category: CategoryData | null;
    items: T[];
}

/**
 * Group items by category, in category order, with uncategorised items last.
 * Items pointing at a missing category count as uncategorised.
 */
export function groupByCategory<T extends { categoryId: Id | null }>(
    items: readonly T[],
    categories: readonly CategoryData[],
): CategoryGroup<T>[] {
    const known = new Set(categories.map((c) => c.id));
    const groups: CategoryGroup<T>[] = categories.map((category) => ({
        category,
        items: items.filter((item) => item.categoryId === category.id),
    }));
    const uncategorised = items.filter(
        (item) => item.categoryId === null || !known.has(item.categoryId),
    );
    groups.push({ category: null, items: uncategorised });
    return groups;
}

/**
 * Keep "completes at the target" milestones in step when the target changes:
 * milestones that sat exactly on the old target and complete the item move to
 * the new target. Other milestones are left alone.
 */
export function syncCompletionMilestones(
    item: TrackedItemData,
    oldTarget: number | null,
): TrackedItemData {
    const newTarget = item.progress.target;
    if (oldTarget === null || newTarget === null || oldTarget === newTarget)
        return item;
    return {
        ...item,
        milestones: item.milestones.map((milestone) =>
            milestone.at === oldTarget &&
            milestone.actions.some((action) => action.kind === "COMPLETE")
                ? { ...milestone, at: newTarget }
                : milestone,
        ),
    };
}

// ── Usage rules ──────────────────────────────────────────────────────────────

/** A usage rule that limits a method to `limit` uses per character. */
export function defaultUsageRule(limit = 3): UsageRule {
    return {
        count: { kind: "ATTEMPTS" },
        per: "ACTOR",
        tiers: [{ from: limit, kind: "DISABLE", hint: null }],
    };
}

/** A new tier of the given kind. RESULTS/EFFECT start from the method's current effect. */
export function defaultTier(
    kind: UsageTier["kind"],
    from: number,
    method: MethodData,
    newId: IdGenerator,
): UsageTier {
    switch (kind) {
        case "NORMAL":
        case "HIDE":
            return { from, kind };
        case "DISABLE":
            return { from, kind, hint: null };
        case "RESULTS": {
            const results =
                "results" in method && method.results
                    ? structuredClone(method.results)
                    : defaultResultTable(
                          "dc" in method && method.dc !== null,
                          newId,
                      );
            return { from, kind, results };
        }
        case "EFFECT":
            return {
                from,
                kind,
                effect:
                    method.kind === "FIXED"
                        ? structuredClone(method.effect)
                        : { delta: { kind: "STATIC", value: 1 } },
            };
    }
}

/** Tier kinds that make sense for a method kind. */
export function tierKindsFor(kind: MethodKind): UsageTier["kind"][] {
    if (kind === "FIXED") return ["NORMAL", "EFFECT", "DISABLE", "HIDE"];
    if (kind === "MANUAL") return ["NORMAL", "DISABLE", "HIDE"];
    return ["NORMAL", "RESULTS", "DISABLE", "HIDE"];
}

export function sortTiers(rule: UsageRule): UsageRule {
    return { ...rule, tiers: rule.tiers.toSorted((a, b) => a.from - b.from) };
}

// ── Milestones and actions ───────────────────────────────────────────────────

export function defaultMilestone(
    newId: IdGenerator,
    at: number,
): MilestoneData {
    return {
        id: newId(),
        label: "",
        at,
        match: "CROSS",
        maxTimes: 1,
        revertWithCause: true,
        actions: [],
    };
}

export const ACTION_KIND_LABELS: Record<MilestoneAction["kind"], I18nKey> = {
    COMPLETE: "downtime-dnd5e.ActionKind.COMPLETE",
    LOCK: "downtime-dnd5e.ActionKind.LOCK",
    ANNOUNCE: "downtime-dnd5e.ActionKind.ANNOUNCE",
    GRANT_ITEM: "downtime-dnd5e.ActionKind.GRANT_ITEM",
    APPLY_EFFECT: "downtime-dnd5e.ActionKind.APPLY_EFFECT",
    ADD_TRACKED_ITEM: "downtime-dnd5e.ActionKind.ADD_TRACKED_ITEM",
    ADJUST_PROGRESS: "downtime-dnd5e.ActionKind.ADJUST_PROGRESS",
    MACRO: "downtime-dnd5e.ActionKind.MACRO",
};

export function defaultAction(
    kind: MilestoneAction["kind"],
    newId: IdGenerator,
    t: Translate,
): MilestoneAction {
    const id = newId();
    switch (kind) {
        case "COMPLETE":
        case "LOCK":
            return { id, kind };
        case "ANNOUNCE":
            return { id, kind, message: null, audience: "WORLD_DEFAULT" };
        case "GRANT_ITEM":
            return {
                id,
                kind,
                sourceUuid: "",
                quantity: 1,
                recipient: { type: "TRIGGERING_ACTOR" },
            };
        case "APPLY_EFFECT":
            return {
                id,
                kind,
                sourceUuid: "",
                recipient: { type: "TRIGGERING_ACTOR" },
            };
        case "ADD_TRACKED_ITEM":
            return {
                id,
                kind,
                template: templateFrom(
                    createFromPreset(
                        "goal",
                        {
                            name: t("downtime-dnd5e.Preset.NextStep"),
                            target: 10,
                        },
                        newId,
                        t,
                    ),
                ),
                store: "SAME",
                recipient: null,
            };
        case "ADJUST_PROGRESS":
            return { id, kind, ref: { kind: "SELF" }, delta: 1 };
        case "MACRO":
            return { id, kind, macroUuid: "", undoMacroUuid: null };
    }
}

/** An ADD_TRACKED_ITEM template copied from an item (no identity or history). */
export function templateFrom(item: TrackedItemData): TrackedItemTemplate {
    const {
        id: _id,
        history: _history,
        quarantine: _quarantine,
        schemaVersion: _schemaVersion,
        ...template
    } = structuredClone(item);
    return template;
}

/**
 * Data for a fresh copy of an item in the same store: same configuration,
 * no history or progress, a new id (assigned on create). This is how a world
 * downtime becomes a personal one.
 */
export function duplicateData(item: TrackedItemData): TrackedItemTemplate {
    return { ...templateFrom(item), name: `${item.name} (copy)` };
}

export function defaultRecipient(type: Recipient["type"]): Recipient {
    switch (type) {
        case "TRIGGERING_ACTOR":
        case "OWNING_ACTOR":
            return { type };
        case "ACTOR":
            return { type, actorUuids: [], selection: "AUTO" };
        case "CONTRIBUTORS":
            return {
                type,
                filter: {
                    window: "ALL_TIME",
                    minNet: null,
                    minAttempts: 1,
                    methodIds: [],
                },
                selection: "AUTO",
            };
    }
}

// ── Drag and drop ────────────────────────────────────────────────────────────

/**
 * Move (or copy) a method to `index` in another item, or within the same
 * one. Copies get a new id; a moved method keeps its id unless the target
 * already has one. Returns the updated items (`source` is the same object as
 * `target` when moving within one item).
 */
export function moveMethod(
    source: TrackedItemData,
    target: TrackedItemData,
    methodId: Id,
    index: number,
    copy: boolean,
    newId: IdGenerator,
): { source: TrackedItemData; target: TrackedItemData } {
    const method = source.methods.find((m) => m.id === methodId);
    if (!method) return { source, target };
    const sameItem = source.id === target.id;
    const taken = new Set(target.methods.map((m) => m.id));
    const moved = structuredClone(method);
    if (copy || (!sameItem && taken.has(moved.id))) {
        do moved.id = newId();
        while (taken.has(moved.id));
    }
    const remaining = (item: TrackedItemData) =>
        copy ? item.methods : item.methods.filter((m) => m.id !== methodId);

    if (sameItem) {
        const list = [...remaining(source)];
        // `index` counts positions in the list as shown, with the method still in it.
        const from = source.methods.findIndex((m) => m.id === methodId);
        const at = !copy && from < index ? index - 1 : index;
        list.splice(Math.max(0, Math.min(at, list.length)), 0, moved);
        const updated = { ...source, methods: list };
        return { source: updated, target: updated };
    }
    const list = [...target.methods];
    list.splice(Math.max(0, Math.min(index, list.length)), 0, moved);
    return {
        source: { ...source, methods: remaining(source) },
        target: { ...target, methods: list },
    };
}

/** `order` with `itemId` moved to just before `beforeId` (null: the end). */
export function placeInOrder(
    order: readonly Id[],
    itemId: Id,
    beforeId: Id | null,
): Id[] {
    const rest = order.filter((id) => id !== itemId);
    const at = beforeId === null ? -1 : rest.indexOf(beforeId);
    if (at < 0) return [...rest, itemId];
    return [...rest.slice(0, at), itemId, ...rest.slice(at)];
}

/**
 * What the GM typed into the progress bar: `+5` / `-5` change progress by
 * that much, a plain number sets it. null when it isn't a number.
 */
export function parseProgressInput(
    text: string,
): { kind: "adjust"; delta: number } | { kind: "set"; value: number } | null {
    const trimmed = text.trim().replace(/\s+/g, "").replace("−", "-");
    if (!/^[+-]?\d+(\.\d+)?$/.test(trimmed)) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    return /^[+-]/.test(trimmed)
        ? { kind: "adjust", delta: n }
        : { kind: "set", value: n };
}

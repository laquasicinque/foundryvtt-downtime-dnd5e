/**
 * Display text for methods and history events, shared by the item row and the
 * history window.
 */
import type { AnyHistoryEvent } from "../domain/HistoryEvent";
import type { AnyMethod } from "../domain/Method";
import type { DeltaSpec, ResultTable } from "../types/data";
import { abilityLabel, skillLabel, toolLabel } from "../dnd5e/config";
import { localize } from "../foundry/i18n";
import { ACTION_LABELS, STATUS_LABELS } from "../model/views/methodCard";

export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export const METHOD_ICONS: Record<AnyMethod["kind"], string> = {
    ABILITY: "fa-dice-d20",
    SKILL: "fa-dice-d20",
    TOOL: "fa-hammer",
    FIXED: "fa-plus",
    MANUAL: "fa-keyboard",
    MACRO: "fa-code",
};

function describeDelta(delta: DeltaSpec): string {
    if (delta.kind === "STATIC") return signed(delta.value);
    return delta.formula.trim() === "@total"
        ? localize("downtime-dnd5e.Describe.PlusRollTotal")
        : delta.formula;
}

/** "+1 on a pass", "+3 on a 20 · +1 on a pass", "+roll total" … */
function describeResults(results: ResultTable): string {
    const parts = results.bands
        .filter(
            (band) =>
                !(
                    band.effect.delta.kind === "STATIC" &&
                    band.effect.delta.value === 0
                ),
        )
        .map((band) =>
            band.label
                ? `${describeDelta(band.effect.delta)} ${band.label}`
                : describeDelta(band.effect.delta),
        );
    return [...new Set(parts)].slice(0, 3).join(" / ");
}

/** One-line "what this does" for a method card. */
export function methodSummary(method: AnyMethod): string {
    /** "Athletics · DC 12 · +1 / +2 Great" */
    const check = (what: string, dc: number | null, results: ResultTable) =>
        [
            what,
            dc === null ? null : localize("downtime-dnd5e.Describe.DC", { dc }),
            describeResults(results),
        ]
            .filter((part) => part)
            .join(" · ");
    switch (method.kind) {
        case "ABILITY":
            return check(
                localize("downtime-dnd5e.Describe.AbilityCheck", {
                    ability: abilityLabel(method.ability),
                }),
                method.dc,
                method.results,
            );
        case "SKILL":
            return check(skillLabel(method.skill), method.dc, method.results);
        case "TOOL": {
            const tool = method.tool
                ? toolLabel(method.tool)
                : localize("downtime-dnd5e.Describe.NoTool");
            const what = method.fallback
                ? localize("downtime-dnd5e.Describe.ToolOr", {
                      tool,
                      fallback:
                          method.fallback.kind === "SKILL"
                              ? skillLabel(method.fallback.skill)
                              : abilityLabel(method.fallback.ability),
                  })
                : tool;
            return check(what, method.dc, method.results);
        }
        case "FIXED":
            return localize("downtime-dnd5e.Describe.EachTime", {
                delta: describeDelta(method.effect.delta),
            });
        case "MANUAL":
            return localize(
                method.gmOnly
                    ? "downtime-dnd5e.Describe.GmEntersAmount"
                    : "downtime-dnd5e.Describe.EnterAmount",
            );
        case "MACRO":
            return method.macroName
                ? localize("downtime-dnd5e.Describe.RunsMacro", {
                      macro: method.macroName,
                  })
                : localize("downtime-dnd5e.Describe.RunsAMacro");
    }
}

/** What happened, for history lists. */
export function describeEvent(event: AnyHistoryEvent): string {
    const data = event.data;
    switch (data.kind) {
        case "METHOD": {
            // Fixed methods record their own name as the result label; don't repeat it.
            const label = data.band?.label;
            const band =
                label && label !== data.method.name ? ` (${label})` : "";
            const roll = data.roll
                ? ` — ${localize(
                      data.roll.dc !== null
                          ? "downtime-dnd5e.Describe.RolledVsDC"
                          : "downtime-dnd5e.Describe.Rolled",
                      { total: data.roll.total, dc: data.roll.dc ?? "" },
                  )}`
                : "";
            return `${data.method.name}${band}${roll}`;
        }
        case "ADJUST":
            return localize("downtime-dnd5e.Describe.Adjusted");
        case "LEGACY":
            return (
                data.actionName || localize("downtime-dnd5e.Describe.FromV1")
            );
        case "SET":
            return localize(
                data.reason === "MIGRATION"
                    ? "downtime-dnd5e.Describe.SetMigration"
                    : "downtime-dnd5e.Describe.Set",
                { value: data.value },
            );
        case "MILESTONE": {
            const milestone = event.item.milestone(data.milestoneId);
            const actions = data.actions.map((a) =>
                a.status === "APPLIED"
                    ? localize(ACTION_LABELS[a.kind])
                    : localize("downtime-dnd5e.Describe.ActionStatus", {
                          action: localize(ACTION_LABELS[a.kind]),
                          status: localize(STATUS_LABELS[a.status]),
                      }),
            );
            return localize(
                milestone?.label
                    ? "downtime-dnd5e.Describe.MilestoneNamed"
                    : "downtime-dnd5e.Describe.Milestone",
                {
                    milestone: milestone?.label ?? "",
                    at: milestone?.at ?? "?",
                    actions: actions.join(", "),
                },
            );
        }
        case "APPROVAL":
            return localize(
                data.approved
                    ? "downtime-dnd5e.Describe.Approved"
                    : "downtime-dnd5e.Describe.Rejected",
                { action: localize(ACTION_LABELS[data.result.kind]) },
            );
        case "STATE":
            return [
                data.locked !== undefined
                    ? localize(
                          data.locked
                              ? "downtime-dnd5e.Describe.Locked"
                              : "downtime-dnd5e.Describe.Unlocked",
                      )
                    : null,
                data.completed !== undefined
                    ? localize(
                          data.completed
                              ? "downtime-dnd5e.Describe.MarkedComplete"
                              : "downtime-dnd5e.Describe.MarkedIncomplete",
                      )
                    : null,
            ]
                .filter(Boolean)
                .join(", ");
        case "REVERT":
            return localize("downtime-dnd5e.Describe.Reverted");
    }
}

/** Progress change for history lists ("" for events without one). */
export function eventDelta(event: AnyHistoryEvent): string {
    const data = event.data;
    if (
        data.kind === "METHOD" ||
        data.kind === "ADJUST" ||
        data.kind === "LEGACY"
    ) {
        const clamped =
            data.progress.requested !== data.progress.applied
                ? ` ${localize("downtime-dnd5e.Card.OfRequested", { requested: signed(data.progress.requested) })}`
                : "";
        return `${signed(data.progress.applied)}${clamped} → ${data.progress.after}`;
    }
    if (data.kind === "SET") return `→ ${data.value}`;
    return "";
}

export function formatDate(timestamp: number | null): string {
    return timestamp === null
        ? localize("downtime-dnd5e.Describe.DateUnknown")
        : new Date(timestamp).toLocaleString();
}

/**
 * Item-level requirement state for display. MACRO requirements can only be
 * checked on use, so they never hide or disable anything here.
 */
export function itemAccess(
    item: import("../domain/TrackedItem").TrackedItem,
    actingActorUuid: string,
): {
    state: "AVAILABLE" | "HIDE" | "DISABLE" | "DISABLE_WITH_HINT";
    hints: string[];
    /** Every unmet requirement, described (for GMs). */
    descriptions?: string[];
} {
    const availability = item.availability(actingActorUuid);
    if (availability.state === "AVAILABLE")
        return { state: "AVAILABLE", hints: [] };
    const unmet = availability.unmet.filter(
        (u) => u.reason !== "MACRO_NOT_EVALUATED",
    );
    if (unmet.length === 0) return { state: "AVAILABLE", hints: [] };
    return {
        state: availability.state,
        hints: availability.hints,
        descriptions: unmet.map((u) => item.describeRequirement(u.requirement)),
    };
}

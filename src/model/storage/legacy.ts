/**
 * V1-shaped projection of a V3 item, for the deprecated V1 getters
 *. Read-only: built from derived state, never stored.
 */
import { deriveState, revertedEventIds } from "../rules/derive";
import type { TrackedItemData } from "../../types/data";
import { isProgressEvent } from "../rules/events";

/** The V1 `TrackedItem` fields old macros read. */
export interface LegacyTrackedItemView {
    id: string;
    name: string;
    img: string;
    /** Category id ("" when uncategorised). */
    category: string;
    hidden: boolean;
    description: string;
    progressionStyle: "ABILITY" | "SKILL" | "TOOL" | "FIXED" | "MACRO";
    ability?: string;
    skill?: string;
    /** V3 stores the dnd5e tool key, where V1 stored the tool item's id. */
    tool?: string;
    fixedIncrease?: number;
    macroName?: string;
    dc?: number;
    progress: number;
    completionAt: number;
    changes: {
        id: string;
        timestamp: string;
        actionName: string;
        valueChanged: "progress";
        oldValue: number;
        newValue: number;
        dismissed: boolean;
        user: string;
        note: string;
    }[];
    schemaVersion: 1;
}

/** V1 projection. V1 items had one method: the first one is used. */
export function toV1(item: TrackedItemData): LegacyTrackedItemView {
    const state = deriveState(item);
    const method = item.methods[0];
    const style: Pick<
        LegacyTrackedItemView,
        | "progressionStyle"
        | "ability"
        | "skill"
        | "tool"
        | "fixedIncrease"
        | "macroName"
        | "dc"
    > = (() => {
        switch (method?.kind) {
            case "ABILITY":
                return {
                    progressionStyle: "ABILITY",
                    ability: method.ability,
                    dc: method.dc ?? undefined,
                };
            case "SKILL":
                return {
                    progressionStyle: "SKILL",
                    skill: method.skill,
                    dc: method.dc ?? undefined,
                };
            case "TOOL":
                return {
                    progressionStyle: "TOOL",
                    tool: method.tool,
                    dc: method.dc ?? undefined,
                };
            case "MACRO":
                return {
                    progressionStyle: "MACRO",
                    macroName: method.macroName ?? undefined,
                };
            case "FIXED":
                return {
                    progressionStyle: "FIXED",
                    fixedIncrease:
                        method.effect.delta.kind === "STATIC"
                            ? method.effect.delta.value
                            : undefined,
                };
            default:
                return { progressionStyle: "FIXED" };
        }
    })();
    const reverted = revertedEventIds(item.history);
    const changes = item.history
        .filter((e) => !reverted.has(e.id))
        .flatMap((e) => {
            const base = {
                id: e.id,
                timestamp:
                    e.timestamp === null
                        ? ""
                        : new Date(e.timestamp).toISOString(),
                valueChanged: "progress" as const,
                dismissed: e.dismissed,
                user: e.contributor.userName ?? e.contributor.actorName ?? "",
                note: e.note ?? "",
            };
            if (e.kind === "SET")
                return [
                    {
                        ...base,
                        actionName: "Set",
                        oldValue: e.before,
                        newValue: e.value,
                    },
                ];
            if (!isProgressEvent(e)) return [];
            const actionName =
                e.kind === "METHOD"
                    ? e.method.name
                    : e.kind === "LEGACY"
                      ? e.actionName
                      : "Adjust Progress";
            return [
                {
                    ...base,
                    actionName,
                    oldValue: e.progress.before,
                    newValue: e.progress.after,
                },
            ];
        });
    return {
        id: item.id,
        name: item.name,
        img: item.img,
        category: item.categoryId ?? "",
        hidden: item.hidden,
        description: item.description,
        ...style,
        progress: state.value,
        completionAt: item.progress.target ?? 0,
        changes,
        schemaVersion: 1,
    };
}

/**
 * Client-side method use: requirements → roll / prompt / macro on this client
 * → `method.use()`, which the GM validates and applies.
 */
import { DowntimeError } from "../domain/DowntimeError";
import type { AnyMethod, MacroMethod, ToolMethod } from "../domain/Method";
import type { TrackedItem } from "../domain/TrackedItem";
import type { ClientRoll, MacroMethodResult } from "../types/commands";
import { toClientRoll } from "../model/rules/rolls";
import type { Id, RollSummary, ToolFallback } from "../types/data";
import type { RollLike, RollMessageConfig } from "../types/rolls";
import { Logger } from "../foundry/Logger";
import { activityRollOptions } from "../dnd5e/activityAdapters";
import { toolActivities, toolItems } from "../dnd5e/actors";
import {
    abilityLabel,
    isAbilityKey,
    isSkillKey,
    skillLabel,
    toolLabel,
} from "../dnd5e/config";
import {
    captureRollMessage,
    rollAbilityCheck,
    rollSkillCheck,
    rollToolItemCheck,
} from "../dnd5e/rolls";
import { type Actor, actorFromUuid } from "../foundry/actors";
import { createChatMessage, defaultMessageMode } from "../foundry/chat";
import { pickOne, promptNumber } from "../foundry/dialogs";
import { callHook } from "../foundry/hooks";
import { localize } from "../foundry/i18n";
import { executeMacro, findMacro } from "../foundry/macros";
import { notifyWarn } from "../foundry/notifications";
import { currentUser, isGM } from "../foundry/users";
import { chatPresenter, type MethodUseResult } from "./chatPresenter";

/**
 * `downtime-dnd5e.methodUsed` (item, event): fired on the client that used a
 * method, with the updated item and the METHOD event it recorded.
 */
export function announceMethodUsed(item: TrackedItem, eventId: Id) {
    const event = item.event(eventId);
    if (!event) return;
    callHook("downtime-dnd5e.methodUsed", item, event);
}

async function postCard(result: MethodUseResult) {
    try {
        const ref = {
            store: result.item.store,
            itemId: result.item.id,
            eventId: result.eventId,
        };
        await createChatMessage(
            await chatPresenter().methodUseMessage(result, ref),
        );
    } catch (error) {
        Logger.error("Couldn't post the downtime chat card", false, error);
    }
}

async function rollCheck(
    roll: () => Promise<RollLike[] | null | undefined>,
    rolled: RollSummary["rolled"],
    activityDc: number | null = null,
): Promise<ClientRoll | null> {
    const [first] = (await roll()) ?? [];
    return first
        ? toClientRoll(first, rolled, activityDc, defaultMessageMode())
        : null;
}

function rollAbility(actor: Actor, ability: string, dc: number | null) {
    if (!isAbilityKey(ability))
        throw new DowntimeError(
            "INVALID",
            localize("downtime-dnd5e.Use.UnknownAbility", { ability }),
        );
    return rollCheck(() => rollAbilityCheck(actor, ability, dc), {
        kind: "ABILITY",
        key: ability,
        label: abilityLabel(ability),
    });
}

function rollSkill(actor: Actor, skill: string, dc: number | null) {
    if (!isSkillKey(skill))
        throw new DowntimeError(
            "INVALID",
            localize("downtime-dnd5e.Use.UnknownSkill", { skill }),
        );
    return rollCheck(() => rollSkillCheck(actor, skill, dc), {
        kind: "SKILL",
        key: skill,
        label: skillLabel(skill),
    });
}

function rollFallback(actor: Actor, fallback: ToolFallback, dc: number | null) {
    return fallback.kind === "SKILL"
        ? rollSkill(actor, fallback.skill, dc)
        : rollAbility(actor, fallback.ability, dc);
}

/**
 * Tool resolution: matching tools → pick tool → its rollable
 * activities → pick; the plain tool check only when it has none; the
 * fallback only when the actor has no matching tool.
 */
async function rollTool(
    actor: Actor,
    method: ToolMethod,
): Promise<ClientRoll | null> {
    const tools = toolItems(actor, method.tool);
    if (tools.length === 0) {
        if (method.fallback)
            return rollFallback(actor, method.fallback, method.dc);
        throw new DowntimeError(
            "UNAVAILABLE",
            localize("downtime-dnd5e.Use.NeedsTool", {
                actor: actor.name ?? "",
                tool: toolLabel(method.tool),
            }),
        );
    }
    const tool = await pickOne(
        localize("downtime-dnd5e.Use.WhichTool"),
        tools.map((t) => ({ label: t.name ?? "", value: t })),
    );
    if (!tool) return null;

    const options = toolActivities(tool).flatMap((activity) =>
        activityRollOptions(activity, actor).map((option) => ({
            label:
                activity.name === option.label
                    ? option.label
                    : `${activity.name}: ${option.label}`,
            value: option,
        })),
    );
    if (options.length === 0) {
        return rollCheck(() => rollToolItemCheck(tool, method.dc), {
            kind: "TOOL",
            key: method.tool,
            label: toolLabel(method.tool),
            ...(tool.name && { toolItemName: tool.name }),
        });
    }
    const option = await pickOne(
        localize("downtime-dnd5e.Use.RollWith", { tool: tool.name ?? "" }),
        options,
    );
    if (!option) return null;
    const result = await option.roll();
    if (!result) return null;
    return toClientRoll(
        result.roll,
        {
            ...result.rolled,
            toolItemName: result.rolled.toolItemName ?? tool.name ?? undefined,
        },
        result.dc,
        defaultMessageMode(),
    );
}

/**
 * The `downtime` object handed to method and requirement macros (see
 * docs/API.md): plain copies of the data, the derived state, who's acting.
 */
function macroContext(method: AnyMethod, actor: Actor | null) {
    return {
        item: method.item.toJSON(),
        state: structuredClone(method.item.state),
        method: method.toJSON(),
        actor: actor ?? null,
        user: currentUser(),
    };
}

/** Run a MACRO method on this client and interpret its return value. */
async function runMacroMethod(
    method: MacroMethod,
    actor: Actor | null,
): Promise<MacroMethodResult | null | "NO_CHANGE"> {
    const macro = await findMacro(method.macroUuid, method.macroName);
    if (!macro)
        throw new DowntimeError(
            "NOT_FOUND",
            localize("downtime-dnd5e.Effect.MacroNotFound", {
                uuid: method.macroName ?? method.macroUuid ?? "",
            }),
        );
    const result = await executeMacro(macro, {
        actor: actor ?? undefined,
        downtime: macroContext(method, actor),
    });

    if (result === undefined || result === null) return "NO_CHANGE";
    if (typeof result === "number") return { delta: result };
    if (typeof result === "object") {
        const value = result as { delta?: unknown; roll?: unknown };
        if (typeof value.delta === "number") return { delta: value.delta };
        if (value.roll && typeof value.roll === "object") {
            return {
                roll: toClientRoll(
                    value.roll as RollLike,
                    { kind: "CUSTOM", key: method.id, label: method.name },
                    null,
                    defaultMessageMode(),
                ),
            };
        }
    }
    throw new DowntimeError(
        "INVALID",
        localize("downtime-dnd5e.Use.MacroResult"),
    );
}

/** MACRO requirements run on the client; the GM trusts their result. */
async function evaluateMacroRequirements(
    method: AnyMethod,
    actor: Actor | null,
): Promise<Record<Id, boolean>> {
    const results: Record<Id, boolean> = {};
    for (const requirement of [
        ...method.item.requirements,
        ...method.requirements,
    ]) {
        if (requirement.test.kind !== "MACRO") continue;
        try {
            const macro = await findMacro(requirement.test.macroUuid, null);
            const value = macro
                ? await executeMacro(macro, {
                      actor: actor ?? undefined,
                      downtime: { ...macroContext(method, actor), requirement },
                  })
                : undefined;
            results[requirement.id] = !!value;
        } catch {
            results[requirement.id] = false;
        }
    }
    return results;
}

/**
 * Use a method interactively. `actorUuid` is the acting actor (ignored for
 * actor-stored items). Resolves to the updated item, or null if cancelled /
 * nothing changed. Failures are shown as notifications, not thrown.
 */
export async function useMethodInteractive(
    method: AnyMethod,
    actorUuid: string | null,
): Promise<TrackedItem | null> {
    const store = method.item.store;
    const actingUuid = store.kind === "ACTOR" ? store.actorUuid : actorUuid;
    const actor = actingUuid ? await actorFromUuid(actingUuid) : null;

    try {
        const macroRequirements = await evaluateMacroRequirements(
            method,
            actor,
        );
        const availability = method.availability(actingUuid, macroRequirements);
        if (availability.state !== "AVAILABLE" && !isGM()) {
            const hint =
                availability.hints[0] ??
                localize("downtime-dnd5e.Use.Unavailable");
            notifyWarn(hint);
            return null;
        }

        const needsActor = ["ABILITY", "SKILL", "TOOL"].includes(method.kind);
        if (needsActor && !actor)
            throw new DowntimeError(
                "INVALID",
                localize("downtime-dnd5e.Use.ChooseCharacter"),
            );

        let roll: ClientRoll | null = null;
        let rollMessage: RollMessageConfig | null = null;
        let amount: number | undefined;
        let macroResult: MacroMethodResult | undefined;

        if (needsActor) {
            const captured = await captureRollMessage(() => {
                switch (method.kind) {
                    case "ABILITY":
                        return rollAbility(actor!, method.ability, method.dc);
                    case "SKILL":
                        return rollSkill(actor!, method.skill, method.dc);
                    default:
                        return rollTool(actor!, method as ToolMethod);
                }
            });
            roll = captured.value;
            if (!roll) return null;
            rollMessage = captured.message;
            // The roll dialog's mode, and no message of its own (the card carries it).
            if (rollMessage?.rollMode) roll.rollMode = rollMessage.rollMode;
            if (rollMessage?.data) roll.messageId = null;
        }

        switch (method.kind) {
            case "ABILITY":
            case "SKILL":
            case "TOOL":
                break;
            case "FIXED":
                break;
            case "MANUAL": {
                const value = await promptNumber(
                    method.name,
                    localize("downtime-dnd5e.Use.Amount"),
                );
                if (value === null) return null;
                amount = value;
                break;
            }
            case "MACRO": {
                const result = await runMacroMethod(method, actor);
                if (result === "NO_CHANGE" || result === null) return null;
                macroResult = result;
                break;
            }
        }

        const { item, eventId } = await method.useWithEvent({
            actor: actingUuid,
            ...(roll && { roll }),
            ...(amount !== undefined && { amount }),
            ...(macroResult && { macroResult }),
            macroRequirements,
        });
        if (eventId) announceMethodUsed(item, eventId);
        if (eventId)
            await postCard({
                item,
                eventId,
                actorUuid: actingUuid,
                rollMessage: rollMessage?.data ?? null,
            });
        return item;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        notifyWarn(
            localize("downtime-dnd5e.Notify.ItemError", {
                item: method.item.name,
                error: message,
            }),
        );
        return null;
    }
}

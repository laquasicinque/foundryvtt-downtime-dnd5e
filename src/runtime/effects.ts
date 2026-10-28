/**
 * Foundry side effects of milestone actions and reverts. Run on the GM.
 */
import type { ActionEffects, ActionExecutionContext } from "../types/commands";
import { actorFromUuid, hasPlayerOwner } from "../foundry/actors";
import { createChatMessage, gmUserIds, speakerFor } from "../foundry/chat";
import {
    createEmbedded,
    deleteByUuids,
    documentData,
} from "../foundry/documents";
import { localize } from "../foundry/i18n";
import { executeMacro, findMacro } from "../foundry/macros";
import { getSetting } from "../foundry/settings";
import { currentUser } from "../foundry/users";
import { escapeHTML as escape, setProperty } from "../foundry/utils";
import { CommandError, localized } from "../model/commands/CommandError";
import { deriveState } from "../model/rules/derive";

async function sourceDocument(uuid: string) {
    const source = await documentData(uuid);
    // Kept as keys: the result is stored in history and read in each viewer's language.
    if (!source)
        throw new CommandError(
            "FAILED",
            localized("downtime-dnd5e.Effect.SourceNotFound", { uuid }),
        );
    return source;
}

async function requireActor(uuid: string) {
    const actor = await actorFromUuid(uuid);
    if (!actor)
        throw new CommandError(
            "FAILED",
            localized("downtime-dnd5e.Effect.ActorNotFound", { uuid }),
        );
    return actor;
}

/** Unknown actors count as player-owned (announced to everyone). */
async function isPlayerOwned(actorUuid: string): Promise<boolean> {
    const actor = await actorFromUuid(actorUuid);
    return actor ? hasPlayerOwner(actor) : true;
}

async function whisperFor(
    audience: "WORLD_DEFAULT" | "PUBLIC" | "GM",
    ctx: ActionExecutionContext,
): Promise<string[] | null | false> {
    if (audience === "GM" || getSetting("gmOnlyMode")) return gmUserIds();
    if (audience === "PUBLIC") return null;

    // WORLD_DEFAULT: the V1 `announceCompletionFor` rule, by the acting actor.
    const actorUuid =
        ctx.triggeringActorUuid ??
        (ctx.store.kind === "ACTOR" ? ctx.store.actorUuid : null);
    const isPc = actorUuid ? await isPlayerOwned(actorUuid) : true;
    switch (getSetting("announceCompletionFor")) {
        case "none":
            return false;
        case "pc":
            return isPc ? null : false;
        case "npc":
            return isPc ? false : null;
        default:
            return null;
    }
}

export const foundryEffects: ActionEffects = {
    async grantItem(sourceUuid, quantity, actorUuid) {
        const actor = await requireActor(actorUuid);
        const source = await sourceDocument(sourceUuid);
        if (source.documentName !== "Item")
            throw new CommandError(
                "FAILED",
                localized("downtime-dnd5e.Effect.NotAnItem", {
                    uuid: sourceUuid,
                }),
            );
        const { data } = source;
        delete data._id;
        const system = data.system as { quantity?: number } | undefined;
        if (quantity > 1 && typeof system?.quantity === "number")
            system.quantity = quantity;
        setProperty(data, "_stats.compendiumSource", sourceUuid);
        return createEmbedded(actor, "Item", [data]);
    },

    async applyEffect(sourceUuid, actorUuid) {
        const actor = await requireActor(actorUuid);
        const source = await sourceDocument(sourceUuid);
        if (source.documentName !== "ActiveEffect")
            throw new CommandError(
                "FAILED",
                localized("downtime-dnd5e.Effect.NotAnEffect", {
                    uuid: sourceUuid,
                }),
            );
        const { data } = source;
        delete data._id;
        data.origin = sourceUuid;
        return createEmbedded(actor, "ActiveEffect", [data]);
    },

    async announce(message, audience, ctx) {
        const whisper = await whisperFor(audience, ctx);
        if (whisper === false) return;
        const actorUuid =
            ctx.triggeringActorUuid ??
            (ctx.store.kind === "ACTOR" ? ctx.store.actorUuid : null);
        const actor = actorUuid ? await actorFromUuid(actorUuid) : null;
        const milestone = ctx.item.milestones.find(
            (m) => m.id === ctx.milestoneId,
        );
        const vars = {
            actor: actor?.name ?? "",
            item: ctx.item.name,
            milestone: milestone?.label ?? "",
        };
        const text =
            message ??
            (milestone?.label
                ? localize("downtime-dnd5e.V3.MilestoneReached", vars)
                : localize("downtime-dnd5e.V3.ItemCompleted", vars));
        // Mirrors the V1 completion card.
        const content = `<div class="dnd5e chat-card item-card">
  <header class="card-header flexrow"><h3 class="item-name">${escape(ctx.item.name)}</h3></header>
  <div class="card-content">${escape(text)}</div>
</div>`;
        await createChatMessage({
            content,
            speaker: actor ? speakerFor(actor) : undefined,
            ...(whisper && { whisper }),
        });
    },

    async runMacro(macroUuid, ctx) {
        const macro = await findMacro(macroUuid);
        if (!macro)
            throw new CommandError(
                "FAILED",
                localized("downtime-dnd5e.Effect.MacroNotFound", {
                    uuid: macroUuid,
                }),
            );
        const actorUuid =
            ctx.triggeringActorUuid ??
            (ctx.store.kind === "ACTOR" ? ctx.store.actorUuid : null);
        const actor = actorUuid ? await actorFromUuid(actorUuid) : null;
        const scope: Record<string, unknown> = {
            actor: actor ?? undefined,
            downtime: {
                item: structuredClone(ctx.item),
                state: deriveState(ctx.item),
                store: structuredClone(ctx.store),
                milestoneId: ctx.milestoneId,
                milestone: structuredClone(
                    ctx.item.milestones.find((m) => m.id === ctx.milestoneId) ??
                        null,
                ),
                action: structuredClone(ctx.action),
                actor,
                user: currentUser(),
                undo: ctx.undo,
            },
        };
        await executeMacro(macro, scope);
    },

    async deleteDocuments(uuids) {
        await deleteByUuids(uuids);
    },
};

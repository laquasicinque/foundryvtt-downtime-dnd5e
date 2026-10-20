/**
 * GM relay: clients send commands to the active GM over
 * `CONFIG.queries`; the GM runs them one at a time.
 *
 * The sender's identity comes from the query context (verified by Foundry),
 * never from the payload.
 */
import { CONSTANTS } from "../constants";
import { executeCommand } from "../model/commands/execute";
import type { Command, CommandEnv, CommandResult } from "../types/commands";
import { SerialQueue } from "../lib/SerialQueue";
import { evaluateFormula } from "../foundry/dice";
import { localize } from "../foundry/i18n";
import { registerQuery, sendQuery } from "../foundry/queries";
import { getSetting } from "../foundry/settings";
import { activeGM, currentUser, isActiveGM, type User } from "../foundry/users";
import { randomId } from "../foundry/utils";
import { foundryActors } from "./actors";
import { foundryEffects } from "./effects";
import { foundryStores } from "./stores";

const QUERY = CONSTANTS.QUERIES.command;
const QUERY_TIMEOUT_MS = 30_000;

/** One queue for every command on this client (see SerialQueue for why one). */
const queue = new SerialQueue();

function commandEnv(): CommandEnv {
    return {
        stores: foundryStores,
        effects: foundryEffects,
        actors: foundryActors,
        evaluateFormula: (formula, data) =>
            evaluateFormula(formula, data as Record<string, unknown>),
        approvalDefault: () =>
            getSetting(CONSTANTS.SETTINGS.milestoneApprovalDefault),
        now: () => Date.now(),
        randomId,
        t: localize,
    };
}

function execute(command: unknown, user: User): Promise<CommandResult> {
    return queue.run(() =>
        executeCommand(
            command,
            { id: user.id, name: user.name, isGM: user.isGM },
            commandEnv(),
        ),
    );
}

export function registerQueries() {
    registerQuery(QUERY, async (data, sender) => {
        if (!isActiveGM())
            throw new Error(localize("downtime-dnd5e.Relay.NotActiveGM"));
        return execute(data, sender);
    });
}

/**
 * Send a command. Runs locally on the active GM. Without a GM online, a
 * player may still use methods on an actor they own (the executor applies
 * the same rules, so gated milestone actions just wait for approval).
 */
export async function dispatch(command: Command): Promise<CommandResult> {
    if (isActiveGM()) return execute(command, currentUser());

    const gm = activeGM();
    if (!gm) {
        const ownActorUse =
            command.type === "USE_METHOD" &&
            command.store.kind === "ACTOR" &&
            foundryActors.isOwner(command.store.actorUuid, currentUser().id);
        if (ownActorUse) return execute(command, currentUser());
        return {
            ok: false,
            error: {
                code: "NO_GM",
                message: localize("downtime-dnd5e.V3.NoGM"),
            },
        };
    }

    try {
        return await sendQuery<CommandResult>(
            gm,
            QUERY,
            command,
            QUERY_TIMEOUT_MS,
        );
    } catch (error) {
        return {
            ok: false,
            error: {
                code: "FAILED",
                message: error instanceof Error ? error.message : String(error),
            },
        };
    }
}

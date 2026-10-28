import type {
    ActionEffects,
    CommandEnv,
    CommandUser,
} from "../../types/commands";
import type { ActorView } from "../../types/actors";
import { t } from "./i18n";
import { counterIds } from "./fixtures";
import type { MemoryBackend } from "./MemoryBackend";

export interface FakeActor {
    name: string;
    owners: string[];
    view?: ActorView;
}

export function memoryEnv(
    backend: MemoryBackend,
    actors: Record<string, FakeActor> = {},
) {
    const calls: { kind: string; args: unknown[] }[] = [];
    let created = 0;
    const record = (kind: string, ...args: unknown[]) =>
        calls.push({ kind, args });

    const effects: ActionEffects = {
        grantItem: async (sourceUuid, quantity, actorUuid) => {
            record("grantItem", sourceUuid, quantity, actorUuid);
            return [`${actorUuid}.Item.granted${++created}`];
        },
        applyEffect: async (sourceUuid, actorUuid) => {
            record("applyEffect", sourceUuid, actorUuid);
            return [`${actorUuid}.ActiveEffect.applied${++created}`];
        },
        announce: async (message, audience) =>
            void record("announce", message, audience),
        runMacro: async (uuid, ctx) => void record("runMacro", uuid, ctx.undo),
        deleteDocuments: async (uuids) => void record("deleteDocuments", uuids),
    };

    const env: CommandEnv & { calls: typeof calls; approval: "AUTO" | "GM" } = {
        calls,
        approval: "AUTO",
        stores: backend,
        effects,
        actors: {
            exists: async (uuid) => uuid in actors,
            name: async (uuid) => actors[uuid]?.name ?? null,
            isOwner: async (uuid, userId) =>
                actors[uuid]?.owners.includes(userId) ?? false,
            view: async (uuid) => actors[uuid]?.view ?? null,
            rollData: async () => ({}),
        },
        // Tiny evaluator for tests: @vars, numbers, + - * / ( ) and floor().
        evaluateFormula: (formula, data) =>
            evaluateArithmetic(
                formula.replace(/@(\w+)/g, (_m, name: string) => {
                    const value = data[name];
                    return typeof value === "number" ? String(value) : "0";
                }),
            ),
        approvalDefault: () => env.approval,
        now: () => 5_000,
        randomId: counterIds("id"),
        t,
    };
    return env;
}

export const player: CommandUser = {
    id: "user-a",
    name: "Player A",
    isGM: false,
};
export const otherPlayer: CommandUser = {
    id: "user-b",
    name: "Player B",
    isGM: false,
};
export const gmUser: CommandUser = {
    id: "user-gm",
    name: "Gamemaster",
    isGM: true,
};

/** Recursive-descent arithmetic: + - * / ( ) floor(). Test-only. */
function evaluateArithmetic(source: string): number {
    const tokens = source.match(/floor|\d+(?:\.\d+)?|[-+*/()]/g) ?? [];
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];
    const factor = (): number => {
        const token = next();
        if (token === "-") return -factor();
        if (token === "(") {
            const value = sum();
            next();
            return value;
        }
        if (token === "floor") {
            next();
            const value = sum();
            next();
            return Math.floor(value);
        }
        return Number(token);
    };
    const product = (): number => {
        let value = factor();
        while (peek() === "*" || peek() === "/")
            value = next() === "*" ? value * factor() : value / factor();
        return value;
    };
    const sum = (): number => {
        let value = product();
        while (peek() === "+" || peek() === "-")
            value = next() === "+" ? value + product() : value - product();
        return value;
    };
    return sum();
}

/**
 * GM-side command execution. Validates every command against the
 * verified sender, applies it through a UnitOfWork, runs milestone actions,
 * and commits. Pure apart from the injected environment.
 */
import {
    effectiveDc,
    evaluateEffect,
    formulaData,
    resolveBand,
    type BandRoll,
} from "../rules/bands";
import { eligibleContributors } from "../rules/contributions";
import {
    actionResults,
    deriveState,
    effectiveEvents,
    nextSeq,
    type TrackedItemState,
} from "../rules/derive";
import { actionRecipient, detectMilestones } from "../rules/milestones";
import { parseCategory, parseTrackedItem } from "../storage/normalize/item";
import { clampProgress, computeDelta } from "../rules/progress";
import { evaluateRequirements } from "../rules/requirements";
import { moveMethod } from "../authoring/editing";
import { planImport } from "../storage/exchange";
import { planTransfer } from "../storage/transfer";
import {
    canRevert,
    hasOwnHistory,
    latestProgressEvent,
    planRevert,
    revertEventFor,
} from "../rules/revert";
import type { RevertContext } from "../../types/revert";
import { itemConfig } from "../storage/storage";
import type {
    AdjustEventData,
    ApprovalEventData,
    BandSnapshot,
    CategoryData,
    Contributor,
    Id,
    ItemLocation,
    ItemRef,
    MethodData,
    MilestoneAction,
    MilestoneActionResult,
    MilestoneData,
    MilestoneEventData,
    ProgressEventData,
    Recipient,
    ResultTable,
    RevertEventData,
    RollSummary,
    StateEventData,
    StoreRef,
    TrackedItemData,
    TrackedItemTemplate,
    UsageTier,
} from "../../types/data";
import { SCHEMA_VERSION } from "../storage/schema";
import { storeKey, WORLD_STORE } from "../storage/stores";
import { currentTier } from "../rules/usage";
import { CommandError, errorText, localized } from "./CommandError";
import type {
    ActionExecutionContext,
    ClientRoll,
    Command,
    ImportItemsCommand,
    MoveMethodCommand,
    ResolveApprovalCommand,
    TransferCommand,
    UseMethodCommand,
    CommandEnv,
    CommandResult,
    CommandUser,
} from "../../types/commands";
import { eventBase, UnitOfWork } from "./UnitOfWork";
import { parseCommand } from "./parse";

/** Maximum depth of ADJUST_PROGRESS chains (item A → B → C …). */
export const MAX_CHAIN_DEPTH = 5;

/** Actions that change internal state or post a message: never gated by approval. */
const UNGATED_ACTIONS = new Set<MilestoneAction["kind"]>([
    "COMPLETE",
    "LOCK",
    "ANNOUNCE",
]);

interface Run {
    env: CommandEnv;
    user: CommandUser;
    uow: UnitOfWork;
}

/** Items visited by the current chain, to stop ADJUST_PROGRESS loops. */
type Chain = ReadonlySet<string>;

const locKey = (loc: ItemLocation) => `${storeKey(loc.store)}/${loc.itemId}`;

export async function executeCommand(
    raw: unknown,
    user: CommandUser,
    env: CommandEnv,
): Promise<CommandResult> {
    const run: Run = { env, user, uow: new UnitOfWork(env.stores) };
    try {
        const command = parseCommand(raw);
        const outcome = await dispatch(run, command);
        await run.uow.commit();
        return {
            ok: true,
            changed: run.uow.changed(),
            eventIds: outcome.eventIds,
            ...(outcome.itemId && { itemId: outcome.itemId }),
            ...(outcome.transferred && { transferred: outcome.transferred }),
            ...(outcome.imported !== undefined && {
                imported: outcome.imported,
            }),
        };
    } catch (error) {
        if (error instanceof CommandError) {
            return {
                ok: false,
                error: {
                    code: error.code,
                    message: error.text,
                    ...(error.details !== undefined && {
                        details: error.details,
                    }),
                },
            };
        }
        return {
            ok: false,
            error: { code: "FAILED", message: errorText(error) },
        };
    }
}

interface Outcome {
    eventIds: Id[];
    itemId?: Id;
    transferred?: Record<Id, Id>;
    imported?: number;
}

function requireGM(run: Run) {
    if (!run.user.isGM)
        throw new CommandError(
            "FORBIDDEN",
            localized("downtime-dnd5e.Error.GMOnly"),
        );
}

async function dispatch(run: Run, command: Command): Promise<Outcome> {
    switch (command.type) {
        case "USE_METHOD":
            return useMethod(run, command);
        case "ADJUST": {
            requireGM(run);
            const loc = { store: command.store, itemId: command.itemId };
            const actorUuid = command.actorUuid ?? null;
            const who = await contributor(run, actorUuid);
            const event = await recordProgress(
                run,
                loc,
                actorUuid,
                new Set([locKey(loc)]),
                (state, item) => ({
                    ...eventBase(
                        run.env.randomId(),
                        run.env.now(),
                        who,
                        command.note ?? null,
                    ),
                    kind: "ADJUST",
                    progress: computeDelta(
                        state.value,
                        command.delta,
                        item.progress,
                    ),
                }),
            );
            return { eventIds: [event.id] };
        }
        case "SET": {
            // The deprecated V1 API let owners set their own actors' progress,
            // so API sets on an owned actor store stay allowed.
            const ownApiSet =
                command.reason === "API" &&
                command.store.kind === "ACTOR" &&
                (await run.env.actors.isOwner(
                    command.store.actorUuid,
                    run.user.id,
                ));
            if (!ownApiSet) requireGM(run);
            const loc = { store: command.store, itemId: command.itemId };
            const who = await contributor(run, null);
            const event = await recordProgress(
                run,
                loc,
                null,
                new Set([locKey(loc)]),
                (state, item) => ({
                    ...eventBase(
                        run.env.randomId(),
                        run.env.now(),
                        who,
                        command.note ?? null,
                    ),
                    kind: "SET",
                    reason: command.reason ?? "MANUAL",
                    value: clampProgress(command.value, item.progress),
                    before: state.value,
                }),
            );
            return { eventIds: [event.id] };
        }
        case "REVERT_LATEST": {
            requireGM(run);
            const event = await revertLatest(
                run,
                { store: command.store, itemId: command.itemId },
                0,
            );
            return { eventIds: [event.id] };
        }
        case "RESOLVE_APPROVAL":
            requireGM(run);
            return resolveApproval(run, command);
        case "SET_DISMISSED": {
            requireGM(run);
            const loc = { store: command.store, itemId: command.itemId };
            const item = await run.uow.get(loc);
            const ids = new Set(command.eventIds);
            await run.uow.put(loc.store, {
                ...item,
                history: item.history.map((e) =>
                    ids.has(e.id) ? { ...e, dismissed: command.dismissed } : e,
                ),
            });
            return { eventIds: [] };
        }
        case "SET_NOTE": {
            requireGM(run);
            const loc = { store: command.store, itemId: command.itemId };
            const item = await run.uow.get(loc);
            if (!item.history.some((e) => e.id === command.eventId))
                throw new CommandError(
                    "NOT_FOUND",
                    localized("downtime-dnd5e.Error.EventNotFound", {
                        id: command.eventId,
                    }),
                );
            await run.uow.put(loc.store, {
                ...item,
                history: item.history.map((e) =>
                    e.id === command.eventId ? { ...e, note: command.note } : e,
                ),
            });
            return { eventIds: [] };
        }
        case "SET_STATE": {
            requireGM(run);
            if (command.locked === undefined && command.completed === undefined)
                throw new CommandError(
                    "INVALID",
                    localized("downtime-dnd5e.Error.NothingToChange"),
                );
            const loc = { store: command.store, itemId: command.itemId };
            const event = await run.uow.append<StateEventData>(loc, {
                ...eventBase(
                    run.env.randomId(),
                    run.env.now(),
                    await contributor(run, null),
                    command.note ?? null,
                ),
                kind: "STATE",
                ...(command.locked !== undefined && { locked: command.locked }),
                ...(command.completed !== undefined && {
                    completed: command.completed,
                }),
            });
            return { eventIds: [event.id] };
        }
        case "CREATE_ITEM":
            requireGM(run);
            return createTrackedItem(run, command.store, command.data);
        case "TRANSFER":
            requireGM(run);
            return transfer(run, command);
        case "IMPORT_ITEMS":
            requireGM(run);
            return importTrackedItems(run, command);
        case "MOVE_METHOD":
            requireGM(run);
            return moveMethodCommand(run, command);
        case "UPDATE_ITEM": {
            requireGM(run);
            const loc = { store: command.store, itemId: command.itemId };
            const item = await run.uow.get(loc);
            const merged = {
                ...itemConfig(item),
                ...command.changes,
                id: item.id,
                schemaVersion: SCHEMA_VERSION,
                history: item.history,
            };
            const parsed = parseTrackedItem(merged, {
                randomId: run.env.randomId,
                t: run.env.t,
            });
            const newlyQuarantined =
                (parsed.value?.quarantine.length ?? 0) - item.quarantine.length;
            if (!parsed.value || newlyQuarantined > 0) {
                throw new CommandError(
                    "INVALID",
                    localized("downtime-dnd5e.Error.InvalidChanges"),
                    parsed.issues.filter((i) => i.severity !== "repaired"),
                );
            }
            await run.uow.put(loc.store, parsed.value);
            return { eventIds: [] };
        }
        case "DELETE_ITEM":
            requireGM(run);
            await run.uow.get({ store: command.store, itemId: command.itemId });
            await run.uow.remove({
                store: command.store,
                itemId: command.itemId,
            });
            return { eventIds: [] };
        case "REORDER_ITEMS": {
            requireGM(run);
            const known = new Set(
                (await run.uow.items(command.store)).map((i) => i.id),
            );
            await run.uow.setOrder(
                command.store,
                command.order.filter((id) => known.has(id)),
            );
            return { eventIds: [] };
        }
        case "SET_CATEGORIES": {
            requireGM(run);
            const categories: CategoryData[] = [];
            for (const raw of command.categories) {
                const parsed = parseCategory(raw, {
                    randomId: run.env.randomId,
                    t: run.env.t,
                });
                if (!parsed.value)
                    throw new CommandError(
                        "INVALID",
                        localized("downtime-dnd5e.Error.InvalidCategory"),
                        parsed.issues,
                    );
                categories.push(parsed.value);
            }
            await run.uow.setCategories(command.store, categories);
            return { eventIds: [] };
        }
    }
}

// ── Contributors ─────────────────────────────────────────────────────────────

async function contributor(
    run: Run,
    actorUuid: string | null,
): Promise<Contributor> {
    return {
        actorUuid,
        actorName: actorUuid ? await run.env.actors.name(actorUuid) : null,
        userId: run.user.id,
        userName: run.user.name,
        userWasGM: run.user.isGM,
    };
}

async function existingActors(run: Run, uuids: string[]): Promise<string[]> {
    const exists = await Promise.all(
        uuids.map((uuid) => run.env.actors.exists(uuid)),
    );
    return uuids.filter((_, i) => exists[i]);
}

// ── Method use ───────────────────────────────────────────────────────────────

async function useMethod(
    run: Run,
    command: UseMethodCommand,
): Promise<Outcome> {
    const { env, user, uow } = run;
    const loc = { store: command.store, itemId: command.itemId };
    const actorUuid =
        command.store.kind === "ACTOR"
            ? command.store.actorUuid
            : command.actorUuid;

    if (actorUuid && !(await env.actors.exists(actorUuid)))
        throw new CommandError(
            "NOT_FOUND",
            localized("downtime-dnd5e.Error.ActorNotFound"),
        );
    if (!user.isGM) {
        if (
            command.store.kind === "ACTOR" &&
            !(await env.actors.isOwner(command.store.actorUuid, user.id))
        )
            throw new CommandError(
                "FORBIDDEN",
                localized("downtime-dnd5e.Error.NotOwner"),
            );
        if (
            command.store.kind === "WORLD" &&
            actorUuid &&
            !(await env.actors.isOwner(actorUuid, user.id))
        )
            throw new CommandError(
                "FORBIDDEN",
                localized("downtime-dnd5e.Error.NotActingOwner"),
            );
    }

    const item = await uow.get(loc);
    if (item.hidden && !user.isGM)
        throw new CommandError(
            "FORBIDDEN",
            localized("downtime-dnd5e.Error.ItemHidden"),
        );
    const state = deriveState(item);
    if (state.locked)
        throw new CommandError(
            "LOCKED",
            localized("downtime-dnd5e.Error.ItemLocked", { item: item.name }),
        );

    const method = item.methods.find((m) => m.id === command.methodId);
    if (!method)
        throw new CommandError(
            "NOT_FOUND",
            localized("downtime-dnd5e.Error.MethodNotFound", {
                id: command.methodId,
            }),
        );
    if (method.hidden && !user.isGM)
        throw new CommandError(
            "FORBIDDEN",
            localized("downtime-dnd5e.Error.MethodHidden"),
        );
    if (method.kind === "MANUAL" && method.gmOnly && !user.isGM)
        throw new CommandError(
            "FORBIDDEN",
            localized("downtime-dnd5e.Error.GMOnlyMethod"),
        );

    // Requirements (the item's and the method's): GMs may bypass (they always have the final say).
    const requirements = [...item.requirements, ...method.requirements];
    const availability = evaluateRequirements(
        { requirements },
        {
            actor: actorUuid ? await env.actors.view(actorUuid) : null,
            refs: {
                self: item,
                sameStore: await uow.items(loc.store),
                worldStore:
                    loc.store.kind === "WORLD"
                        ? null
                        : await uow.itemsIfExists(WORLD_STORE),
                actingActorStore:
                    actorUuid &&
                    !(
                        loc.store.kind === "ACTOR" &&
                        loc.store.actorUuid === actorUuid
                    )
                        ? await uow.itemsIfExists({ kind: "ACTOR", actorUuid })
                        : null,
            },
            macroResults: new Map(
                Object.entries(command.macroRequirements ?? {}),
            ),
        },
    );
    if (availability.state !== "AVAILABLE" && !user.isGM)
        throw new CommandError(
            "UNAVAILABLE",
            localized("downtime-dnd5e.Error.RequirementsUnmet"),
            availability,
        );

    const who = await contributor(run, actorUuid);
    const usage = currentTier(item, method.id, who);
    if (
        usage &&
        (usage.tier.kind === "DISABLE" || usage.tier.kind === "HIDE") &&
        !user.isGM
    )
        throw new CommandError(
            "UNAVAILABLE",
            usage.tier.kind === "DISABLE" && usage.tier.hint
                ? usage.tier.hint
                : localized("downtime-dnd5e.Error.UsageLimit"),
        );

    const rollData = actorUuid ? await env.actors.rollData(actorUuid) : {};
    const resolved = await resolveMethodEffect(
        run,
        method,
        command,
        usage?.tier ?? null,
        rollData,
    );

    const event = await recordProgress(
        run,
        loc,
        actorUuid,
        new Set([locKey(loc)]),
        (current, currentItem) => ({
            ...eventBase(env.randomId(), env.now(), who),
            kind: "METHOD",
            methodId: method.id,
            method: { name: method.name, kind: method.kind },
            band: resolved.band,
            roll: resolved.roll,
            usageTier: usage?.index ?? null,
            progress: computeDelta(
                current.value,
                resolved.requested,
                currentItem.progress,
            ),
        }),
    );
    return { eventIds: [event.id] };
}

interface ResolvedEffect {
    requested: number;
    band: BandSnapshot | null;
    roll: RollSummary | null;
}

async function resolveMethodEffect(
    run: Run,
    method: MethodData,
    command: UseMethodCommand,
    tier: UsageTier | null,
    rollData: Record<string, unknown>,
): Promise<ResolvedEffect> {
    const evaluate = run.env.evaluateFormula;
    switch (method.kind) {
        case "ABILITY":
        case "SKILL":
        case "TOOL": {
            if (!command.roll)
                throw new CommandError(
                    "INVALID",
                    localized("downtime-dnd5e.Error.RollRequired"),
                );
            const table =
                tier?.kind === "RESULTS" ? tier.results : method.results;
            return resolveRoll(
                table,
                method.dc,
                command.roll,
                rollData,
                evaluate,
            );
        }
        case "FIXED": {
            const effect =
                tier?.kind === "EFFECT" ? tier.effect : method.effect;
            return {
                requested: await evaluateEffect(
                    effect,
                    formulaData(null, rollData),
                    evaluate,
                ),
                band: {
                    id: `${method.id}:fixed`,
                    label: method.name,
                    countsAs: method.countsAs,
                },
                roll: null,
            };
        }
        case "MANUAL": {
            if (
                typeof command.amount !== "number" ||
                !Number.isFinite(command.amount)
            )
                throw new CommandError(
                    "INVALID",
                    localized("downtime-dnd5e.Error.AmountRequired"),
                );
            return { requested: command.amount, band: null, roll: null };
        }
        case "MACRO": {
            const result = command.macroResult;
            if (!result)
                throw new CommandError(
                    "INVALID",
                    localized("downtime-dnd5e.Error.MacroNoResult"),
                );
            if ("delta" in result) {
                if (!Number.isFinite(result.delta))
                    throw new CommandError(
                        "INVALID",
                        localized("downtime-dnd5e.Error.MacroDeltaNotNumber"),
                    );
                return { requested: result.delta, band: null, roll: null };
            }
            const table =
                tier?.kind === "RESULTS" ? tier.results : method.results;
            if (!table)
                throw new CommandError(
                    "INVALID",
                    localized("downtime-dnd5e.Error.MacroNoTable"),
                );
            return resolveRoll(table, null, result.roll, rollData, evaluate);
        }
    }
}

async function resolveRoll(
    table: ResultTable,
    methodDc: number | null,
    roll: ClientRoll,
    rollData: Record<string, unknown>,
    evaluate: CommandEnv["evaluateFormula"],
): Promise<ResolvedEffect> {
    if (!Number.isFinite(roll.total))
        throw new CommandError(
            "INVALID",
            localized("downtime-dnd5e.Error.RollTotalNotNumber"),
        );
    const dc = effectiveDc(methodDc, roll.activityDc);
    const bandRoll: BandRoll = {
        total: roll.total,
        natural: roll.natural,
        dc: dc.dc,
    };
    const band = resolveBand(table, bandRoll);
    if (!band)
        throw new CommandError(
            "FAILED",
            localized("downtime-dnd5e.Error.NoBandMatched"),
        );
    return {
        requested: await evaluateEffect(
            band.effect,
            formulaData(bandRoll, rollData),
            evaluate,
        ),
        band: { id: band.id, label: band.label, countsAs: band.countsAs },
        roll: {
            formula: roll.formula,
            total: roll.total,
            natural: roll.natural,
            dc: dc.dc,
            dcSource: dc.source,
            rolled: roll.rolled,
            rollMode: roll.rollMode,
            messageId: roll.messageId,
        },
    };
}

// ── Progress + milestones ────────────────────────────────────────────────────

function progressChange(event: ProgressEventData): {
    before: number;
    after: number;
} {
    if (event.kind === "SET")
        return { before: event.before, after: event.value };
    return { before: event.progress.before, after: event.progress.after };
}

/** Append a progress event, then fire any milestones it hits. */
async function recordProgress<E extends ProgressEventData>(
    run: Run,
    loc: ItemLocation,
    actorUuid: string | null,
    chain: Chain,
    build: (state: TrackedItemState, item: TrackedItemData) => Omit<E, "seq">,
): Promise<E> {
    const item = await run.uow.get(loc);
    const state = deriveState(item);
    const event = await run.uow.append<E>(loc, build(state, item));
    const { before, after } = progressChange(event);

    const updated = await run.uow.get(loc);
    for (const milestone of detectMilestones(
        updated.milestones,
        before,
        after,
        state.milestoneFires,
    )) {
        await fireMilestone(run, loc, milestone, event, actorUuid, chain);
    }
    return event;
}

function blankResult(
    action: MilestoneAction,
    status: MilestoneActionResult["status"],
    message: MilestoneActionResult["message"] = null,
): MilestoneActionResult {
    return {
        actionId: action.id,
        kind: action.kind,
        status,
        message,
        createdUuids: [],
        createdItems: [],
        adjustedEvent: null,
        recipientUuids: [],
    };
}

function needsApproval(
    run: Run,
    item: TrackedItemData,
    action: MilestoneAction,
): boolean {
    if (UNGATED_ACTIONS.has(action.kind)) return false;
    const recipient = actionRecipient(action);
    if (
        recipient &&
        "selection" in recipient &&
        recipient.selection === "GM_PICKS"
    )
        return true;
    const policy =
        item.approval === "WORLD_DEFAULT"
            ? run.env.approvalDefault()
            : item.approval;
    // A GM triggering the milestone is the approval.
    return policy === "GM" && !run.user.isGM;
}

async function fireMilestone(
    run: Run,
    loc: ItemLocation,
    milestone: MilestoneData,
    cause: ProgressEventData,
    actorUuid: string | null,
    chain: Chain,
): Promise<MilestoneEventData> {
    const item = await run.uow.get(loc);
    const results: MilestoneActionResult[] = [];
    for (const action of milestone.actions) {
        if (needsApproval(run, item, action)) {
            results.push(blankResult(action, "PENDING_APPROVAL"));
            continue;
        }
        results.push(
            await executeAction(
                run,
                loc,
                milestone,
                action,
                actorUuid,
                chain,
                null,
            ),
        );
    }
    return run.uow.append<MilestoneEventData>(loc, {
        ...eventBase(
            run.env.randomId(),
            run.env.now(),
            await contributor(run, actorUuid),
        ),
        kind: "MILESTONE",
        milestoneId: milestone.id,
        causeEventId: cause.id,
        actions: results,
    });
}

/** Resolve recipient actor uuids. Throws CommandError("FAILED") with a reason when there are none. */
async function resolveRecipients(
    run: Run,
    loc: ItemLocation,
    milestone: MilestoneData,
    recipient: Recipient,
    actorUuid: string | null,
): Promise<string[]> {
    let uuids: string[];
    switch (recipient.type) {
        case "TRIGGERING_ACTOR":
            if (!actorUuid)
                throw new CommandError(
                    "FAILED",
                    localized("downtime-dnd5e.Error.NoTriggeringActor"),
                );
            uuids = [actorUuid];
            break;
        case "OWNING_ACTOR":
            if (loc.store.kind !== "ACTOR")
                throw new CommandError(
                    "FAILED",
                    localized("downtime-dnd5e.Error.WorldNoOwner"),
                );
            uuids = [loc.store.actorUuid];
            break;
        case "ACTOR":
            uuids = recipient.actorUuids;
            break;
        case "CONTRIBUTORS": {
            const item = await run.uow.get(loc);
            uuids = eligibleContributors(item, milestone.id, recipient.filter)
                .map((c) => c.contributor.actorUuid)
                .filter((uuid): uuid is string => uuid !== null);
            break;
        }
    }
    const existing = await existingActors(run, [...new Set(uuids)]);
    if (existing.length === 0)
        throw new CommandError(
            "FAILED",
            localized("downtime-dnd5e.Error.NoRecipients"),
        );
    return existing;
}

async function executeAction(
    run: Run,
    loc: ItemLocation,
    milestone: MilestoneData,
    action: MilestoneAction,
    actorUuid: string | null,
    chain: Chain,
    pickedRecipients: string[] | null,
): Promise<MilestoneActionResult> {
    const result = blankResult(action, "APPLIED");
    const item = await run.uow.get(loc);
    const ctx: ActionExecutionContext = {
        store: loc.store,
        item,
        milestoneId: milestone.id,
        action,
        triggeringActorUuid: actorUuid,
    };
    const recipients = async (recipient: Recipient) =>
        pickedRecipients ??
        resolveRecipients(run, loc, milestone, recipient, actorUuid);

    try {
        switch (action.kind) {
            case "COMPLETE":
            case "LOCK":
                break;
            case "ANNOUNCE":
                await run.env.effects.announce(
                    action.message,
                    action.audience,
                    ctx,
                );
                break;
            case "GRANT_ITEM":
            case "APPLY_EFFECT": {
                result.recipientUuids = await recipients(action.recipient);
                for (const uuid of result.recipientUuids) {
                    const created =
                        action.kind === "GRANT_ITEM"
                            ? await run.env.effects.grantItem(
                                  action.sourceUuid,
                                  action.quantity,
                                  uuid,
                              )
                            : await run.env.effects.applyEffect(
                                  action.sourceUuid,
                                  uuid,
                              );
                    result.createdUuids.push(...created);
                }
                break;
            }
            case "ADD_TRACKED_ITEM": {
                let stores: StoreRef[];
                if (action.store === "SAME") stores = [loc.store];
                else if (action.store === "WORLD") stores = [WORLD_STORE];
                else {
                    if (!action.recipient)
                        throw new CommandError(
                            "FAILED",
                            localized(
                                "downtime-dnd5e.Error.NoRecipientForItem",
                            ),
                        );
                    result.recipientUuids = await recipients(action.recipient);
                    stores = result.recipientUuids.map((uuid) => ({
                        kind: "ACTOR",
                        actorUuid: uuid,
                    }));
                }
                for (const store of stores) {
                    const created = instantiateTemplate(
                        action.template,
                        run.env.randomId(),
                    );
                    await run.uow.put(store, created);
                    result.createdItems.push({ store, itemId: created.id });
                }
                break;
            }
            case "ADJUST_PROGRESS": {
                const target = await locateRef(run, loc, action.ref, actorUuid);
                if (!target)
                    throw new CommandError(
                        "FAILED",
                        localized("downtime-dnd5e.Error.AdjustTargetNotFound"),
                    );
                if (chain.has(locKey(target)))
                    throw new CommandError(
                        "FAILED",
                        localized("downtime-dnd5e.Error.AdjustLoop"),
                    );
                if (chain.size >= MAX_CHAIN_DEPTH)
                    throw new CommandError(
                        "FAILED",
                        localized("downtime-dnd5e.Error.AdjustChainTooDeep", {
                            max: MAX_CHAIN_DEPTH,
                        }),
                    );
                const who = await contributor(run, actorUuid);
                const event = await recordProgress<AdjustEventData>(
                    run,
                    target,
                    actorUuid,
                    new Set([...chain, locKey(target)]),
                    (state, targetItem) => ({
                        ...eventBase(run.env.randomId(), run.env.now(), who),
                        kind: "ADJUST",
                        progress: computeDelta(
                            state.value,
                            action.delta,
                            targetItem.progress,
                        ),
                    }),
                );
                result.adjustedEvent = { ...target, eventId: event.id };
                break;
            }
            case "MACRO":
                await run.env.effects.runMacro(action.macroUuid, {
                    ...ctx,
                    undo: false,
                });
                break;
        }
    } catch (error) {
        return {
            ...result,
            status: "FAILED",
            message: errorText(error),
        };
    }
    return result;
}

/** Same resolution order as requirements: same store → world → acting actor's store. */
async function locateRef(
    run: Run,
    loc: ItemLocation,
    ref: ItemRef,
    actorUuid: string | null,
): Promise<ItemLocation | null> {
    if (ref.kind === "SELF") return loc;
    const candidates: StoreRef[] = [loc.store];
    if (loc.store.kind !== "WORLD") candidates.push(WORLD_STORE);
    if (
        actorUuid &&
        !(loc.store.kind === "ACTOR" && loc.store.actorUuid === actorUuid)
    )
        candidates.push({ kind: "ACTOR", actorUuid });
    for (const store of candidates) {
        const items = await run.uow.itemsIfExists(store);
        if (items?.some((i) => i.id === ref.id))
            return { store, itemId: ref.id };
    }
    return null;
}

export function instantiateTemplate(
    template: TrackedItemTemplate,
    id: Id,
): TrackedItemData {
    return {
        ...structuredClone(template),
        schemaVersion: SCHEMA_VERSION,
        id,
        history: [],
        quarantine: [],
    };
}

// ── Approvals ────────────────────────────────────────────────────────────────

async function resolveApproval(
    run: Run,
    command: ResolveApprovalCommand,
): Promise<Outcome> {
    const loc = { store: command.store, itemId: command.itemId };
    const item = await run.uow.get(loc);
    const events = effectiveEvents(item.history);
    const milestoneEvent = events.find(
        (e): e is MilestoneEventData =>
            e.kind === "MILESTONE" && e.id === command.milestoneEventId,
    );
    if (!milestoneEvent)
        throw new CommandError(
            "NOT_FOUND",
            localized("downtime-dnd5e.Error.MilestoneEventNotFound"),
        );
    const current = actionResults(events).get(
        `${milestoneEvent.id}:${command.actionId}`,
    );
    if (current?.status !== "PENDING_APPROVAL")
        throw new CommandError(
            "INVALID",
            localized("downtime-dnd5e.Error.NotAwaitingApproval"),
        );

    const milestone = item.milestones.find(
        (m) => m.id === milestoneEvent.milestoneId,
    );
    const action = milestone?.actions.find((a) => a.id === command.actionId);
    const cause = item.history.find(
        (e) => e.id === milestoneEvent.causeEventId,
    );
    const actorUuid = cause?.contributor.actorUuid ?? null;

    let result: MilestoneActionResult;
    if (!command.approved) {
        result = { ...current, status: "REJECTED" };
    } else if (!milestone || !action) {
        result = {
            ...current,
            status: "FAILED",
            message: localized("downtime-dnd5e.Error.MilestoneOrActionGone"),
        };
    } else {
        const recipient = actionRecipient(action);
        let picked: string[] | null = null;
        if (
            recipient &&
            "selection" in recipient &&
            recipient.selection === "GM_PICKS"
        ) {
            picked = await existingActors(run, command.recipientUuids ?? []);
            if (recipient.type === "ACTOR")
                picked = picked.filter((uuid) =>
                    recipient.actorUuids.includes(uuid),
                );
            if (picked.length === 0)
                throw new CommandError(
                    "INVALID",
                    localized("downtime-dnd5e.Error.PickRecipient"),
                );
        }
        result = await executeAction(
            run,
            loc,
            milestone,
            action,
            actorUuid,
            new Set([locKey(loc)]),
            picked,
        );
    }

    const event = await run.uow.append<ApprovalEventData>(loc, {
        ...eventBase(
            run.env.randomId(),
            run.env.now(),
            await contributor(run, null),
        ),
        kind: "APPROVAL",
        milestoneEventId: milestoneEvent.id,
        actionId: command.actionId,
        approved: command.approved,
        result,
    });
    return { eventIds: [event.id] };
}

// ── Reverts ──────────────────────────────────────────────────────────────────

function revertContext(run: Run): RevertContext {
    const ctx: RevertContext = {
        trackedItemHasHistory: async (location) =>
            hasOwnHistory(await run.uow.find(location)),
        checkAdjustment: async (target, eventId) => {
            const item = await run.uow.find(target);
            if (!item) return { ok: true }; // already gone: nothing to undo
            if (latestProgressEvent(item)?.id !== eventId)
                return {
                    ok: false,
                    notLatest: true,
                    reason: `${item.name} has newer changes`,
                };
            const plan = await planRevert(item, ctx);
            if (plan && !canRevert(plan))
                return {
                    ok: false,
                    notLatest: false,
                    reason: `${item.name} can't be reverted`,
                };
            return { ok: true };
        },
    };
    return ctx;
}

async function revertLatest(
    run: Run,
    loc: ItemLocation,
    depth: number,
): Promise<RevertEventData> {
    if (depth > MAX_CHAIN_DEPTH)
        throw new CommandError(
            "BLOCKED",
            localized("downtime-dnd5e.Error.RevertChainTooDeep"),
        );
    const item = await run.uow.get(loc);
    const plan = await planRevert(item, revertContext(run));
    if (!plan)
        throw new CommandError(
            "INVALID",
            localized("downtime-dnd5e.Error.NothingToRevert"),
        );
    if (!canRevert(plan))
        throw new CommandError(
            "BLOCKED",
            localized("downtime-dnd5e.Error.CannotRevert"),
            plan.blockers,
        );

    for (const step of plan.undo) {
        switch (step.kind) {
            case "DERIVED":
            case "NONE":
                break;
            case "DELETE_DOCUMENTS":
                if (step.uuids.length > 0)
                    await run.env.effects.deleteDocuments(step.uuids);
                break;
            case "DELETE_TRACKED_ITEMS":
                for (const created of step.items) {
                    if (await run.uow.find(created))
                        await run.uow.remove(created);
                }
                break;
            case "REVERT_ADJUSTMENT": {
                const target = await run.uow.find(step.target);
                if (
                    target &&
                    latestProgressEvent(target)?.id === step.eventId
                ) {
                    await revertLatest(run, step.target, depth + 1);
                }
                break;
            }
            case "RUN_UNDO_MACRO": {
                const milestoneEvent = item.history.find(
                    (e) => e.id === step.milestoneEventId,
                ) as MilestoneEventData | undefined;
                const milestone = item.milestones.find(
                    (m) => m.id === milestoneEvent?.milestoneId,
                );
                const action = milestone?.actions.find(
                    (a) => a.id === step.actionId,
                );
                if (!milestone || !action) break;
                await run.env.effects.runMacro(step.macroUuid, {
                    store: loc.store,
                    item,
                    milestoneId: milestone.id,
                    action,
                    triggeringActorUuid: plan.target.contributor.actorUuid,
                    undo: true,
                });
                break;
            }
        }
    }

    // `append` assigns the real seq; revertEventFor needs a full base.
    const current = await run.uow.get(loc);
    return run.uow.append<RevertEventData>(
        loc,
        revertEventFor(plan, {
            id: run.env.randomId(),
            seq: nextSeq(current),
            timestamp: run.env.now(),
            contributor: await contributor(run, null),
        }),
    );
}

// ── Items ────────────────────────────────────────────────────────────────────

async function createTrackedItem(
    run: Run,
    store: StoreRef,
    data: unknown,
): Promise<Outcome> {
    const existing = new Set((await run.uow.items(store)).map((i) => i.id));
    const raw =
        typeof data === "object" && data !== null
            ? (data as Record<string, unknown>)
            : {};
    const requestedId =
        typeof raw.id === "string" && raw.id.length > 0 && !existing.has(raw.id)
            ? raw.id
            : run.env.randomId();
    const parsed = parseTrackedItem(
        { history: [], ...raw, schemaVersion: SCHEMA_VERSION, id: requestedId },
        { randomId: run.env.randomId, t: run.env.t },
    );
    if (!parsed.value)
        throw new CommandError(
            "INVALID",
            localized("downtime-dnd5e.Error.InvalidItem"),
            parsed.issues,
        );
    if (parsed.value.quarantine.length > 0)
        throw new CommandError(
            "INVALID",
            localized("downtime-dnd5e.Error.ItemInvalidParts"),
            parsed.issues.filter((i) => i.severity !== "repaired"),
        );
    await run.uow.put(store, parsed.value);
    return { eventIds: [], itemId: parsed.value.id };
}

// ── Transfers ────────────────────────────────────────────────────────────────

async function transfer(run: Run, command: TransferCommand): Promise<Outcome> {
    const { store: source, dest, mode } = command;
    if (storeKey(source) === storeKey(dest) && mode === "MOVE")
        throw new CommandError(
            "INVALID",
            localized("downtime-dnd5e.Error.SameDestination"),
        );
    if (command.itemIds.length === 0)
        throw new CommandError(
            "INVALID",
            localized("downtime-dnd5e.Error.NothingToTransfer"),
        );
    const sourceItems = await run.uow.items(source);
    for (const id of command.itemIds)
        if (!sourceItems.some((i) => i.id === id))
            throw new CommandError(
                "NOT_FOUND",
                localized("downtime-dnd5e.Error.ItemNotFound", { id }),
            );
    const worldItems =
        source.kind === "WORLD" || dest.kind === "WORLD"
            ? null
            : await run.uow.itemsIfExists(WORLD_STORE);

    const plan = planTransfer(
        {
            mode,
            source,
            dest,
            sourceItems,
            sourceCategories: await run.uow.categories(source),
            destItems: await run.uow.items(dest),
            destCategories: await run.uow.categories(dest),
            worldItems,
            itemIds: command.itemIds,
        },
        command.choices,
        run.env.randomId,
    );

    // Everything written must parse cleanly, as on create.
    for (const item of [...plan.result.create, ...plan.result.updateSource]) {
        const parsed = parseTrackedItem(structuredClone(item), {
            randomId: run.env.randomId,
            t: run.env.t,
        });
        if (
            !parsed.value ||
            parsed.value.quarantine.length > item.quarantine.length
        )
            throw new CommandError(
                "INVALID",
                localized("downtime-dnd5e.Error.WouldBeInvalid", {
                    item: item.name,
                }),
                parsed.issues.filter((i) => i.severity !== "repaired"),
            );
    }

    if (plan.result.destCategories)
        await run.uow.setCategories(dest, plan.result.destCategories);
    for (const item of plan.result.create) await run.uow.put(dest, item);
    for (const item of plan.result.updateSource)
        await run.uow.put(source, item);
    for (const itemId of plan.result.remove)
        await run.uow.remove({ store: source, itemId });

    return {
        eventIds: [],
        transferred: Object.fromEntries(
            plan.entries.map((e) => [e.sourceId, e.destId]),
        ),
    };
}

// ── Imports ──────────────────────────────────────────────────────────────────

async function importTrackedItems(
    run: Run,
    command: ImportItemsCommand,
): Promise<Outcome> {
    const randomId = run.env.randomId;
    const items = command.items
        .map((raw) => parseTrackedItem(raw, { randomId, t: run.env.t }).value)
        .filter((item): item is TrackedItemData => item !== null);
    const categories = command.categories
        .map((raw) => parseCategory(raw, { randomId, t: run.env.t }).value)
        .filter((c): c is CategoryData => c !== null);
    if (items.length === 0 && categories.length === 0)
        throw new CommandError(
            "INVALID",
            localized("downtime-dnd5e.Error.NothingToImport"),
        );
    const plan = planImport(
        { items, categories },
        await run.uow.items(command.store),
        await run.uow.categories(command.store),
        randomId,
    );
    if (plan.destCategories)
        await run.uow.setCategories(command.store, plan.destCategories);
    for (const item of plan.create) await run.uow.put(command.store, item);
    return {
        eventIds: [],
        imported: plan.create.length,
        transferred: plan.renamed,
    };
}

// ── Moving methods ───────────────────────────────────────────────────────────

async function moveMethodCommand(
    run: Run,
    command: MoveMethodCommand,
): Promise<Outcome> {
    const from = { store: command.store, itemId: command.itemId };
    const to = { store: command.dest, itemId: command.destItemId };
    const source = await run.uow.get(from);
    const target = locKey(from) === locKey(to) ? source : await run.uow.get(to);
    if (!source.methods.some((m) => m.id === command.methodId))
        throw new CommandError(
            "NOT_FOUND",
            localized("downtime-dnd5e.Error.MethodGone"),
        );
    const moved = moveMethod(
        source,
        target,
        command.methodId,
        command.index,
        command.copy,
        run.env.randomId,
    );
    for (const item of [moved.source, moved.target]) {
        const parsed = parseTrackedItem(structuredClone(item), {
            randomId: run.env.randomId,
            t: run.env.t,
        });
        if (
            !parsed.value ||
            parsed.value.quarantine.length > item.quarantine.length
        )
            throw new CommandError(
                "INVALID",
                localized("downtime-dnd5e.Error.WouldBeInvalid", {
                    item: item.name,
                }),
            );
    }
    await run.uow.put(from.store, moved.source);
    if (locKey(from) !== locKey(to)) await run.uow.put(to.store, moved.target);
    return { eventIds: [] };
}

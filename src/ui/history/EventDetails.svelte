<script lang="ts">
    import { localize, localizeText } from "../../foundry/i18n";
    /**
     * One history entry, rendered per kind. Unknown kinds fall
     * through to a plain description.
     */
    import {
        MilestoneEvent,
        RevertEvent,
        type AnyHistoryEvent,
    } from "../../domain/HistoryEvent";
    import {
        ACTION_LABELS,
        approvalCandidates,
        rolledWith,
        STATUS_LABELS,
    } from "../../model/views/methodCard";
    import type { Id, TrackedItemData } from "../../types/data";
    import { rolledLabel, toolLabel } from "../../dnd5e/config";
    import type { I18nKey } from "../../types/i18n";
    import { describeEvent } from "../describe";

    type Props = {
        event: AnyHistoryEvent;
        isGM: boolean;
        busy: boolean;
        onresolve: (
            milestoneEventId: Id,
            actionId: Id,
            approved: boolean,
        ) => void;
    };

    const { event, isGM, busy, onresolve }: Props = $props();

    const data = $derived(event.data);
    const itemData = $derived(event.item.data as TrackedItemData);

    const SET_REASONS: Record<
        "MIGRATION" | "API" | "MANUAL" | "IMPORT",
        I18nKey
    > = {
        MIGRATION: "downtime-dnd5e.EventDetails.Reason.MIGRATION",
        API: "downtime-dnd5e.EventDetails.Reason.API",
        MANUAL: "downtime-dnd5e.EventDetails.Reason.MANUAL",
        IMPORT: "downtime-dnd5e.EventDetails.Reason.IMPORT",
    };
</script>

{#if data.kind === "METHOD"}
    {@const rolled = rolledWith(itemData, data, {
        t: localize,
        tool: toolLabel,
        rolled: rolledLabel,
    })}
    <span class="what">
        <strong>{data.method.name}</strong>
        {#if data.band?.label && data.band.label !== data.method.name}
            <span
                class="band"
                class:success={data.band.countsAs === "SUCCESS"}
                class:failure={data.band.countsAs === "FAILURE"}
                >{data.band.label}</span
            >
        {/if}
    </span>
    {#if data.roll}
        <div class="detail">
            {localize("downtime-dnd5e.EventDetails.Rolled", {
                total: data.roll.total,
            })}{data.roll.natural !== null
                ? ` ${localize("downtime-dnd5e.Card.Natural", { natural: data.roll.natural })}`
                : ""}{data.roll.dc !== null
                ? ` ${localize(
                      data.roll.dcSource === "ACTIVITY"
                          ? "downtime-dnd5e.EventDetails.VsActivityDC"
                          : "downtime-dnd5e.Card.VsDC",
                      { dc: data.roll.dc },
                  )}`
                : ""}
            · <code>{data.roll.formula}</code>
            {#if rolled}· {rolled}{/if}
        </div>
    {/if}
    {#if data.usageTier !== null}
        <div class="detail">
            {localize("downtime-dnd5e.EventDetails.UsageStep", {
                step: data.usageTier + 1,
            })}
        </div>
    {/if}
{:else if event instanceof MilestoneEvent}
    {@const milestone = event.milestone}
    <span class="what">
        <i class="fas fa-flag-checkered"></i>
        <strong
            >{milestone?.label ||
                localize("downtime-dnd5e.EventKind.MILESTONE")}</strong
        >
        {#if milestone}<span class="detail"
                >{localize("downtime-dnd5e.Revert.MilestoneAt", {
                    at: milestone.at,
                })}</span
            >{/if}
    </span>
    <ul class="actions">
        {#each event.actions as action (action.actionId)}
            {@const status = event.isReverted ? "REVERTED" : action.status}
            <li class="status-{status.toLowerCase()}">
                {localize(ACTION_LABELS[action.kind])}
                <span class="status">{localize(STATUS_LABELS[status])}</span>
                {#if action.message}<span class="detail"
                        >— {localizeText(action.message)}</span
                    >{/if}
                {#if isGM && status === "PENDING_APPROVAL"}
                    {@const picks =
                        approvalCandidates(
                            itemData,
                            event.id,
                            action.actionId,
                        ) !== null}
                    <button
                        type="button"
                        disabled={busy}
                        title={localize(
                            picks
                                ? "downtime-dnd5e.Card.PickAndApprove"
                                : "downtime-dnd5e.Card.Approve",
                        )}
                        onclick={() =>
                            onresolve(event.id, action.actionId, true)}
                        ><i class="fas fa-check"></i>{picks
                            ? ` ${localize("downtime-dnd5e.Card.Pick")}`
                            : ""}</button
                    >
                    <button
                        type="button"
                        disabled={busy}
                        title={localize("downtime-dnd5e.Card.Reject")}
                        onclick={() =>
                            onresolve(event.id, action.actionId, false)}
                        ><i class="fas fa-xmark"></i></button
                    >
                {/if}
            </li>
        {/each}
    </ul>
{:else if data.kind === "APPROVAL"}
    <span class="what">
        <i class="fas {data.approved ? 'fa-check' : 'fa-xmark'}"></i>
        {localize(
            data.approved
                ? "downtime-dnd5e.Describe.Approved"
                : "downtime-dnd5e.Describe.Rejected",
            { action: localize(ACTION_LABELS[data.result.kind]) },
        )}
    </span>
    {#if data.approved && data.result.status === "FAILED"}
        <div class="detail failure">
            {data.result.message
                ? localize("downtime-dnd5e.EventDetails.FailedBecause", {
                      reason: localizeText(data.result.message),
                  })
                : localize("downtime-dnd5e.EventDetails.Failed")}
        </div>
    {/if}
{:else if event instanceof RevertEvent && data.kind === "REVERT"}
    {@const target = event.target}
    <span class="what"
        ><i class="fas fa-rotate-left"></i>
        {localize("downtime-dnd5e.EventDetails.Reverted", {
            change: target
                ? describeEvent(target)
                : localize("downtime-dnd5e.EventDetails.EarlierChange"),
        })}</span
    >
    {#if data.revertedMilestoneEventIds.length}
        <div class="detail">
            {localize("downtime-dnd5e.EventDetails.AndMilestones", {
                count: data.revertedMilestoneEventIds.length,
            })}
        </div>
    {/if}
{:else if data.kind === "SET"}
    <span class="what"
        >{localize("downtime-dnd5e.Describe.Set", { value: data.value })}
        <span class="detail"
            >{data.reason === "MANUAL"
                ? localize("downtime-dnd5e.EventDetails.Was", {
                      before: data.before,
                  })
                : localize("downtime-dnd5e.EventDetails.WasReason", {
                      before: data.before,
                      reason: localize(SET_REASONS[data.reason]),
                  })}</span
        ></span
    >
{:else}
    <span class="what">{describeEvent(event)}</span>
{/if}

<style>
    .what {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 0.3rem;
        align-items: baseline;
    }
    .detail {
        font-size: 0.8rem;
        opacity: 0.8;
    }
    .band {
        font-size: 0.8rem;
        font-weight: bold;
    }
    .success {
        color: var(--color-level-success, #2a7a2a);
    }
    .failure {
        color: var(--color-level-error, #a22);
    }
    .actions {
        margin: 0.1rem 0 0;
        padding-left: 1rem;
        font-size: 0.8rem;
    }
    .actions li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.25rem;
    }
    .status {
        opacity: 0.75;
    }
    .status-pending_approval .status {
        color: var(--color-level-warning, #c80);
        opacity: 1;
    }
    .status-failed .status,
    .status-rejected .status {
        color: var(--color-level-error, #a22);
        opacity: 1;
    }
    button {
        width: auto;
        line-height: 1.3;
        padding: 0 0.35rem;
        font-size: 0.75rem;
    }
    code {
        font-size: 0.75rem;
    }
</style>

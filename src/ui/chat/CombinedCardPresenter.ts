/**
 * v1 chat presenter: one combined card per method use. The roll
 * is attached to the message (Dice So Nice, roll modes, dnd5e tooltips) and
 * rendered statically; everything that can change later (progress state,
 * milestones, approvals, reverts) lives in `.dt-live` and is re-rendered from
 * current data.
 */
import "./chatCard.css";
import { CONSTANTS } from "../../constants";
import { rolledLabel, toolLabel } from "../../dnd5e/config";
import { actorFromUuid } from "../../foundry/actors";
import {
    applyMessageMode,
    defaultMessageMode,
    diceSound,
    gmUserIds,
    speakerFor,
} from "../../foundry/chat";
import { renderStoredRoll } from "../../foundry/dice";
import { localize } from "../../foundry/i18n";
import { getSetting } from "../../foundry/settings";
import { isGM } from "../../foundry/users";
import { escapeHTML as escape } from "../../foundry/utils";
import { buildMethodCard, type MethodCard } from "../../model/views/methodCard";
import type { TrackedItemData } from "../../types/data";
import { signed } from "../describe";
import { contributorNames, getTrackedItem } from "../../runtime/api";
import type {
    ChatCardRef,
    ChatPresenter,
    MethodUseResult,
} from "../../runtime/chatPresenter";

const names = contributorNames;

async function cardFor(ref: ChatCardRef): Promise<MethodCard | null> {
    const item = await getTrackedItem(ref.store, ref.itemId);
    return item
        ? buildMethodCard(item.data as TrackedItemData, ref.eventId, {
              isGM: isGM(),
              names,
              t: localize,
              toolLabel,
              rolledLabel,
          })
        : null;
}

async function renderRolls(rolls: unknown[]): Promise<string> {
    let html = "";
    for (const data of rolls) html += await renderStoredRoll(data);
    return html;
}

function resultLine(card: MethodCard): string {
    const parts: string[] = [];
    if (card.band)
        parts.push(
            `<strong class="dt-band ${card.band.countsAs === "SUCCESS" ? "success" : card.band.countsAs === "FAILURE" ? "failure" : ""}">${escape(card.band.label)}</strong>`,
        );
    if (card.roll) {
        const natural =
            card.roll.natural !== null
                ? ` ${localize("downtime-dnd5e.Card.Natural", { natural: card.roll.natural })}`
                : "";
        const dc =
            card.roll.dc !== null
                ? ` ${localize("downtime-dnd5e.Card.VsDC", { dc: card.roll.dc })}`
                : "";
        parts.push(`<span>${card.roll.total}${natural}${dc}</span>`);
    }
    return parts.length
        ? `<div class="dt-result">${parts.join(" ")}</div>`
        : "";
}

function progressBlock(card: MethodCard): string {
    const p = card.progress;
    const target = p.target !== null ? ` / ${p.target}` : "";
    const clamped = p.clamped
        ? ` <span class="dt-muted" title="${escape(localize("downtime-dnd5e.Card.Capped"))}">${escape(localize("downtime-dnd5e.Card.OfRequested", { requested: signed(p.requested) }))}</span>`
        : "";
    const bar =
        p.percent !== null
            ? `<div class="dt-bar"><span style="width:${p.percent.toFixed(1)}%"></span></div>`
            : "";
    return `<div class="dt-progress">
  <div><i class="fas fa-chart-simple"></i> ${p.before} → <strong>${p.after}</strong>${target} <span class="dt-delta">(${signed(p.applied)})</span>${clamped}</div>
  ${bar}
</div>`;
}

function milestonesBlock(card: MethodCard): string {
    if (!card.milestones.length) return "";
    const gm = isGM();
    const rows = card.milestones.map((m) => {
        const actions = m.actions
            .map((a) => {
                const buttons =
                    gm && a.status === "PENDING_APPROVAL"
                        ? `<span class="dt-approve">
  <button type="button" data-dt-action="approve" data-milestone-event="${m.eventId}" data-action-id="${a.actionId}" title="${escape(localize(a.gmPicks ? "downtime-dnd5e.Card.PickAndApprove" : "downtime-dnd5e.Card.Approve"))}"><i class="fas fa-check"></i>${a.gmPicks ? ` ${escape(localize("downtime-dnd5e.Card.Pick"))}` : ""}</button>
  <button type="button" data-dt-action="reject" data-milestone-event="${m.eventId}" data-action-id="${a.actionId}" title="${escape(localize("downtime-dnd5e.Card.Reject"))}"><i class="fas fa-xmark"></i></button>
</span>`
                        : "";
                const message = a.message
                    ? ` <span class="dt-muted">— ${escape(a.message)}</span>`
                    : "";
                return `<li class="dt-action status-${a.status.toLowerCase()}">${escape(a.label)} <span class="dt-status">${escape(a.statusLabel)}</span>${message}${buttons}</li>`;
            })
            .join("");
        return `<div class="dt-milestone${m.reverted ? " reverted" : ""}">
  <div><i class="fas fa-flag-checkered"></i> ${escape(m.label)}${m.reverted ? ` <span class="dt-muted">${escape(localize("downtime-dnd5e.Card.MilestoneReverted"))}</span>` : ""}</div>
  ${actions ? `<ul>${actions}</ul>` : ""}
</div>`;
    });
    return `<div class="dt-milestones">${rows.join("")}</div>`;
}

/** The live part of the card. */
function liveHtml(card: MethodCard | null): string {
    if (!card)
        return `<p class="dt-muted">${escape(localize("downtime-dnd5e.Card.Gone"))}</p>`;
    const reverted = card.reverted
        ? `<div class="dt-reverted"><i class="fas fa-rotate-left"></i> ${escape(localize("downtime-dnd5e.Card.Reverted"))}</div>`
        : "";
    const usage = card.usage
        ? `<div class="dt-usage${card.usage.blocked ? " blocked" : ""}"><i class="fas fa-hourglass-half"></i> ${escape(card.usage.text)}</div>`
        : "";
    const note = card.note
        ? `<div class="dt-note"><i class="fas fa-note-sticky"></i> ${escape(card.note)}</div>`
        : "";
    const gmTools =
        isGM() && !card.reverted
            ? `<div class="dt-gm">
  <button type="button" data-dt-action="history"><i class="fas fa-clock-rotate-left"></i> ${escape(localize("downtime-dnd5e.Card.History"))}</button>
  ${card.latest ? `<button type="button" data-dt-action="revert"><i class="fas fa-rotate-left"></i> ${escape(localize("downtime-dnd5e.Card.Revert"))}</button>` : ""}
</div>`
            : "";
    return `${reverted}${resultLine(card)}${progressBlock(card)}${usage}${milestonesBlock(card)}${note}${gmTools}`;
}

export class CombinedCardPresenter implements ChatPresenter {
    async methodUseMessage(
        result: MethodUseResult,
        ref: ChatCardRef,
    ): Promise<Record<string, unknown>> {
        const card = await cardFor(ref);
        const base = result.rollMessage ?? {};
        const rolls = Array.isArray(base.rolls) ? base.rolls : [];
        const actor = result.actorUuid
            ? await actorFromUuid(result.actorUuid)
            : null;
        const img = card?.methodImg || card?.itemImg || "icons/svg/book.svg";
        const content = `<div class="downtime-dnd5e-card${card?.reverted ? " is-reverted" : ""}">
  <header class="dt-header">
    <img src="${escape(img)}" alt="" />
    <div>
      <h3>${escape(card?.itemName ?? result.item.name)}</h3>
      <div class="dt-sub">${escape(card?.methodName ?? "")}${card ? ` · ${escape(card.contributorName)}` : ""}</div>
    </div>
  </header>
  <div class="dt-rolled-with dt-muted">${escape(card?.rolledWith ?? "")}</div>
  ${rolls.length ? `<div class="dt-roll">${await renderRolls(rolls)}</div>` : ""}
  <div class="dt-live">${liveHtml(card)}</div>
</div>`;

        const data: Record<string, unknown> = {
            speaker: base.speaker ?? speakerFor(actor),
            content,
            rolls,
            flags: { [CONSTANTS.MODULE_ID]: { card: ref } },
            ...(base.flavor ? { flavor: base.flavor } : {}),
            ...(rolls.length ? { sound: diceSound() } : {}),
        };
        // dnd5e already applied the chosen message mode to its prepared data.
        if (result.rollMessage) {
            if (Array.isArray(base.whisper) && base.whisper.length)
                data.whisper = base.whisper;
            if (base.blind) data.blind = true;
        } else {
            const mode = defaultMessageMode();
            applyMessageMode(data, mode);
        }
        if (getSetting("gmOnlyMode")) data.whisper = gmUserIds();
        return data;
    }

    async renderLive(element: HTMLElement, ref: ChatCardRef): Promise<void> {
        const live = element.querySelector<HTMLElement>(
            ".downtime-dnd5e-card .dt-live",
        );
        if (!live) return;
        const card = await cardFor(ref);
        const html = liveHtml(card);
        if (live.innerHTML !== html) live.innerHTML = html;
        // Outside the live part (it sits above the roll), but in the viewer's language too.
        const rolledWith = element.querySelector<HTMLElement>(
            ".downtime-dnd5e-card .dt-rolled-with",
        );
        if (rolledWith) rolledWith.textContent = card?.rolledWith ?? "";
        element
            .querySelector(".downtime-dnd5e-card")
            ?.classList.toggle("is-reverted", !!card?.reverted);
    }
}

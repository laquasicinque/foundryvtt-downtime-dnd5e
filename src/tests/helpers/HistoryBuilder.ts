import type {
    Contributor,
    EventBaseData,
    HistoryEventData,
    MilestoneActionResult,
    ProgressConfig,
} from "../../types/data";
import { alice, gm } from "./fixtures";

/** Builds history with sequential seq and timestamps. */
export class HistoryBuilder {
    events: HistoryEventData[] = [];
    private seq = 0;
    private value = 0;
    private config: ProgressConfig;

    constructor(config: ProgressConfig = { target: 10, min: 0, max: 10 }) {
        this.config = config;
    }

    private base(id: string, contributor: Contributor): EventBaseData {
        const seq = this.seq++;
        return {
            id,
            seq,
            timestamp: 1_000 + seq,
            contributor,
            dismissed: false,
            note: null,
        };
    }

    private delta(requested: number) {
        let after = this.value + requested;
        if (this.config.max !== null) after = Math.min(after, this.config.max);
        if (this.config.min !== null) after = Math.max(after, this.config.min);
        const result = {
            requested,
            applied: after - this.value,
            before: this.value,
            after,
        };
        this.value = after;
        return result;
    }

    method(
        id: string,
        requested: number,
        {
            contributor = alice,
            methodId = "m1",
            bandId = requested > 0 ? "pass" : "fail",
            countsAs = (requested > 0 ? "SUCCESS" : "FAILURE") as
                | "SUCCESS"
                | "FAILURE"
                | null,
        } = {},
    ) {
        this.events.push({
            ...this.base(id, contributor),
            kind: "METHOD",
            methodId,
            method: { name: "Practice", kind: "SKILL" },
            band: { id: bandId, label: bandId, countsAs },
            roll: null,
            usageTier: null,
            progress: this.delta(requested),
        });
        return this;
    }

    adjust(id: string, requested: number, contributor: Contributor = gm) {
        this.events.push({
            ...this.base(id, contributor),
            kind: "ADJUST",
            progress: this.delta(requested),
        });
        return this;
    }

    set(id: string, value: number, contributor: Contributor = gm) {
        const before = this.value;
        this.value = value;
        this.events.push({
            ...this.base(id, contributor),
            kind: "SET",
            reason: "MANUAL",
            value,
            before,
        });
        return this;
    }

    milestone(
        id: string,
        milestoneId: string,
        causeEventId: string,
        actions: Partial<MilestoneActionResult>[] = [
            { actionId: "a-complete", kind: "COMPLETE" },
        ],
    ) {
        this.events.push({
            ...this.base(id, gm),
            kind: "MILESTONE",
            milestoneId,
            causeEventId,
            actions: actions.map((a) => ({
                actionId: "a",
                kind: "COMPLETE",
                status: "APPLIED",
                message: null,
                createdUuids: [],
                createdItems: [],
                adjustedEvent: null,
                recipientUuids: [],
                ...a,
            })),
        });
        return this;
    }

    approval(
        id: string,
        milestoneEventId: string,
        actionId: string,
        approved: boolean,
        result: Partial<MilestoneActionResult> = {},
    ) {
        this.events.push({
            ...this.base(id, gm),
            kind: "APPROVAL",
            milestoneEventId,
            actionId,
            approved,
            result: {
                actionId,
                kind: "COMPLETE",
                status: approved ? "APPLIED" : "REJECTED",
                message: null,
                createdUuids: [],
                createdItems: [],
                adjustedEvent: null,
                recipientUuids: [],
                ...result,
            },
        });
        return this;
    }

    revert(
        id: string,
        targetEventId: string,
        revertedMilestoneEventIds: string[] = [],
    ) {
        this.events.push({
            ...this.base(id, gm),
            kind: "REVERT",
            targetEventId,
            revertedMilestoneEventIds,
        });
        return this;
    }

    state(id: string, state: { locked?: boolean; completed?: boolean }) {
        this.events.push({ ...this.base(id, gm), kind: "STATE", ...state });
        return this;
    }
}

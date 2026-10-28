import type { Id, MilestoneAction, MilestoneData } from "../types/data";
import type { TrackedItem } from "./TrackedItem";

/** A progress value that fires actions when reached. Read-only. */
export class Milestone {
    readonly item: TrackedItem;
    readonly data: Readonly<MilestoneData>;

    constructor(item: TrackedItem, data: Readonly<MilestoneData>) {
        this.item = item;
        this.data = data;
    }

    get id(): Id {
        return this.data.id;
    }
    get label(): string {
        return this.data.label;
    }
    get at(): number {
        return this.data.at;
    }
    get match(): MilestoneData["match"] {
        return this.data.match;
    }
    get maxTimes(): number | null {
        return this.data.maxTimes;
    }
    get revertWithCause(): boolean {
        return this.data.revertWithCause;
    }
    get actions(): readonly MilestoneAction[] {
        return this.data.actions;
    }

    /** Times this milestone has fired (non-reverted). */
    get fires(): number {
        return this.item.state.milestoneFires[this.id] ?? 0;
    }

    /** Fires left, or null for unlimited. */
    get remaining(): number | null {
        return this.maxTimes === null
            ? null
            : Math.max(0, this.maxTimes - this.fires);
    }

    get reached(): boolean {
        return this.fires > 0;
    }

    toJSON(): MilestoneData {
        return structuredClone(this.data) as MilestoneData;
    }
}

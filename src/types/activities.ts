/** Activity roll adapters: how a dnd5e activity rolls for a tool method. */
import type { RollLike } from "./rolls";
import type { RollSummary } from "./data";

/** A dnd5e activity, as the roll adapters (ours and other modules') get it. */
export type Activity5e = Dnd5e.latest.Activity;

export interface ActivityRollResult {
    /** The (evaluated) roll; attached to the downtime card later. */
    roll: RollLike;
    rolled: RollSummary["rolled"];
    /** The activity's own DC, if it has one. Used only when the method has none. */
    dc: number | null;
}

export interface ActivityRollOption {
    /** Shown in the picker. */
    label: string;
    roll: () => Promise<ActivityRollResult | null>;
}

export interface ActivityRollAdapter<Activity = unknown, Actor = unknown> {
    /** dnd5e activity type, e.g. "check", or a custom module's type. */
    type: string;
    /** Registering module id, for logging and conflict warnings. */
    source: string;
    /**
     * The ways this activity can roll for the actor (e.g. one per associated
     * skill/tool of a check). Empty = not rollable. May throw; callers treat
     * that as "unavailable".
     */
    options(activity: Activity, actor: Actor): ActivityRollOption[];
}

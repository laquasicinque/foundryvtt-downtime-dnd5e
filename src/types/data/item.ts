/** A tracked item, its template, and categories. Stored data unless marked otherwise. */
import type { Id, SchemaVersion } from "./common";
import type { HistoryEventData } from "./history";
import type { MethodData } from "./methods";
import type { MilestoneData } from "./milestones";
import type { Requirement } from "./requirements";
import type { LocalizedText } from "../i18n";

export interface TrackedItemData {
    schemaVersion: SchemaVersion;
    id: Id;
    name: string;
    img: string;
    description: string;
    categoryId: Id | null;
    /** Hidden from non-GM users. */
    hidden: boolean;
    /** Which preset created this item. UI only, never read by game logic. */
    preset: string | null;

    progress: ProgressConfig;
    /**
     * Requirements on the item itself, checked against the acting actor (AND-ed).
     * HIDE hides the whole item from players who don't meet them; DISABLE(_WITH_HINT)
     * shows it with every method disabled. GMs always see and can use it.
     */
    requirements: Requirement[];
    /** Overrides the world default for milestone action approval. */
    approval: ApprovalPolicy;

    methods: MethodData[];
    milestones: MilestoneData[];
    /** Ordered by `seq`. Persisted as `Record<Id, HistoryEventData>` (see storage). */
    history: HistoryEventData[];

    /** Records the normaliser could not parse. Never used as live data. */
    quarantine: QuarantinedRecord[];
}

export interface ProgressConfig {
    /** Reference value for bars and percentages. null = open-ended. */
    target: number | null;
    /** null = unbounded below. */
    min: number | null;
    /** null = unbounded above. */
    max: number | null;
}

export type ApprovalPolicy = "WORLD_DEFAULT" | "AUTO" | "GM";

export interface QuarantinedRecord {
    /** Where the record was found, e.g. `methods[2]` or `history.abc123`. */
    path: string;
    /** A key, so it reads in each viewer's language. Plain strings come from older data. */
    reason: LocalizedText | string;
    raw: unknown;
}

export interface CategoryData {
    id: Id;
    name: string;
    description: string;
}

export type TrackedItemTemplate = Omit<
    TrackedItemData,
    "id" | "history" | "quarantine" | "schemaVersion"
>;

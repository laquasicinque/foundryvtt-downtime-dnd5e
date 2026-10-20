/** Result tables: how a roll turns into progress. Stored data unless marked otherwise. */
import type { CompareOp, Id } from "./common";

export type CountsAs = "SUCCESS" | "FAILURE" | null;

/** First matching band wins. The last band is always unconditional. */
export interface ResultTable {
    bands: ResultBand[];
}

export interface ResultBand {
    id: Id;
    label: string;
    /** All must match. Empty = always matches. */
    when: BandCondition[];
    effect: BandEffect;
    countsAs: CountsAs;
}

export interface BandCondition {
    /** NATURAL = kept d20. TOTAL = roll total. MARGIN = total - effective DC. */
    on: "NATURAL" | "TOTAL" | "MARGIN";
    op: CompareOp;
    value: number;
}

export interface BandEffect {
    delta: DeltaSpec;
}

export interface StaticDelta {
    kind: "STATIC";
    value: number;
}

export interface FormulaDelta {
    kind: "FORMULA";
    /** Variables: @total, @natural, @dc, @margin, plus actor roll data. */
    formula: string;
}

export type DeltaSpec = StaticDelta | FormulaDelta;
